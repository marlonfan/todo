package repository

import (
	"errors"
	"time"
	"todo-app/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CaldavRepository struct {
	db *gorm.DB
}

type CaldavEventCollectionState struct {
	Count        int64
	MaxUpdatedAt time.Time
}

const caldavUpsertBatchSize = 200

func NewCaldavRepository(db *gorm.DB) *CaldavRepository {
	return &CaldavRepository{db: db}
}

func (r *CaldavRepository) CreateSource(source *models.CaldavSource) error {
	return r.db.Create(source).Error
}

func (r *CaldavRepository) UpdateSource(source *models.CaldavSource) error {
	return r.db.Save(source).Error
}

func (r *CaldavRepository) GetSourceByID(userID, sourceID int64) (*models.CaldavSource, error) {
	var source models.CaldavSource
	if err := r.db.Where("id = ? AND user_id = ?", sourceID, userID).First(&source).Error; err != nil {
		return nil, err
	}
	return &source, nil
}

func (r *CaldavRepository) ListSourcesByUser(userID int64) ([]models.CaldavSource, error) {
	var sources []models.CaldavSource
	err := r.db.Where("user_id = ?", userID).Order("id desc").Find(&sources).Error
	return sources, err
}

func (r *CaldavRepository) ListAllSources() ([]models.CaldavSource, error) {
	var sources []models.CaldavSource
	err := r.db.Order("id asc").Find(&sources).Error
	return sources, err
}

func (r *CaldavRepository) DeleteSourceCascade(userID, sourceID int64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var calendarIDs []int64
		if err := tx.Model(&models.CaldavCalendar{}).
			Where("user_id = ? AND source_id = ?", userID, sourceID).
			Pluck("id", &calendarIDs).Error; err != nil {
			return err
		}
		if len(calendarIDs) > 0 {
			if err := tx.Where("user_id = ? AND calendar_id IN ?", userID, calendarIDs).
				Delete(&models.CaldavEventCache{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("user_id = ? AND source_id = ?", userID, sourceID).
			Delete(&models.CaldavCalendar{}).Error; err != nil {
			return err
		}
		return tx.Where("user_id = ? AND id = ?", userID, sourceID).Delete(&models.CaldavSource{}).Error
	})
}

func (r *CaldavRepository) ReplaceCalendars(userID, sourceID int64, calendars []models.CaldavCalendar) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND source_id = ?", userID, sourceID).Delete(&models.CaldavEventCache{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND source_id = ?", userID, sourceID).Delete(&models.CaldavCalendar{}).Error; err != nil {
			return err
		}
		for i := range calendars {
			calendars[i].UserID = userID
			calendars[i].SourceID = sourceID
			if err := tx.Create(&calendars[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *CaldavRepository) ListCalendarsBySource(userID, sourceID int64) ([]models.CaldavCalendar, error) {
	var calendars []models.CaldavCalendar
	err := r.db.Where("user_id = ? AND source_id = ?", userID, sourceID).Order("id asc").Find(&calendars).Error
	return calendars, err
}

func (r *CaldavRepository) ListSelectedCalendarsBySource(userID, sourceID int64) ([]models.CaldavCalendar, error) {
	var calendars []models.CaldavCalendar
	err := r.db.Where("user_id = ? AND source_id = ? AND is_selected = ?", userID, sourceID, true).Order("id asc").Find(&calendars).Error
	return calendars, err
}

func (r *CaldavRepository) UpdateCalendar(calendar *models.CaldavCalendar) error {
	return r.db.Save(calendar).Error
}

func caldavEventUpsertClause(updatedAt time.Time) clause.OnConflict {
	return clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "source_id"},
			{Name: "calendar_id"},
			{Name: "event_uid"},
			{Name: "recurrence_id"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"title":         gorm.Expr("excluded.title"),
			"description":   gorm.Expr("excluded.description"),
			"location":      gorm.Expr("excluded.location"),
			"organizer":     gorm.Expr("excluded.organizer"),
			"attendees":     gorm.Expr("excluded.attendees"),
			"meeting_link":  gorm.Expr("excluded.meeting_link"),
			"start_time":    gorm.Expr("excluded.start_time"),
			"end_time":      gorm.Expr("excluded.end_time"),
			"all_day":       gorm.Expr("excluded.all_day"),
			"status":        gorm.Expr("excluded.status"),
			"etag":          gorm.Expr("excluded.etag"),
			"last_modified": gorm.Expr("excluded.last_modified"),
			"raw_href":      gorm.Expr("excluded.raw_href"),
			"updated_at":    updatedAt,
		}),
	}
}

func (r *CaldavRepository) UpsertEvent(event *models.CaldavEventCache) error {
	return r.db.Clauses(caldavEventUpsertClause(time.Now().UTC())).Create(event).Error
}

func (r *CaldavRepository) UpsertEvents(events []models.CaldavEventCache) error {
	if len(events) == 0 {
		return nil
	}
	return r.db.Clauses(caldavEventUpsertClause(time.Now().UTC())).CreateInBatches(events, caldavUpsertBatchSize).Error
}

func (r *CaldavRepository) ReplaceEventsForCalendar(userID, sourceID, calendarID int64, events []models.CaldavEventCache) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if len(events) > 0 {
			if err := tx.Clauses(caldavEventUpsertClause(time.Now().UTC())).CreateInBatches(events, caldavUpsertBatchSize).Error; err != nil {
				return err
			}
		}
		keepKeySet := make(map[string]struct{}, len(events))
		keepKeys := make([]string, 0, len(events))
		for i := range events {
			uid := events[i].EventUID
			if uid == "" {
				continue
			}
			key := uid + "|" + events[i].RecurrenceID
			if _, exists := keepKeySet[key]; exists {
				continue
			}
			keepKeySet[key] = struct{}{}
			keepKeys = append(keepKeys, key)
		}
		query := tx.Where("user_id = ? AND source_id = ? AND calendar_id = ?", userID, sourceID, calendarID)
		if len(keepKeys) == 0 {
			return query.Delete(&models.CaldavEventCache{}).Error
		}
		return query.Where("(event_uid || '|' || recurrence_id) NOT IN ?", keepKeys).Delete(&models.CaldavEventCache{}).Error
	})
}

func (r *CaldavRepository) DeleteEventsNotInSet(userID, sourceID, calendarID int64, keepKeys []string) error {
	query := r.db.Where("user_id = ? AND source_id = ? AND calendar_id = ?", userID, sourceID, calendarID)
	if len(keepKeys) == 0 {
		return query.Delete(&models.CaldavEventCache{}).Error
	}
	return query.Where("(event_uid || '|' || recurrence_id) NOT IN ?", keepKeys).Delete(&models.CaldavEventCache{}).Error
}

func (r *CaldavRepository) DeleteEventsByHrefs(userID, sourceID, calendarID int64, hrefs []string) error {
	if len(hrefs) == 0 {
		return nil
	}
	return r.db.
		Where("user_id = ? AND source_id = ? AND calendar_id = ? AND raw_href IN ?", userID, sourceID, calendarID, hrefs).
		Delete(&models.CaldavEventCache{}).Error
}

func (r *CaldavRepository) DeleteEventsByHref(userID, sourceID, calendarID int64, href string) error {
	if href == "" {
		return nil
	}
	return r.db.
		Where("user_id = ? AND source_id = ? AND calendar_id = ? AND raw_href = ?", userID, sourceID, calendarID, href).
		Delete(&models.CaldavEventCache{}).Error
}

func (r *CaldavRepository) GetCalendarEventStartBounds(userID, sourceID, calendarID int64) (time.Time, time.Time, bool, error) {
	base := r.db.Where("user_id = ? AND source_id = ? AND calendar_id = ?", userID, sourceID, calendarID)

	var earliest models.CaldavEventCache
	if err := base.Order("start_time asc").Limit(1).First(&earliest).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return time.Time{}, time.Time{}, false, nil
		}
		return time.Time{}, time.Time{}, false, err
	}

	var latest models.CaldavEventCache
	if err := base.Order("start_time desc").Limit(1).First(&latest).Error; err != nil {
		return time.Time{}, time.Time{}, false, err
	}

	return earliest.StartTime.UTC(), latest.StartTime.UTC(), true, nil
}

func (r *CaldavRepository) HasNonCanonicalRecurrenceIDs(userID, sourceID, calendarID int64) (bool, error) {
	var count int64
	err := r.db.Model(&models.CaldavEventCache{}).
		Where("user_id = ? AND source_id = ? AND calendar_id = ?", userID, sourceID, calendarID).
		Where("recurrence_id <> ''").
		Where("recurrence_id NOT LIKE ?", "%Z").
		Limit(1).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *CaldavRepository) ListEventsInRange(userID int64, start, end time.Time) ([]models.CaldavEventCache, error) {
	var events []models.CaldavEventCache
	err := r.db.Where("user_id = ?", userID).
		Where("start_time < ?", end).
		Where("(end_time IS NULL AND start_time >= ?) OR (end_time IS NOT NULL AND end_time > ?)", start, start).
		Order("start_time asc").
		Find(&events).Error
	return events, err
}

func (r *CaldavRepository) EventCollectionStateInRange(userID int64, start, end time.Time) (CaldavEventCollectionState, error) {
	var row struct {
		Count        int64
		MaxUpdatedAt nullableDBTime
	}
	err := r.db.Model(&models.CaldavEventCache{}).
		Select("COUNT(*) AS count, MAX(updated_at) AS max_updated_at").
		Where("user_id = ?", userID).
		Where("start_time < ?", end).
		Where("(end_time IS NULL AND start_time >= ?) OR (end_time IS NOT NULL AND end_time > ?)", start, start).
		Where("status IS NULL OR lower(status) <> ?", "cancelled").
		Scan(&row).Error
	if err != nil {
		return CaldavEventCollectionState{}, err
	}
	state := CaldavEventCollectionState{Count: row.Count}
	if row.MaxUpdatedAt.Valid {
		state.MaxUpdatedAt = row.MaxUpdatedAt.Time.UTC()
	}
	return state, nil
}

func (r *CaldavRepository) ListDistinctEventHrefsInRange(userID, sourceID, calendarID int64, start, end time.Time) ([]string, error) {
	var hrefs []string
	err := r.db.Model(&models.CaldavEventCache{}).
		Distinct("raw_href").
		Where("user_id = ? AND source_id = ? AND calendar_id = ?", userID, sourceID, calendarID).
		Where("raw_href <> ''").
		Where("start_time < ?", end).
		Where("(end_time IS NULL AND start_time >= ?) OR (end_time IS NOT NULL AND end_time > ?)", start, start).
		Pluck("raw_href", &hrefs).Error
	return hrefs, err
}
