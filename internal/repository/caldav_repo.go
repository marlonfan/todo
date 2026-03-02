package repository

import (
	"time"
	"todo-app/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CaldavRepository struct {
	db *gorm.DB
}

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

func (r *CaldavRepository) UpsertEvent(event *models.CaldavEventCache) error {
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "source_id"},
			{Name: "calendar_id"},
			{Name: "event_uid"},
			{Name: "recurrence_id"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"title":         event.Title,
			"description":   event.Description,
			"start_time":    event.StartTime,
			"end_time":      event.EndTime,
			"all_day":       event.AllDay,
			"status":        event.Status,
			"etag":          event.Etag,
			"last_modified": event.LastModified,
			"raw_href":      event.RawHref,
			"updated_at":    time.Now().UTC(),
		}),
	}).Create(event).Error
}

func (r *CaldavRepository) DeleteEventsNotInSet(userID, sourceID, calendarID int64, keepKeys []string) error {
	query := r.db.Where("user_id = ? AND source_id = ? AND calendar_id = ?", userID, sourceID, calendarID)
	if len(keepKeys) == 0 {
		return query.Delete(&models.CaldavEventCache{}).Error
	}
	return query.Where("(event_uid || '|' || recurrence_id) NOT IN ?", keepKeys).Delete(&models.CaldavEventCache{}).Error
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
