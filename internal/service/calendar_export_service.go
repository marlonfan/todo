package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

const (
	calendarFeedPurpose   = "calendar_feed"
	defaultCalendarPast   = 365 * 24 * time.Hour
	defaultCalendarFuture = 730 * 24 * time.Hour
)

type CalendarExportService struct {
	taskSvc  *TaskService
	userRepo *repository.UserRepository
	secret   string
}

type CalendarSubscriptionInfo struct {
	ICSURL             string `json:"ics_url"`
	CalDAVURL          string `json:"caldav_url"`
	CalDAVPrincipalURL string `json:"caldav_principal_url"`
	CalDAVHomeURL      string `json:"caldav_home_url"`
	CalDAVRootURL      string `json:"caldav_root_url"`
	Username           string `json:"username"`
}

type CalendarObject struct {
	Href     string
	UID      string
	ETag     string
	Data     string
	Task     *models.Task
	ReadOnly bool
}

type CalendarCollectionPropertyUpdate struct {
	DisplayName *string
	Description *string
	Color       *string
	Order       *int
}

type calendarFeedClaims struct {
	Purpose  string `json:"purpose"`
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

type icalProp struct {
	Name   string
	Params map[string]string
	Value  string
}

type parsedICalendarObject struct {
	Component         string
	UID               string
	Summary           string
	Description       string
	Status            models.TaskStatus
	StartTime         *time.Time
	EndTime           *time.Time
	DueDate           *time.Time
	AllDay            bool
	RecurrenceRule    *models.RecurrenceRule
	RecurrenceEndDate *time.Time
}

func NewCalendarExportService(taskSvc *TaskService, userRepo *repository.UserRepository, secret string) *CalendarExportService {
	return &CalendarExportService{
		taskSvc:  taskSvc,
		userRepo: userRepo,
		secret:   secret,
	}
}

func (s *CalendarExportService) SubscriptionInfo(user *models.User, baseURL string) (*CalendarSubscriptionInfo, error) {
	if user == nil || user.ID <= 0 {
		return nil, errors.New("user is required")
	}
	token, err := s.GenerateFeedToken(user)
	if err != nil {
		return nil, err
	}
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	username := url.PathEscape(user.Username)
	return &CalendarSubscriptionInfo{
		ICSURL:             fmt.Sprintf("%s/feeds/calendar/%s.ics", baseURL, token),
		CalDAVURL:          fmt.Sprintf("%s/dav/calendars/%s/todo/", baseURL, username),
		CalDAVPrincipalURL: fmt.Sprintf("%s/dav/principals/%s/", baseURL, username),
		CalDAVHomeURL:      fmt.Sprintf("%s/dav/calendars/%s/", baseURL, username),
		CalDAVRootURL:      fmt.Sprintf("%s/dav/", baseURL),
		Username:           user.Username,
	}, nil
}

func (s *CalendarExportService) SubscriptionInfoForUserID(userID int64, baseURL string) (*CalendarSubscriptionInfo, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}
	return s.SubscriptionInfo(user, baseURL)
}

func (s *CalendarExportService) UpdateCollectionProperties(userID int64, update CalendarCollectionPropertyUpdate) error {
	updates := map[string]interface{}{}
	if update.DisplayName != nil {
		updates["cal_dav_calendar_name"] = *update.DisplayName
	}
	if update.Description != nil {
		updates["cal_dav_calendar_desc"] = *update.Description
	}
	if update.Color != nil {
		updates["cal_dav_calendar_color"] = *update.Color
	}
	if update.Order != nil {
		updates["cal_dav_calendar_order"] = *update.Order
	}
	return s.userRepo.UpdateCalDAVCalendarProperties(userID, updates)
}

func (s *CalendarExportService) GenerateFeedToken(user *models.User) (string, error) {
	if user == nil || user.ID <= 0 {
		return "", errors.New("user is required")
	}
	claims := calendarFeedClaims{
		Purpose:  calendarFeedPurpose,
		UserID:   user.ID,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt: jwt.NewNumericDate(time.Now()),
			Subject:  strconv.FormatInt(user.ID, 10),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.secret))
}

func (s *CalendarExportService) ParseFeedToken(rawToken string) (*models.User, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return nil, errors.New("calendar token is required")
	}
	token, err := jwt.ParseWithClaims(rawToken, &calendarFeedClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*calendarFeedClaims)
	if !ok || !token.Valid || claims.Purpose != calendarFeedPurpose || claims.UserID <= 0 {
		return nil, errors.New("invalid calendar token")
	}
	return s.userRepo.GetByID(claims.UserID)
}

func (s *CalendarExportService) DefaultExportRange() (time.Time, time.Time) {
	now := time.Now().UTC()
	return now.Add(-defaultCalendarPast), now.Add(defaultCalendarFuture)
}

func (s *CalendarExportService) ExportFeed(userID int64, start, end time.Time) (string, error) {
	if start.IsZero() || end.IsZero() || !end.After(start) {
		start, end = s.DefaultExportRange()
	}
	objects, err := s.ListObjects(userID, start, end, true)
	if err != nil {
		return "", err
	}
	components := make([]string, 0, len(objects))
	for _, object := range objects {
		component := extractFirstCalendarComponent(object.Data)
		if component != "" {
			components = append(components, component)
		}
	}
	return s.wrapCalendar("Todo", components), nil
}

func (s *CalendarExportService) ListObjects(userID int64, start, end time.Time, includeUnscheduled bool) ([]CalendarObject, error) {
	tasks, err := s.listExportTasks(userID, start, end, includeUnscheduled)
	if err != nil {
		return nil, err
	}
	objects := make([]CalendarObject, 0, len(tasks))
	for i := range tasks {
		task := tasks[i]
		if shouldHideTaskFromCalendarExport(&task) {
			continue
		}
		object, err := s.taskToObject(&task)
		if err != nil {
			return nil, err
		}
		objects = append(objects, *object)
	}
	externalTasks, err := s.listExternalExportTasks(userID, start, end)
	if err != nil {
		return nil, err
	}
	for i := range externalTasks {
		task := externalTasks[i]
		if shouldHideTaskFromCalendarExport(&task) {
			continue
		}
		object, err := s.taskToObject(&task)
		if err != nil {
			return nil, err
		}
		objects = append(objects, *object)
	}
	sort.Slice(objects, func(i, j int) bool {
		left := taskSortTime(objects[i].Task)
		right := taskSortTime(objects[j].Task)
		if !left.Equal(right) {
			return left.Before(right)
		}
		return objects[i].Href < objects[j].Href
	})
	return objects, nil
}

func (s *CalendarExportService) GetObject(userID int64, objectName string) (*CalendarObject, error) {
	task, err := s.findTaskByObjectName(userID, objectName, "")
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		externalTask, externalErr := s.findExternalTaskByObjectName(userID, objectName)
		if externalErr != nil {
			return nil, externalErr
		}
		return s.taskToObject(externalTask)
	}
	return s.taskToObject(task)
}

func (s *CalendarExportService) GetObjectsByNames(userID int64, objectNames []string) ([]CalendarObject, error) {
	orderedNames := make([]string, 0, len(objectNames))
	uniqueNames := make([]string, 0, len(objectNames))
	seen := map[string]struct{}{}
	for _, objectName := range objectNames {
		name := normalizeCalendarObjectName(objectName)
		if name == "" {
			continue
		}
		orderedNames = append(orderedNames, name)
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		uniqueNames = append(uniqueNames, name)
	}
	if len(uniqueNames) == 0 {
		return []CalendarObject{}, nil
	}

	localIDs := make([]int64, 0, len(uniqueNames))
	localRefs := make([]string, 0, len(uniqueNames))
	externalNames := make(map[string]struct{})
	for _, name := range uniqueNames {
		if id, ok := taskIDFromCalDAVHref(name); ok {
			localIDs = append(localIDs, id)
			continue
		}
		if isExternalCalDAVObjectName(name) {
			externalNames[name] = struct{}{}
			continue
		}
		localRefs = append(localRefs, name)
	}

	tasksByName := map[string]*models.Task{}
	if len(localIDs) > 0 {
		tasks, err := s.taskSvc.taskRepo.ListByIDsAndUser(userID, localIDs)
		if err != nil {
			return nil, err
		}
		for i := range tasks {
			task := &tasks[i]
			tasksByName[fmt.Sprintf("task-%d.ics", task.ID)] = task
			tasksByName[taskCalDAVHref(task)] = task
		}
	}
	if len(localRefs) > 0 {
		tasks, err := s.taskSvc.taskRepo.ListByCalDAVHrefs(userID, localRefs)
		if err != nil {
			return nil, err
		}
		for i := range tasks {
			task := &tasks[i]
			tasksByName[taskCalDAVHref(task)] = task
		}
	}
	if len(externalNames) > 0 {
		start, end := s.DefaultExportRange()
		tasks, err := s.listExternalExportTasks(userID, start, end)
		if err != nil {
			return nil, err
		}
		for i := range tasks {
			task := &tasks[i]
			name := externalCalDAVHref(task)
			if _, ok := externalNames[name]; ok {
				tasksByName[name] = task
			}
		}
	}

	objects := make([]CalendarObject, 0, len(orderedNames))
	for _, name := range orderedNames {
		task := tasksByName[name]
		if task == nil || shouldHideTaskFromCalendarExport(task) {
			continue
		}
		object, err := s.taskToObject(task)
		if err != nil {
			return nil, err
		}
		objects = append(objects, *object)
	}
	return objects, nil
}

func (s *CalendarExportService) UpsertObject(userID int64, objectName string, data []byte) (*CalendarObject, bool, error) {
	loc := s.userLocation(userID)
	parsed, err := parseICalendarObject(data, loc)
	if err != nil {
		return nil, false, err
	}
	if parsed.UID == "" {
		parsed.UID = strings.TrimSuffix(strings.TrimSpace(objectName), ".ics")
	}
	if strings.TrimSpace(parsed.Summary) == "" {
		parsed.Summary = "Untitled"
	}
	objectName = normalizeCalendarObjectName(objectName)
	task, err := s.findTaskByObjectName(userID, objectName, parsed.UID)
	created := false
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, err
		}
		if _, externalErr := s.findExternalTaskByObjectName(userID, objectName); externalErr == nil {
			return nil, false, errors.New("calendar object is read-only")
		}
		task, err = s.createTaskFromICalendar(userID, parsed)
		if err != nil {
			return nil, false, err
		}
		created = true
	} else {
		task, err = s.updateTaskFromICalendar(userID, task, parsed)
		if err != nil {
			return nil, false, err
		}
	}
	if task.CalDAVUID != parsed.UID || task.CalDAVHref != objectName {
		task.CalDAVUID = parsed.UID
		task.CalDAVHref = objectName
		if err := s.taskSvc.taskRepo.Update(task); err != nil {
			return nil, false, err
		}
		task, err = s.taskSvc.taskRepo.GetByIDAndUser(task.ID, userID)
		if err != nil {
			return nil, false, err
		}
	}
	object, err := s.taskToObject(task)
	if err != nil {
		return nil, false, err
	}
	return object, created, nil
}

func (s *CalendarExportService) DeleteObject(userID int64, objectName string) error {
	task, err := s.findTaskByObjectName(userID, objectName, "")
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if _, externalErr := s.findExternalTaskByObjectName(userID, objectName); externalErr == nil {
				return errors.New("calendar object is read-only")
			}
		}
		return err
	}
	return s.taskSvc.Delete(userID, task.ID, nil)
}

func (s *CalendarExportService) CollectionToken(userID int64) (string, error) {
	taskState, err := s.taskSvc.taskRepo.CalendarCollectionState(userID)
	if err != nil {
		return "", err
	}
	h := sha256.New()
	fmt.Fprintf(h, "tasks:%d:%d:%s\n", taskState.Count, taskState.MaxRevision, taskState.MaxUpdatedAt.UTC().Format(time.RFC3339Nano))
	start, end := s.DefaultExportRange()
	if s.taskSvc != nil && s.taskSvc.caldavSvc != nil && s.taskSvc.caldavSvc.repo != nil {
		externalState, err := s.taskSvc.caldavSvc.repo.EventCollectionStateInRange(userID, start, end)
		if err != nil {
			return "", err
		}
		fmt.Fprintf(h, "caldav:%d:%s\n", externalState.Count, externalState.MaxUpdatedAt.UTC().Format(time.RFC3339Nano))
	}
	return "sync-" + hex.EncodeToString(h.Sum(nil))[:24], nil
}

func (s *CalendarExportService) wrapCalendar(name string, components []string) string {
	lines := []string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Todo App//Calendar Export//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:" + escapeICalText(name),
	}
	lines = append(lines, components...)
	lines = append(lines, "END:VCALENDAR")
	return strings.Join(lines, "\r\n") + "\r\n"
}

func (s *CalendarExportService) taskToObject(task *models.Task) (*CalendarObject, error) {
	if task == nil {
		return nil, errors.New("task is required")
	}
	uid := taskCalDAVUID(task)
	href := taskCalDAVHref(task)
	component := s.taskToComponent(task, uid)
	data := s.wrapCalendar(task.Title, []string{component})
	return &CalendarObject{
		Href:     href,
		UID:      uid,
		ETag:     taskETag(task),
		Data:     data,
		Task:     task,
		ReadOnly: task.ReadOnly,
	}, nil
}

func (s *CalendarExportService) taskToComponent(task *models.Task, uid string) string {
	loc := s.userLocation(task.UserID)
	stamp := taskCalendarStampTime(task)
	nowStamp := stamp.UTC().Format("20060102T150405Z")
	lines := []string{}
	if isTaskCalendarEvent(task) {
		lines = append(lines,
			"BEGIN:VEVENT",
			"UID:"+escapeICalText(uid),
			"DTSTAMP:"+nowStamp,
			"CREATED:"+taskCalendarCreatedTime(task).UTC().Format("20060102T150405Z"),
			"LAST-MODIFIED:"+stamp.UTC().Format("20060102T150405Z"),
			"SEQUENCE:"+strconv.FormatInt(maxInt64(task.Revision, 0), 10),
			"SUMMARY:"+escapeICalText(task.Title),
		)
		if strings.TrimSpace(task.Description) != "" {
			lines = append(lines, "DESCRIPTION:"+escapeICalText(task.Description))
		}
		start := taskEventStart(task)
		if task.AllDay {
			lines = append(lines, "DTSTART;VALUE=DATE:"+formatICalDate(start, loc))
			if task.EndTime != nil {
				lines = append(lines, "DTEND;VALUE=DATE:"+formatICalDate(*task.EndTime, loc))
			} else {
				lines = append(lines, "DTEND;VALUE=DATE:"+formatICalDate(start.In(loc).AddDate(0, 0, 1), loc))
			}
		} else {
			lines = append(lines, "DTSTART:"+start.UTC().Format("20060102T150405Z"))
			if task.EndTime != nil {
				lines = append(lines, "DTEND:"+task.EndTime.UTC().Format("20060102T150405Z"))
			}
		}
		if task.RecurrenceRule != nil {
			if rruleLine := taskRRuleLine(task); rruleLine != "" {
				lines = append(lines, rruleLine)
			}
		}
		if categories := taskCategoriesLine(task); categories != "" {
			lines = append(lines, categories)
		}
		if task.Status == models.TaskStatusCancelled || task.Status == models.TaskStatusSkipped {
			lines = append(lines, "STATUS:CANCELLED")
		} else {
			lines = append(lines, "STATUS:CONFIRMED")
		}
		lines = append(lines, "END:VEVENT")
		return strings.Join(lines, "\r\n")
	}

	lines = append(lines,
		"BEGIN:VTODO",
		"UID:"+escapeICalText(uid),
		"DTSTAMP:"+nowStamp,
		"CREATED:"+taskCalendarCreatedTime(task).UTC().Format("20060102T150405Z"),
		"LAST-MODIFIED:"+stamp.UTC().Format("20060102T150405Z"),
		"SEQUENCE:"+strconv.FormatInt(maxInt64(task.Revision, 0), 10),
		"SUMMARY:"+escapeICalText(task.Title),
	)
	if strings.TrimSpace(task.Description) != "" {
		lines = append(lines, "DESCRIPTION:"+escapeICalText(task.Description))
	}
	if task.DueDate != nil {
		lines = append(lines, "DUE:"+task.DueDate.UTC().Format("20060102T150405Z"))
	}
	if categories := taskCategoriesLine(task); categories != "" {
		lines = append(lines, categories)
	}
	switch task.Status {
	case models.TaskStatusCompleted:
		lines = append(lines, "STATUS:COMPLETED")
		if task.CompletedAt != nil {
			lines = append(lines, "COMPLETED:"+task.CompletedAt.UTC().Format("20060102T150405Z"))
		}
	case models.TaskStatusCancelled, models.TaskStatusSkipped:
		lines = append(lines, "STATUS:CANCELLED")
	default:
		lines = append(lines, "STATUS:NEEDS-ACTION")
	}
	lines = append(lines, "END:VTODO")
	return strings.Join(lines, "\r\n")
}

func (s *CalendarExportService) listExportTasks(userID int64, start, end time.Time, includeUnscheduled bool) ([]models.Task, error) {
	if includeUnscheduled || start.IsZero() || end.IsZero() || !end.After(start) {
		return s.taskSvc.List(userID, map[string]interface{}{})
	}
	seen := make(map[int64]models.Task)
	regular, err := s.taskSvc.List(userID, map[string]interface{}{"start": start, "end": end})
	if err != nil {
		return nil, err
	}
	for _, task := range regular {
		seen[task.ID] = task
	}
	recurring, err := s.taskSvc.taskRepo.GetRecurringTasks(userID, start, end)
	if err != nil {
		return nil, err
	}
	for _, task := range recurring {
		seen[task.ID] = task
	}
	out := make([]models.Task, 0, len(seen))
	for _, task := range seen {
		out = append(out, task)
	}
	return out, nil
}

func (s *CalendarExportService) listExternalExportTasks(userID int64, start, end time.Time) ([]models.Task, error) {
	if s.taskSvc == nil || s.taskSvc.caldavSvc == nil {
		return []models.Task{}, nil
	}
	if start.IsZero() || end.IsZero() || !end.After(start) {
		start, end = s.DefaultExportRange()
	}
	return s.taskSvc.caldavSvc.ListReadOnlyTasks(userID, start, end)
}

func (s *CalendarExportService) findTaskByObjectName(userID int64, objectName, uid string) (*models.Task, error) {
	objectName = normalizeCalendarObjectName(objectName)
	if id, ok := taskIDFromCalDAVHref(objectName); ok {
		return s.taskSvc.taskRepo.GetByIDAndUser(id, userID)
	}
	if uidID, ok := taskIDFromCalDAVUID(uid); ok {
		return s.taskSvc.taskRepo.GetByIDAndUser(uidID, userID)
	}
	return s.taskSvc.taskRepo.GetByCalDAVRef(userID, strings.TrimSpace(uid), objectName)
}

func (s *CalendarExportService) findExternalTaskByObjectName(userID int64, objectName string) (*models.Task, error) {
	objectName = normalizeCalendarObjectName(objectName)
	start, end := s.DefaultExportRange()
	tasks, err := s.listExternalExportTasks(userID, start, end)
	if err != nil {
		return nil, err
	}
	for i := range tasks {
		if externalCalDAVHref(&tasks[i]) == objectName {
			return &tasks[i], nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (s *CalendarExportService) createTaskFromICalendar(userID int64, parsed *parsedICalendarObject) (*models.Task, error) {
	req := &models.CreateTaskRequest{
		Title:             parsed.Summary,
		Description:       parsed.Description,
		Priority:          models.PriorityMedium,
		StartTime:         parsed.StartTime,
		EndTime:           parsed.EndTime,
		DueDate:           parsed.DueDate,
		AllDay:            parsed.AllDay,
		RecurrenceRule:    parsed.RecurrenceRule,
		RecurrenceEndDate: parsed.RecurrenceEndDate,
	}
	task, err := s.taskSvc.Create(userID, req)
	if err != nil {
		return nil, err
	}
	if parsed.Status != "" && parsed.Status != models.TaskStatusPending {
		task, err = s.taskSvc.UpdateStatus(userID, task.ID, parsed.Status, "", "", nil, &TaskActivityMeta{SubmitSource: "caldav"})
		if err != nil {
			return nil, err
		}
	}
	return task, nil
}

func (s *CalendarExportService) updateTaskFromICalendar(userID int64, task *models.Task, parsed *parsedICalendarObject) (*models.Task, error) {
	req := &models.UpdateTaskRequest{
		Title:             parsed.Summary,
		Description:       parsed.Description,
		Priority:          &task.Priority,
		Status:            parsed.Status,
		StartTime:         parsed.StartTime,
		EndTime:           parsed.EndTime,
		DueDate:           parsed.DueDate,
		AllDay:            &parsed.AllDay,
		RecurrenceRule:    parsed.RecurrenceRule,
		RecurrenceEndDate: parsed.RecurrenceEndDate,
	}
	fieldMask := map[string]bool{
		"title":               true,
		"description":         true,
		"status":              true,
		"start_time":          true,
		"end_time":            true,
		"due_date":            true,
		"all_day":             true,
		"recurrence_rule":     true,
		"recurrence_end_date": true,
	}
	return s.taskSvc.Update(userID, task.ID, req, fieldMask, nil, &TaskActivityMeta{SubmitSource: "caldav"})
}

func (s *CalendarExportService) userLocation(userID int64) *time.Location {
	tz := s.taskSvc.resolveUserTimezone(userID)
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.UTC
	}
	return loc
}

func parseICalendarObject(data []byte, loc *time.Location) (*parsedICalendarObject, error) {
	lines := unfoldICalLines(string(data))
	var component string
	props := make(map[string][]icalProp)
	for _, line := range lines {
		upper := strings.ToUpper(strings.TrimSpace(line))
		switch upper {
		case "BEGIN:VEVENT":
			component = "VEVENT"
			continue
		case "BEGIN:VTODO":
			component = "VTODO"
			continue
		case "END:VEVENT", "END:VTODO":
			break
		}
		if component == "" {
			continue
		}
		prop, ok := parseICalProp(line)
		if !ok {
			continue
		}
		props[prop.Name] = append(props[prop.Name], prop)
	}
	if component == "" {
		return nil, errors.New("calendar object must contain VEVENT or VTODO")
	}
	parsed := &parsedICalendarObject{
		Component: component,
		UID:       unescapeICalText(firstICalValue(props, "UID")),
		Summary:   unescapeICalText(firstICalValue(props, "SUMMARY")),
		Status:    models.TaskStatusPending,
	}
	parsed.Description = unescapeICalText(firstICalValue(props, "DESCRIPTION"))
	statusRaw := strings.ToUpper(strings.TrimSpace(firstICalValue(props, "STATUS")))
	switch component {
	case "VEVENT":
		if statusRaw == "CANCELLED" {
			parsed.Status = models.TaskStatusCancelled
		}
		start, allDay, err := parseICalTime(firstICalProp(props, "DTSTART"), loc)
		if err != nil {
			return nil, fmt.Errorf("invalid DTSTART: %w", err)
		}
		end, endAllDay, err := parseICalTime(firstICalProp(props, "DTEND"), loc)
		if err != nil {
			return nil, fmt.Errorf("invalid DTEND: %w", err)
		}
		parsed.StartTime = start
		parsed.EndTime = end
		parsed.AllDay = allDay || endAllDay
	case "VTODO":
		switch statusRaw {
		case "COMPLETED":
			parsed.Status = models.TaskStatusCompleted
		case "CANCELLED":
			parsed.Status = models.TaskStatusCancelled
		}
		start, allDay, err := parseICalTime(firstICalProp(props, "DTSTART"), loc)
		if err != nil {
			return nil, fmt.Errorf("invalid DTSTART: %w", err)
		}
		due, dueAllDay, err := parseICalTime(firstICalProp(props, "DUE"), loc)
		if err != nil {
			return nil, fmt.Errorf("invalid DUE: %w", err)
		}
		parsed.StartTime = start
		parsed.DueDate = due
		parsed.AllDay = allDay || dueAllDay
	}
	rule, until := parseICalRRule(firstICalValue(props, "RRULE"), loc)
	parsed.RecurrenceRule = rule
	parsed.RecurrenceEndDate = until
	return parsed, nil
}

func parseICalProp(line string) (icalProp, bool) {
	idx := strings.Index(line, ":")
	if idx < 0 {
		return icalProp{}, false
	}
	left := line[:idx]
	value := line[idx+1:]
	parts := strings.Split(left, ";")
	name := strings.ToUpper(strings.TrimSpace(parts[0]))
	if name == "" {
		return icalProp{}, false
	}
	prop := icalProp{Name: name, Params: map[string]string{}, Value: value}
	for _, part := range parts[1:] {
		key, val, ok := strings.Cut(part, "=")
		if !ok {
			continue
		}
		prop.Params[strings.ToUpper(strings.TrimSpace(key))] = strings.Trim(strings.TrimSpace(val), `"`)
	}
	return prop, true
}

func parseICalTime(prop *icalProp, loc *time.Location) (*time.Time, bool, error) {
	if prop == nil || strings.TrimSpace(prop.Value) == "" {
		return nil, false, nil
	}
	value := strings.TrimSpace(prop.Value)
	valueType := strings.ToUpper(strings.TrimSpace(prop.Params["VALUE"]))
	if valueType == "DATE" || (len(value) == 8 && !strings.Contains(value, "T")) {
		parsed, err := time.ParseInLocation("20060102", value, loc)
		if err != nil {
			return nil, true, err
		}
		utc := parsed.UTC()
		return &utc, true, nil
	}
	var parsed time.Time
	var err error
	if strings.HasSuffix(value, "Z") {
		parsed, err = time.Parse("20060102T150405Z", value)
	} else {
		parsed, err = time.ParseInLocation("20060102T150405", value, loc)
	}
	if err != nil {
		return nil, false, err
	}
	utc := parsed.UTC()
	return &utc, false, nil
}

func parseICalRRule(raw string, loc *time.Location) (*models.RecurrenceRule, *time.Time) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	rule := &models.RecurrenceRule{Interval: 1}
	var until *time.Time
	for _, part := range strings.Split(raw, ";") {
		key, value, ok := strings.Cut(part, "=")
		if !ok {
			continue
		}
		key = strings.ToUpper(strings.TrimSpace(key))
		value = strings.TrimSpace(value)
		switch key {
		case "FREQ":
			rule.Freq = strings.ToLower(value)
		case "INTERVAL":
			if n, err := strconv.Atoi(value); err == nil && n > 0 {
				rule.Interval = n
			}
		case "BYDAY":
			for _, day := range strings.Split(value, ",") {
				day = strings.ToUpper(strings.TrimSpace(day))
				if day != "" {
					rule.ByDay = append(rule.ByDay, day)
				}
			}
		case "BYMONTHDAY":
			for _, rawDay := range strings.Split(value, ",") {
				if n, err := strconv.Atoi(strings.TrimSpace(rawDay)); err == nil && n >= 1 && n <= 31 {
					rule.ByDate = append(rule.ByDate, n)
				}
			}
		case "COUNT":
			if n, err := strconv.Atoi(value); err == nil && n > 0 {
				rule.Count = n
			}
		case "UNTIL":
			prop := &icalProp{Params: map[string]string{}, Value: value}
			parsed, _, err := parseICalTime(prop, loc)
			if err == nil {
				until = parsed
			}
		}
	}
	if rule.Freq == "" {
		return nil, until
	}
	return rule, until
}

func unfoldICalLines(data string) []string {
	data = strings.ReplaceAll(data, "\r\n", "\n")
	data = strings.ReplaceAll(data, "\r", "\n")
	rawLines := strings.Split(data, "\n")
	lines := make([]string, 0, len(rawLines))
	for _, line := range rawLines {
		if line == "" {
			continue
		}
		if (strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")) && len(lines) > 0 {
			lines[len(lines)-1] += line[1:]
			continue
		}
		lines = append(lines, line)
	}
	return lines
}

func firstICalProp(props map[string][]icalProp, name string) *icalProp {
	items := props[strings.ToUpper(name)]
	if len(items) == 0 {
		return nil
	}
	return &items[0]
}

func firstICalValue(props map[string][]icalProp, name string) string {
	prop := firstICalProp(props, name)
	if prop == nil {
		return ""
	}
	return prop.Value
}

func extractFirstCalendarComponent(data string) string {
	lines := unfoldICalLines(data)
	var out []string
	inComponent := false
	for _, line := range lines {
		upper := strings.ToUpper(strings.TrimSpace(line))
		if upper == "BEGIN:VEVENT" || upper == "BEGIN:VTODO" {
			inComponent = true
		}
		if inComponent {
			out = append(out, line)
		}
		if upper == "END:VEVENT" || upper == "END:VTODO" {
			break
		}
	}
	return strings.Join(out, "\r\n")
}

func taskCalDAVUID(task *models.Task) string {
	if task == nil {
		return ""
	}
	if task.ReadOnly && strings.TrimSpace(task.ExternalRef) != "" {
		return "todo-external-" + externalCalDAVHash(task) + "@todo-app"
	}
	if strings.TrimSpace(task.CalDAVUID) != "" {
		return strings.TrimSpace(task.CalDAVUID)
	}
	return fmt.Sprintf("todo-task-%d@todo-app", task.ID)
}

func taskCalDAVHref(task *models.Task) string {
	if task == nil {
		return ""
	}
	if task.ReadOnly && strings.TrimSpace(task.ExternalRef) != "" {
		return externalCalDAVHref(task)
	}
	if strings.TrimSpace(task.CalDAVHref) != "" {
		return normalizeCalendarObjectName(task.CalDAVHref)
	}
	return fmt.Sprintf("task-%d.ics", task.ID)
}

func externalCalDAVHref(task *models.Task) string {
	return "external-" + externalCalDAVHash(task) + ".ics"
}

func isExternalCalDAVObjectName(objectName string) bool {
	objectName = strings.ToLower(normalizeCalendarObjectName(objectName))
	return strings.HasPrefix(objectName, "external-") && strings.HasSuffix(objectName, ".ics")
}

func externalCalDAVHash(task *models.Task) string {
	if task == nil {
		return ""
	}
	sourceKey := strings.TrimSpace(task.ExternalRef)
	if sourceKey == "" {
		sourceKey = fmt.Sprintf("%s:%d", strings.TrimSpace(task.Source), task.ID)
	}
	hash := sha256.Sum256([]byte(sourceKey))
	return hex.EncodeToString(hash[:])[:32]
}

func normalizeCalendarObjectName(objectName string) string {
	objectName = strings.TrimSpace(strings.TrimPrefix(objectName, "/"))
	if decoded, err := url.PathUnescape(objectName); err == nil {
		objectName = decoded
	}
	if objectName == "" {
		return ""
	}
	if !strings.HasSuffix(strings.ToLower(objectName), ".ics") {
		objectName += ".ics"
	}
	return objectName
}

func taskIDFromCalDAVHref(href string) (int64, bool) {
	href = strings.TrimSuffix(normalizeCalendarObjectName(href), ".ics")
	if !strings.HasPrefix(href, "task-") {
		return 0, false
	}
	id, err := strconv.ParseInt(strings.TrimPrefix(href, "task-"), 10, 64)
	return id, err == nil && id > 0
}

func taskIDFromCalDAVUID(uid string) (int64, bool) {
	uid = strings.TrimSpace(uid)
	if !strings.HasPrefix(uid, "todo-task-") || !strings.HasSuffix(uid, "@todo-app") {
		return 0, false
	}
	raw := strings.TrimSuffix(strings.TrimPrefix(uid, "todo-task-"), "@todo-app")
	id, err := strconv.ParseInt(raw, 10, 64)
	return id, err == nil && id > 0
}

func taskETag(task *models.Task) string {
	if task == nil {
		return `""`
	}
	hash := sha256.Sum256([]byte(taskFingerprint(task)))
	return `"` + hex.EncodeToString(hash[:])[:32] + `"`
}

func taskFingerprint(task *models.Task) string {
	if task == nil {
		return ""
	}
	start := ""
	if task.StartTime != nil {
		start = task.StartTime.UTC().Format(time.RFC3339Nano)
	}
	end := ""
	if task.EndTime != nil {
		end = task.EndTime.UTC().Format(time.RFC3339Nano)
	}
	due := ""
	if task.DueDate != nil {
		due = task.DueDate.UTC().Format(time.RFC3339Nano)
	}
	return strings.Join([]string{
		strconv.FormatInt(task.ID, 10),
		strconv.FormatInt(task.Revision, 10),
		task.UpdatedAt.UTC().Format(time.RFC3339Nano),
		taskCalDAVUID(task),
		taskCalDAVHref(task),
		strings.TrimSpace(task.ExternalRef),
		task.Title,
		task.Description,
		string(task.Status),
		strconv.FormatBool(task.AllDay),
		start,
		end,
		due,
	}, "|")
}

func shouldHideTaskFromCalendarExport(task *models.Task) bool {
	if task == nil {
		return true
	}
	return task.Status == models.TaskStatusCancelled || task.Status == models.TaskStatusSkipped || task.DeletedAt != nil
}

func isTaskCalendarEvent(task *models.Task) bool {
	return task != nil && (task.StartTime != nil || task.DueDate != nil)
}

func taskEventStart(task *models.Task) time.Time {
	if task.StartTime != nil {
		return *task.StartTime
	}
	if task.DueDate != nil {
		return *task.DueDate
	}
	return task.CreatedAt
}

func taskSortTime(task *models.Task) time.Time {
	if task == nil {
		return time.Time{}
	}
	if task.StartTime != nil {
		return task.StartTime.UTC()
	}
	if task.DueDate != nil {
		return task.DueDate.UTC()
	}
	return task.CreatedAt.UTC()
}

func taskCalendarStampTime(task *models.Task) time.Time {
	if task == nil {
		return time.Unix(0, 0).UTC()
	}
	if !task.UpdatedAt.IsZero() {
		return task.UpdatedAt.UTC()
	}
	if task.StartTime != nil {
		return task.StartTime.UTC()
	}
	if task.DueDate != nil {
		return task.DueDate.UTC()
	}
	if !task.CreatedAt.IsZero() {
		return task.CreatedAt.UTC()
	}
	return time.Unix(0, 0).UTC()
}

func taskCalendarCreatedTime(task *models.Task) time.Time {
	if task == nil {
		return time.Unix(0, 0).UTC()
	}
	if !task.CreatedAt.IsZero() {
		return task.CreatedAt.UTC()
	}
	return taskCalendarStampTime(task)
}

func taskRRuleLine(task *models.Task) string {
	if task == nil || task.RecurrenceRule == nil {
		return ""
	}
	start := task.StartTime
	if start == nil {
		start = task.DueDate
	}
	raw := buildRRuleString(task.RecurrenceRule, start, task.RecurrenceEndDate)
	for _, line := range strings.Split(raw, "\n") {
		if strings.HasPrefix(strings.ToUpper(line), "RRULE:") {
			return strings.TrimSpace(line)
		}
	}
	return ""
}

func taskCategoriesLine(task *models.Task) string {
	if task == nil || len(task.Categories) == 0 {
		return ""
	}
	values := make([]string, 0, len(task.Categories))
	for _, cat := range task.Categories {
		name := strings.TrimSpace(cat.Name)
		if name != "" {
			values = append(values, escapeICalText(name))
		}
	}
	if len(values) == 0 {
		return ""
	}
	return "CATEGORIES:" + strings.Join(values, ",")
}

func formatICalDate(t time.Time, loc *time.Location) string {
	return t.In(loc).Format("20060102")
}

func escapeICalText(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	value = strings.ReplaceAll(value, "\n", `\n`)
	value = strings.ReplaceAll(value, ";", `\;`)
	value = strings.ReplaceAll(value, ",", `\,`)
	return value
}

func unescapeICalText(value string) string {
	var b strings.Builder
	escaped := false
	for _, r := range value {
		if escaped {
			switch r {
			case 'n', 'N':
				b.WriteByte('\n')
			default:
				b.WriteRune(r)
			}
			escaped = false
			continue
		}
		if r == '\\' {
			escaped = true
			continue
		}
		b.WriteRune(r)
	}
	if escaped {
		b.WriteRune('\\')
	}
	return b.String()
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
