package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/xml"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/repository"

	rrule "github.com/teambition/rrule-go"
)

const caldavSourceName = "caldav"

type CaldavService struct {
	repo       *repository.CaldavRepository
	httpClient *http.Client
	secret     string
}

func NewCaldavService(repo *repository.CaldavRepository, secret string) *CaldavService {
	return &CaldavService{
		repo: repo,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		secret: secret,
	}
}

func (s *CaldavService) DiscoverCalendars(ctx context.Context, req *models.CaldavDiscoverRequest) ([]models.CaldavCalendarChoice, error) {
	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		return nil, errors.New("base_url is required")
	}

	data, err := s.doPropfindCalendars(ctx, baseURL, req.Username, req.Password)
	if err != nil {
		return nil, err
	}
	var out []models.CaldavCalendarChoice
	for _, cal := range data {
		out = append(out, models.CaldavCalendarChoice{
			CalendarURL: cal.Href,
			DisplayName: cal.DisplayName,
			Color:       cal.Color,
		})
	}
	if len(out) == 0 {
		return nil, errors.New("no calendars discovered")
	}
	return out, nil
}

func (s *CaldavService) ListSources(userID int64) ([]models.CaldavSourceResponse, error) {
	sources, err := s.repo.ListSourcesByUser(userID)
	if err != nil {
		return nil, err
	}
	out := make([]models.CaldavSourceResponse, 0, len(sources))
	for _, source := range sources {
		calendars, err := s.repo.ListCalendarsBySource(userID, source.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, sourceToResponse(source, calendars))
	}
	return out, nil
}

func (s *CaldavService) CreateSource(ctx context.Context, userID int64, req *models.CaldavUpsertSourceRequest) (*models.CaldavSourceResponse, error) {
	baseURL := strings.TrimSpace(req.BaseURL)
	username := strings.TrimSpace(req.Username)
	password := strings.TrimSpace(req.Password)
	if baseURL == "" || username == "" || password == "" {
		return nil, errors.New("base_url, username, password are required")
	}
	cipherText, err := encryptSecret(password, s.secret)
	if err != nil {
		return nil, err
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	source := &models.CaldavSource{
		UserID:      userID,
		Name:        strings.TrimSpace(req.Name),
		BaseURL:     baseURL,
		Username:    username,
		PasswordEnc: cipherText,
		IsActive:    active,
	}
	if err := s.repo.CreateSource(source); err != nil {
		return nil, err
	}
	calendars := choicesToCalendars(req.Calendars)
	if err := s.repo.ReplaceCalendars(userID, source.ID, calendars); err != nil {
		return nil, err
	}
	if active {
		if err := s.SyncSourceNow(ctx, userID, source.ID); err != nil {
			return nil, fmt.Errorf("source saved but initial sync failed: %w", err)
		}
	}
	created, err := s.repo.GetSourceByID(userID, source.ID)
	if err != nil {
		return nil, err
	}
	cals, err := s.repo.ListCalendarsBySource(userID, source.ID)
	if err != nil {
		return nil, err
	}
	resp := sourceToResponse(*created, cals)
	return &resp, nil
}

func (s *CaldavService) UpdateSource(ctx context.Context, userID, sourceID int64, req *models.CaldavUpsertSourceRequest) (*models.CaldavSourceResponse, error) {
	source, err := s.repo.GetSourceByID(userID, sourceID)
	if err != nil {
		return nil, err
	}
	baseURL := strings.TrimSpace(req.BaseURL)
	username := strings.TrimSpace(req.Username)
	password := strings.TrimSpace(req.Password)
	if baseURL == "" || username == "" || password == "" {
		return nil, errors.New("base_url, username, password are required")
	}
	cipherText, err := encryptSecret(password, s.secret)
	if err != nil {
		return nil, err
	}
	source.Name = strings.TrimSpace(req.Name)
	source.BaseURL = baseURL
	source.Username = username
	source.PasswordEnc = cipherText
	if req.IsActive != nil {
		source.IsActive = *req.IsActive
	}
	if err := s.repo.UpdateSource(source); err != nil {
		return nil, err
	}
	calendars := choicesToCalendars(req.Calendars)
	if err := s.repo.ReplaceCalendars(userID, sourceID, calendars); err != nil {
		return nil, err
	}
	if source.IsActive {
		if err := s.SyncSourceNow(ctx, userID, sourceID); err != nil {
			return nil, fmt.Errorf("source updated but sync failed: %w", err)
		}
	}
	updated, err := s.repo.GetSourceByID(userID, sourceID)
	if err != nil {
		return nil, err
	}
	cals, err := s.repo.ListCalendarsBySource(userID, sourceID)
	if err != nil {
		return nil, err
	}
	resp := sourceToResponse(*updated, cals)
	return &resp, nil
}

func (s *CaldavService) DeleteSource(userID, sourceID int64) error {
	return s.repo.DeleteSourceCascade(userID, sourceID)
}

func (s *CaldavService) SyncSourceNow(ctx context.Context, userID, sourceID int64) error {
	source, err := s.repo.GetSourceByID(userID, sourceID)
	if err != nil {
		return err
	}
	if !source.IsActive {
		return nil
	}
	password, err := decryptSecret(source.PasswordEnc, s.secret)
	if err != nil {
		source.LastError = "failed to decrypt credentials"
		_ = s.repo.UpdateSource(source)
		return err
	}
	calendars, err := s.repo.ListSelectedCalendarsBySource(userID, sourceID)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	var syncErr error
	for _, cal := range calendars {
		err := s.syncCalendarCache(ctx, source, password, &cal)
		if err != nil {
			syncErr = err
			cal.LastError = err.Error()
		} else {
			cal.LastError = ""
			cal.LastSyncAt = &now
		}
		_ = s.repo.UpdateCalendar(&cal)
	}
	source.LastSyncAt = &now
	if syncErr != nil {
		source.LastError = syncErr.Error()
	} else {
		source.LastError = ""
	}
	_ = s.repo.UpdateSource(source)
	return syncErr
}

func (s *CaldavService) SyncAllActiveSources(ctx context.Context) error {
	all, err := s.repo.ListAllSources()
	if err != nil {
		return err
	}
	if len(all) == 0 {
		return nil
	}
	for i := range all {
		if !all[i].IsActive {
			continue
		}
		_ = s.SyncSourceNow(ctx, all[i].UserID, all[i].ID)
	}
	return nil
}

func (s *CaldavService) ListReadOnlyTasks(userID int64, start, end time.Time) ([]models.Task, error) {
	events, err := s.repo.ListEventsInRange(userID, start, end)
	if err != nil {
		return nil, err
	}
	out := make([]models.Task, 0, len(events))
	for _, ev := range events {
		id := externalVirtualID(ev.SourceID, ev.CalendarID, ev.EventUID, ev.RecurrenceID)
		status := models.TaskStatusPending
		if strings.EqualFold(ev.Status, "cancelled") {
			status = models.TaskStatusCancelled
		}
		startTime := ev.StartTime
		task := models.Task{
			ID:          id,
			UserID:      userID,
			Title:       ev.Title,
			Description: ev.Description,
			Status:      status,
			Priority:    models.PriorityMedium,
			StartTime:   &startTime,
			EndTime:     ev.EndTime,
			AllDay:      ev.AllDay,
			ReadOnly:    true,
			Source:      caldavSourceName,
			ExternalRef: fmt.Sprintf("%d:%d:%s:%s", ev.SourceID, ev.CalendarID, ev.EventUID, ev.RecurrenceID),
		}
		out = append(out, task)
	}
	return out, nil
}

func (s *CaldavService) ListReadOnlyTasksWithDebug(userID int64, start, end time.Time) ([]models.Task, *models.CaldavFetchDebug, error) {
	events, err := s.repo.ListEventsInRange(userID, start, end)
	if err != nil {
		return nil, nil, err
	}
	out := make([]models.Task, 0, len(events))
	for _, ev := range events {
		id := externalVirtualID(ev.SourceID, ev.CalendarID, ev.EventUID, ev.RecurrenceID)
		status := models.TaskStatusPending
		if strings.EqualFold(ev.Status, "cancelled") {
			status = models.TaskStatusCancelled
		}
		startTime := ev.StartTime
		task := models.Task{
			ID:          id,
			UserID:      userID,
			Title:       ev.Title,
			Description: ev.Description,
			Status:      status,
			Priority:    models.PriorityMedium,
			StartTime:   &startTime,
			EndTime:     ev.EndTime,
			AllDay:      ev.AllDay,
			ReadOnly:    true,
			Source:      caldavSourceName,
			ExternalRef: fmt.Sprintf("%d:%d:%s:%s", ev.SourceID, ev.CalendarID, ev.EventUID, ev.RecurrenceID),
		}
		out = append(out, task)
	}
	return out, &models.CaldavFetchDebug{
		AttemptedCalendars:  0,
		SuccessfulCalendars: 0,
		EventCount:          len(out),
		Messages:            []string{"served from local cache"},
	}, nil
}

func (s *CaldavService) ListCalendarEvents(userID int64, start, end time.Time) ([]models.CalendarEvent, error) {
	events, err := s.repo.ListEventsInRange(userID, start, end)
	if err != nil {
		return nil, err
	}
	out := make([]models.CalendarEvent, 0, len(events))
	for _, ev := range events {
		id := externalVirtualID(ev.SourceID, ev.CalendarID, ev.EventUID, ev.RecurrenceID)
		taskStatus := models.TaskStatusPending
		if strings.EqualFold(ev.Status, "cancelled") {
			taskStatus = models.TaskStatusCancelled
		}
		item := models.CalendarEvent{
			ID:       fmt.Sprintf("caldav-%d", id),
			Title:    ev.Title,
			Start:    ev.StartTime.Format(time.RFC3339),
			AllDay:   ev.AllDay,
			Editable: false,
			ExtendedProps: models.ExtendedProps{
				TaskID:      id,
				Description: ev.Description,
				Priority:    models.PriorityMedium,
				Status:      taskStatus,
				IsRecurring: false,
				ReadOnly:    true,
				Source:      caldavSourceName,
				ExternalID:  fmt.Sprintf("%d:%d:%s:%s", ev.SourceID, ev.CalendarID, ev.EventUID, ev.RecurrenceID),
				Location:    strings.TrimSpace(ev.Location),
				Organizer:   strings.TrimSpace(ev.Organizer),
				Attendees:   splitCaldavAttendees(ev.Attendees),
				MeetingLink: strings.TrimSpace(ev.MeetingLink),
			},
			BackgroundColor: "#64748b",
			BorderColor:     "#64748b",
		}
		if ev.EndTime != nil {
			item.End = ev.EndTime.Format(time.RFC3339)
		}
		out = append(out, item)
	}
	return out, nil
}

func (s *CaldavService) syncCalendarCache(ctx context.Context, source *models.CaldavSource, password string, calendar *models.CaldavCalendar) error {
	if token := strings.TrimSpace(calendar.SyncToken); token != "" {
		changed, removed, nextToken, err := s.syncCalendarIncremental(ctx, source, password, calendar, token)
		if err == nil {
			if len(removed) > 0 {
				if delErr := s.repo.DeleteEventsByHrefs(source.UserID, source.ID, calendar.ID, removed); delErr != nil {
					return delErr
				}
			}
			for href, events := range changed {
				if err := s.repo.DeleteEventsByHref(source.UserID, source.ID, calendar.ID, href); err != nil {
					return err
				}
				for i := range events {
					event := events[i]
					event.UserID = source.UserID
					event.SourceID = source.ID
					event.CalendarID = calendar.ID
					event.RawHref = href
					if err := s.repo.UpsertEvent(&event); err != nil {
						return err
					}
				}
			}
			if nextToken != "" {
				calendar.SyncToken = nextToken
			}
			return nil
		}
		if !isSyncTokenRecoverableError(err) {
			return err
		}
	}

	remoteCTag, remoteSyncToken, stateErr := s.fetchCalendarState(ctx, source, password, calendar.CalendarURL)
	if stateErr == nil && remoteCTag != "" && remoteCTag == strings.TrimSpace(calendar.CTag) {
		calendar.SyncToken = remoteSyncToken
		return nil
	}

	items, _, err := s.fetchCalendarRemoteEvents(ctx, source, password, calendar, time.Time{}, time.Time{}, false)
	if err != nil {
		return err
	}
	keepKeys := make([]string, 0, len(items))
	for _, item := range items {
		if item.EventUID == "" {
			continue
		}
		event := item
		event.UserID = source.UserID
		event.SourceID = source.ID
		event.CalendarID = calendar.ID
		if err := s.repo.UpsertEvent(&event); err != nil {
			return err
		}
		keepKeys = append(keepKeys, event.EventUID+"|"+strings.TrimSpace(event.RecurrenceID))
	}
	if err := s.repo.DeleteEventsNotInSet(source.UserID, source.ID, calendar.ID, keepKeys); err != nil {
		return err
	}
	if remoteCTag != "" {
		calendar.CTag = remoteCTag
	}
	if remoteSyncToken != "" {
		calendar.SyncToken = remoteSyncToken
	}
	return nil
}

func (s *CaldavService) syncCalendarIncremental(
	ctx context.Context,
	source *models.CaldavSource,
	password string,
	calendar *models.CaldavCalendar,
	syncToken string,
) (map[string][]models.CaldavEventCache, []string, string, error) {
	reportBody := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<d:sync-collection xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:sync-token>%s</d:sync-token>
  <d:sync-level>1</d:sync-level>
  <d:prop>
    <d:getetag/>
    <d:getlastmodified/>
    <c:calendar-data/>
  </d:prop>
</d:sync-collection>`, xmlEscape(syncToken))

	req, err := http.NewRequestWithContext(ctx, "REPORT", calendar.CalendarURL, strings.NewReader(reportBody))
	if err != nil {
		return nil, nil, "", err
	}
	req.SetBasicAuth(source.Username, password)
	req.Header.Set("Depth", "1")
	req.Header.Set("Content-Type", "application/xml; charset=utf-8")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, nil, "", fmt.Errorf("sync-collection failed: %s (%s)", resp.Status, strings.TrimSpace(string(raw)))
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, "", err
	}
	var parsed multistatus
	if err := xml.Unmarshal(raw, &parsed); err != nil {
		return nil, nil, "", err
	}

	changed := make(map[string][]models.CaldavEventCache)
	removed := make([]string, 0)
	needMultiGet := make([]string, 0)

	for _, response := range parsed.Responses {
		href := strings.TrimSpace(response.Href)
		if href == "" {
			continue
		}
		if parseHTTPStatusCode(response.Status) == http.StatusNotFound {
			removed = append(removed, href)
			continue
		}

		itemSet := make([]models.CaldavEventCache, 0, 4)
		for _, propStat := range response.PropStat {
			statusCode := parseHTTPStatusCode(propStat.Status)
			if statusCode == http.StatusNotFound {
				removed = append(removed, href)
				itemSet = nil
				break
			}
			if statusCode != 0 && statusCode >= 300 {
				continue
			}
			data := strings.TrimSpace(propStat.Prop.CalendarData)
			if data == "" {
				needMultiGet = append(needMultiGet, href)
				continue
			}
			itemSet = append(itemSet, parseICSDataToEvents(source, calendar.ID, href, data, propStat.Prop.GetEtag, propStat.Prop.LastModified)...)
		}
		if itemSet != nil {
			changed[href] = dedupeEventCacheItems(itemSet)
		}
	}

	if len(needMultiGet) > 0 {
		if mgParsed, mgErr := s.calendarMultiGet(ctx, source.Username, password, calendar.CalendarURL, needMultiGet); mgErr == nil && mgParsed != nil {
			for _, response := range mgParsed.Responses {
				href := strings.TrimSpace(response.Href)
				if href == "" {
					continue
				}
				itemSet := make([]models.CaldavEventCache, 0, 4)
				for _, propStat := range response.PropStat {
					data := strings.TrimSpace(propStat.Prop.CalendarData)
					if data == "" {
						continue
					}
					itemSet = append(itemSet, parseICSDataToEvents(source, calendar.ID, href, data, propStat.Prop.GetEtag, propStat.Prop.LastModified)...)
				}
				changed[href] = dedupeEventCacheItems(itemSet)
			}
		}
	}

	return changed, dedupeStrings(removed), strings.TrimSpace(parsed.SyncToken), nil
}

func (s *CaldavService) fetchCalendarState(ctx context.Context, source *models.CaldavSource, password, calendarURL string) (string, string, error) {
	body := `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <cs:getctag/>
    <d:sync-token/>
  </d:prop>
</d:propfind>`
	parsed, err := s.propfindMultiStatus(ctx, calendarURL, source.Username, password, "0", body)
	if err != nil {
		return "", "", err
	}
	for _, response := range parsed.Responses {
		for _, propStat := range response.PropStat {
			ctag := strings.TrimSpace(propStat.Prop.GetCTag)
			token := strings.TrimSpace(propStat.Prop.SyncToken)
			if ctag != "" || token != "" {
				return ctag, token, nil
			}
		}
	}
	return "", "", errors.New("missing ctag and sync-token")
}

func isSyncTokenRecoverableError(err error) bool {
	if err == nil {
		return false
	}
	raw := strings.ToLower(err.Error())
	if strings.Contains(raw, "410") || strings.Contains(raw, "invalid sync") || strings.Contains(raw, "token") {
		return true
	}
	return strings.Contains(raw, "sync-collection failed")
}

func parseICSDataToEvents(source *models.CaldavSource, calendarID int64, href, calendarData, etag, lastModified string) []models.CaldavEventCache {
	parsedEvents := parseICSCalendarData(calendarData)
	out := make([]models.CaldavEventCache, 0, len(parsedEvents))
	for _, item := range expandParsedEvents(parsedEvents, time.Time{}, time.Time{}, false) {
		if item.UID == "" || item.Start.IsZero() {
			continue
		}
		event := models.CaldavEventCache{
			UserID:       source.UserID,
			SourceID:     source.ID,
			CalendarID:   calendarID,
			EventUID:     item.UID,
			RecurrenceID: strings.TrimSpace(item.RecurrenceID),
			Title:        item.Summary,
			Description:  item.Description,
			Location:     item.Location,
			Organizer:    item.Organizer,
			Attendees:    strings.Join(item.Attendees, "\n"),
			MeetingLink:  extractMeetingURL(item.URL, item.Description),
			StartTime:    item.Start.UTC(),
			AllDay:       item.AllDay,
			Status:       item.Status,
			Etag:         strings.TrimSpace(etag),
			RawHref:      href,
		}
		if !item.End.IsZero() {
			endUTC := item.End.UTC()
			event.EndTime = &endUTC
		}
		if lm := parseHTTPTime(lastModified); lm != nil {
			event.LastModified = lm
		}
		out = append(out, event)
	}
	return out
}

func dedupeEventCacheItems(input []models.CaldavEventCache) []models.CaldavEventCache {
	if len(input) == 0 {
		return input
	}
	type key struct {
		uid string
		rid string
	}
	seen := make(map[key]int, len(input))
	out := make([]models.CaldavEventCache, 0, len(input))
	for _, item := range input {
		k := key{uid: strings.TrimSpace(item.EventUID), rid: strings.TrimSpace(item.RecurrenceID)}
		if k.uid == "" {
			continue
		}
		if idx, ok := seen[k]; ok {
			out[idx] = item
			continue
		}
		seen[k] = len(out)
		out = append(out, item)
	}
	return out
}

func parseHTTPStatusCode(statusLine string) int {
	raw := strings.TrimSpace(statusLine)
	if raw == "" {
		return 0
	}
	parts := strings.Fields(raw)
	if len(parts) < 2 {
		return 0
	}
	code, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0
	}
	return code
}

type discoveredCalendar struct {
	Href        string
	DisplayName string
	Color       string
}

type multistatus struct {
	SyncToken string        `xml:"sync-token"`
	Responses []responseXML `xml:"response"`
}

type responseXML struct {
	Status   string    `xml:"status"`
	Href     string    `xml:"href"`
	PropStat []propXML `xml:"propstat"`
}

type propXML struct {
	Status string   `xml:"status"`
	Prop   propBody `xml:"prop"`
}

type propBody struct {
	DisplayName          string `xml:"displayname"`
	CalendarData         string `xml:"calendar-data"`
	GetEtag              string `xml:"getetag"`
	GetCTag              string `xml:"getctag"`
	SyncToken            string `xml:"sync-token"`
	LastModified         string `xml:"getlastmodified"`
	CurrentUserPrincipal struct {
		Href string `xml:"href"`
	} `xml:"current-user-principal"`
	CalendarHomeSet struct {
		Href string `xml:"href"`
	} `xml:"calendar-home-set"`
	ResourceType struct {
		Calendar *struct{} `xml:"calendar"`
	} `xml:"resourcetype"`
	CalendarColor string `xml:"calendar-color"`
}

func (s *CaldavService) doPropfindCalendars(ctx context.Context, baseURL, username, password string) ([]discoveredCalendar, error) {
	discoverBody := `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:current-user-principal/>
    <d:principal-URL/>
    <cs:calendar-home-set/>
    <d:displayname/>
    <d:resourcetype/>
    <cs:calendar-color/>
  </d:prop>
</d:propfind>`
	candidateBases := make([]string, 0, 3)
	candidateBases = append(candidateBases, strings.TrimSpace(baseURL))
	if parsedBase, err := url.Parse(strings.TrimSpace(baseURL)); err == nil && parsedBase.Scheme != "" && parsedBase.Host != "" {
		candidateBases = append(candidateBases, fmt.Sprintf("%s://%s/.well-known/caldav", parsedBase.Scheme, parsedBase.Host))
	}
	candidateBases = dedupeStrings(candidateBases)

	homeCandidates := make([]string, 0, 8)
	discoveryAttempts := make([]string, 0, 8)
	for _, candidate := range candidateBases {
		parsed, err := s.propfindMultiStatus(ctx, candidate, username, password, "1", discoverBody)
		if err != nil {
			discoveryAttempts = append(discoveryAttempts, fmt.Sprintf("discover[%s]: %v", candidate, err))
			continue
		}
		discoveryAttempts = append(discoveryAttempts, fmt.Sprintf("discover[%s]: ok", candidate))
		base, _ := url.Parse(candidate)
		for _, response := range parsed.Responses {
			for _, propStat := range response.PropStat {
				if propStat.Prop.CurrentUserPrincipal.Href != "" {
					homeCandidates = append(homeCandidates, resolveAgainstBase(base, propStat.Prop.CurrentUserPrincipal.Href))
				}
				if propStat.Prop.CalendarHomeSet.Href != "" {
					homeCandidates = append(homeCandidates, resolveAgainstBase(base, propStat.Prop.CalendarHomeSet.Href))
				}
				if propStat.Prop.ResourceType.Calendar != nil {
					homeCandidates = append(homeCandidates, resolveAgainstBase(base, response.Href))
				}
			}
		}
		homeCandidates = append(homeCandidates, candidate)
	}
	homeCandidates = dedupeStrings(homeCandidates)
	if len(homeCandidates) == 0 {
		return nil, errors.New("caldav discovery failed: no reachable endpoint; " + compactAttempts(discoveryAttempts))
	}

	collectBody := `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <cs:calendar-color/>
  </d:prop>
</d:propfind>`

	found := make(map[string]discoveredCalendar)
	collectAttempts := make([]string, 0, len(homeCandidates))
	for _, home := range homeCandidates {
		parsed, err := s.propfindMultiStatus(ctx, home, username, password, "1", collectBody)
		if err != nil {
			collectAttempts = append(collectAttempts, fmt.Sprintf("collect[%s]: %v", home, err))
			continue
		}
		base, _ := url.Parse(home)
		before := len(found)
		for _, response := range parsed.Responses {
			for _, propStat := range response.PropStat {
				if propStat.Prop.ResourceType.Calendar == nil {
					continue
				}
				href := resolveAgainstBase(base, response.Href)
				if href == "" {
					continue
				}
				if _, ok := found[href]; ok {
					continue
				}
				found[href] = discoveredCalendar{
					Href:        href,
					DisplayName: strings.TrimSpace(propStat.Prop.DisplayName),
					Color:       strings.TrimSpace(propStat.Prop.CalendarColor),
				}
			}
		}
		added := len(found) - before
		collectAttempts = append(collectAttempts, fmt.Sprintf("collect[%s]: ok, +%d calendars", home, added))
	}

	out := make([]discoveredCalendar, 0, len(found))
	for _, item := range found {
		out = append(out, item)
	}
	if len(out) == 0 {
		return nil, errors.New("no calendars discovered; " + compactAttempts(append(discoveryAttempts, collectAttempts...)))
	}
	return out, nil
}

func (s *CaldavService) propfindMultiStatus(ctx context.Context, targetURL, username, password, depth, body string) (*multistatus, error) {
	req, err := http.NewRequestWithContext(ctx, "PROPFIND", targetURL, strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(username, password)
	req.Header.Set("Depth", depth)
	req.Header.Set("Content-Type", "application/xml; charset=utf-8")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("%s (%s)", resp.Status, strings.TrimSpace(string(raw)))
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var parsed multistatus
	if err := xml.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	return &parsed, nil
}

func resolveAgainstBase(base *url.URL, href string) string {
	value := strings.TrimSpace(href)
	if value == "" {
		return ""
	}
	if base == nil {
		return value
	}
	rel, err := base.Parse(value)
	if err != nil {
		return value
	}
	return rel.String()
}

func dedupeStrings(input []string) []string {
	seen := make(map[string]struct{}, len(input))
	out := make([]string, 0, len(input))
	for _, value := range input {
		key := strings.TrimSpace(value)
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, key)
	}
	return out
}

func compactAttempts(items []string) string {
	if len(items) == 0 {
		return "no attempt details"
	}
	const limit = 8
	if len(items) <= limit {
		return strings.Join(items, "; ")
	}
	head := strings.Join(items[:limit], "; ")
	return fmt.Sprintf("%s; ... and %d more", head, len(items)-limit)
}

func (s *CaldavService) fetchUserEventsDetailed(ctx context.Context, userID int64, start, end time.Time) ([]models.CaldavEventCache, *models.CaldavFetchDebug, error) {
	sources, err := s.repo.ListSourcesByUser(userID)
	if err != nil {
		return nil, nil, err
	}
	debug := &models.CaldavFetchDebug{
		Messages: make([]string, 0, 8),
	}
	all := make([]models.CaldavEventCache, 0, 128)
	for _, source := range sources {
		if !source.IsActive {
			continue
		}
		password, err := decryptSecret(source.PasswordEnc, s.secret)
		if err != nil {
			debug.Messages = append(debug.Messages, fmt.Sprintf("source %d decrypt failed: %v", source.ID, err))
			continue
		}
		calendars, err := s.repo.ListSelectedCalendarsBySource(userID, source.ID)
		if err != nil {
			debug.Messages = append(debug.Messages, fmt.Sprintf("source %d list calendars failed: %v", source.ID, err))
			continue
		}
		for i := range calendars {
			debug.AttemptedCalendars += 1
			items, detail, err := s.fetchCalendarRemoteEvents(ctx, &source, password, &calendars[i], start, end, true)
			if err != nil {
				now := time.Now().UTC()
				calendars[i].LastError = err.Error()
				calendars[i].LastSyncAt = &now
				_ = s.repo.UpdateCalendar(&calendars[i])
				debug.Messages = append(debug.Messages, fmt.Sprintf("calendar %s failed: %v", calendars[i].CalendarURL, err))
				continue
			}
			debug.SuccessfulCalendars += 1
			debug.EventCount += len(items)
			if detail != "" {
				debug.Messages = append(debug.Messages, fmt.Sprintf("calendar %s ok: %d events (%s)", calendars[i].CalendarURL, len(items), detail))
			} else {
				debug.Messages = append(debug.Messages, fmt.Sprintf("calendar %s ok: %d events", calendars[i].CalendarURL, len(items)))
			}
			now := time.Now().UTC()
			calendars[i].LastError = ""
			calendars[i].LastSyncAt = &now
			_ = s.repo.UpdateCalendar(&calendars[i])
			all = append(all, items...)
		}
	}
	if debug.AttemptedCalendars == 0 {
		return all, debug, errors.New("no selected calendars found for active sources")
	}
	if debug.SuccessfulCalendars == 0 {
		return all, debug, errors.New("all calendar fetch attempts failed: " + compactAttempts(debug.Messages))
	}
	return all, debug, nil
}

func (s *CaldavService) fetchCalendarRemoteEvents(ctx context.Context, source *models.CaldavSource, password string, calendar *models.CaldavCalendar, start, end time.Time, applyRange bool) ([]models.CaldavEventCache, string, error) {
	items, detail, err := s.fetchCalendarRemoteEventsAtURL(ctx, source, password, calendar.ID, calendar.CalendarURL, start, end, applyRange)
	if err != nil {
		return nil, "", err
	}
	trimmed := strings.TrimSpace(calendar.CalendarURL)
	if len(items) == 0 && trimmed != "" && !strings.HasSuffix(trimmed, "/") {
		fallbackURL := trimmed + "/"
		retried, retryDetail, retryErr := s.fetchCalendarRemoteEventsAtURL(ctx, source, password, calendar.ID, fallbackURL, start, end, applyRange)
		if retryErr == nil && len(retried) > 0 {
			return retried, retryDetail, nil
		}
	}
	return items, detail, nil
}

func (s *CaldavService) fetchCalendarRemoteEventsAtURL(ctx context.Context, source *models.CaldavSource, password string, calendarID int64, calendarURL string, start, end time.Time, applyRange bool) ([]models.CaldavEventCache, string, error) {
	startUTC := start.UTC()
	endUTC := end.UTC()
	useRange := applyRange && !startUTC.IsZero() && !endUTC.IsZero() && endUTC.After(startUTC)
	filter := `<c:filter>
    <c:comp-filter name="VCALENDAR"/>
  </c:filter>`
	if useRange {
		filter = fmt.Sprintf(`<c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="%s" end="%s"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>`, formatCalDAVTime(startUTC), formatCalDAVTime(endUTC))
	}
	body := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <d:getlastmodified/>
    <c:calendar-data/>
  </d:prop>
  %s
</c:calendar-query>`, filter)
	req, err := http.NewRequestWithContext(ctx, "REPORT", calendarURL, strings.NewReader(body))
	if err != nil {
		return nil, "", err
	}
	req.SetBasicAuth(source.Username, password)
	req.Header.Set("Depth", "1")
	req.Header.Set("Content-Type", "application/xml; charset=utf-8")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, "", fmt.Errorf("calendar sync failed: %s (%s)", resp.Status, strings.TrimSpace(string(raw)))
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	var parsed multistatus
	if err := xml.Unmarshal(raw, &parsed); err != nil {
		return nil, "", err
	}
	hrefs := collectResponseHrefs(&parsed)
	items := make([]models.CaldavEventCache, 0, 256)
	calendarDataBlocks := 0
	for _, response := range parsed.Responses {
		href := strings.TrimSpace(response.Href)
		for _, prop := range response.PropStat {
			data := strings.TrimSpace(prop.Prop.CalendarData)
			if data == "" {
				continue
			}
			calendarDataBlocks += 1
			events := expandParsedEvents(parseICSCalendarData(data), startUTC, endUTC, useRange)
			for _, item := range events {
				if item.UID == "" || item.Start.IsZero() {
					continue
				}
				recurrenceID := strings.TrimSpace(item.RecurrenceID)
				endTime := item.End
				event := models.CaldavEventCache{
					UserID:       source.UserID,
					SourceID:     source.ID,
					CalendarID:   calendarID,
					EventUID:     item.UID,
					RecurrenceID: recurrenceID,
					Title:        item.Summary,
					Description:  item.Description,
					Location:     item.Location,
					Organizer:    item.Organizer,
					Attendees:    strings.Join(item.Attendees, "\n"),
					MeetingLink:  extractMeetingURL(item.URL, item.Description),
					StartTime:    item.Start.UTC(),
					AllDay:       item.AllDay,
					Status:       item.Status,
					Etag:         strings.TrimSpace(prop.Prop.GetEtag),
					RawHref:      href,
				}
				if !endTime.IsZero() {
					endUTC := endTime.UTC()
					event.EndTime = &endUTC
				}
				if lm := parseHTTPTime(prop.Prop.LastModified); lm != nil {
					event.LastModified = lm
				}
				if useRange {
					if !event.StartTime.Before(endUTC) {
						continue
					}
					if event.EndTime != nil {
						if !event.EndTime.After(startUTC) {
							continue
						}
					} else if event.StartTime.Before(startUTC) {
						continue
					}
				}
				items = append(items, event)
			}
		}
	}
	if calendarDataBlocks == 0 && len(hrefs) > 0 {
		multiParsed, multiErr := s.calendarMultiGet(ctx, source.Username, password, calendarURL, hrefs)
		if multiErr == nil {
			items = make([]models.CaldavEventCache, 0, 256)
			calendarDataBlocks = 0
			for _, response := range multiParsed.Responses {
				href := strings.TrimSpace(response.Href)
				for _, prop := range response.PropStat {
					data := strings.TrimSpace(prop.Prop.CalendarData)
					if data == "" {
						continue
					}
					calendarDataBlocks += 1
					events := expandParsedEvents(parseICSCalendarData(data), startUTC, endUTC, useRange)
					for _, item := range events {
						if item.UID == "" || item.Start.IsZero() {
							continue
						}
						recurrenceID := strings.TrimSpace(item.RecurrenceID)
						endTime := item.End
						event := models.CaldavEventCache{
							UserID:       source.UserID,
							SourceID:     source.ID,
							CalendarID:   calendarID,
							EventUID:     item.UID,
							RecurrenceID: recurrenceID,
							Title:        item.Summary,
							Description:  item.Description,
							Location:     item.Location,
							Organizer:    item.Organizer,
							Attendees:    strings.Join(item.Attendees, "\n"),
							MeetingLink:  extractMeetingURL(item.URL, item.Description),
							StartTime:    item.Start.UTC(),
							AllDay:       item.AllDay,
							Status:       item.Status,
							Etag:         strings.TrimSpace(prop.Prop.GetEtag),
							RawHref:      href,
						}
						if !endTime.IsZero() {
							endUTC := endTime.UTC()
							event.EndTime = &endUTC
						}
						if lm := parseHTTPTime(prop.Prop.LastModified); lm != nil {
							event.LastModified = lm
						}
						if useRange {
							if !event.StartTime.Before(endUTC) {
								continue
							}
							if event.EndTime != nil {
								if !event.EndTime.After(startUTC) {
									continue
								}
							} else if event.StartTime.Before(startUTC) {
								continue
							}
						}
						items = append(items, event)
					}
				}
			}
		}
	}
	detail := fmt.Sprintf("responses=%d calendar_data=%d parsed=%d", len(parsed.Responses), calendarDataBlocks, len(items))
	return items, detail, nil
}

func collectResponseHrefs(parsed *multistatus) []string {
	if parsed == nil {
		return nil
	}
	hrefs := make([]string, 0, len(parsed.Responses))
	seen := make(map[string]struct{}, len(parsed.Responses))
	for _, response := range parsed.Responses {
		href := strings.TrimSpace(response.Href)
		if href == "" {
			continue
		}
		if _, ok := seen[href]; ok {
			continue
		}
		seen[href] = struct{}{}
		hrefs = append(hrefs, href)
	}
	return hrefs
}

func (s *CaldavService) calendarMultiGet(ctx context.Context, username, password, calendarURL string, hrefs []string) (*multistatus, error) {
	var builder strings.Builder
	builder.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	builder.WriteString(`<c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">`)
	builder.WriteString(`<d:prop><d:getetag/><d:getlastmodified/><c:calendar-data/></d:prop>`)
	for _, href := range hrefs {
		trimmed := strings.TrimSpace(href)
		if trimmed == "" {
			continue
		}
		builder.WriteString("<d:href>")
		builder.WriteString(xmlEscape(trimmed))
		builder.WriteString("</d:href>")
	}
	builder.WriteString(`</c:calendar-multiget>`)

	req, err := http.NewRequestWithContext(ctx, "REPORT", calendarURL, strings.NewReader(builder.String()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(username, password)
	req.Header.Set("Depth", "1")
	req.Header.Set("Content-Type", "application/xml; charset=utf-8")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("calendar-multiget failed: %s (%s)", resp.Status, strings.TrimSpace(string(raw)))
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var parsed multistatus
	if err := xml.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	return &parsed, nil
}

func xmlEscape(input string) string {
	escaped := strings.ReplaceAll(input, "&", "&amp;")
	escaped = strings.ReplaceAll(escaped, "<", "&lt;")
	escaped = strings.ReplaceAll(escaped, ">", "&gt;")
	escaped = strings.ReplaceAll(escaped, `"`, "&quot;")
	escaped = strings.ReplaceAll(escaped, `'`, "&apos;")
	return escaped
}

func parseHTTPTime(input string) *time.Time {
	raw := strings.TrimSpace(input)
	if raw == "" {
		return nil
	}
	t, err := time.Parse(time.RFC1123, raw)
	if err != nil {
		return nil
	}
	v := t.UTC()
	return &v
}

func formatCalDAVTime(input time.Time) string {
	return input.UTC().Format("20060102T150405Z")
}

func parseICSDateList(key, value string, defaultLoc *time.Location) []time.Time {
	parts := strings.Split(strings.TrimSpace(value), ",")
	out := make([]time.Time, 0, len(parts))
	for _, part := range parts {
		t, _, ok := parseICSTime(key, strings.TrimSpace(part), defaultLoc)
		if !ok {
			continue
		}
		out = append(out, t.UTC())
	}
	return out
}

func expandParsedEvents(events []parsedEvent, start, end time.Time, useRange bool) []parsedEvent {
	if len(events) == 0 {
		return events
	}
	if !useRange {
		return events
	}
	start = start.UTC()
	end = end.UTC()
	expanded := make(map[string]parsedEvent, len(events)*2)
	overrides := make(map[string]parsedEvent)

	for _, ev := range events {
		if ev.UID == "" || ev.Start.IsZero() {
			continue
		}
		uid := strings.TrimSpace(ev.UID)
		if strings.TrimSpace(ev.RecurrenceID) != "" {
			key := uid + "|" + strings.TrimSpace(ev.RecurrenceID)
			overrides[key] = ev
			continue
		}
		hasRecurrence := strings.TrimSpace(ev.RRule) != "" || len(ev.RDates) > 0
		if !hasRecurrence {
			if ev.Start.Before(end) {
				if !ev.End.IsZero() {
					if ev.End.After(start) {
						expanded[uid+"|"] = ev
					}
				} else if !ev.Start.Before(start) {
					expanded[uid+"|"] = ev
				}
			}
			continue
		}

		occurrences := make([]time.Time, 0, 16)
		if strings.TrimSpace(ev.RRule) != "" {
			if option, err := rrule.StrToROption(strings.TrimSpace(ev.RRule)); err == nil {
				option.Dtstart = ev.Start
				if rule, err := rrule.NewRRule(*option); err == nil {
					occurrences = append(occurrences, rule.Between(start, end, true)...)
				}
			}
		}
		if len(ev.RDates) > 0 {
			for _, rdate := range ev.RDates {
				t := rdate.UTC()
				if t.Before(start) || !t.Before(end) {
					continue
				}
				occurrences = append(occurrences, t)
			}
		}
		if len(occurrences) == 0 {
			occurrences = append(occurrences, ev.Start.UTC())
		}

		seen := make(map[int64]struct{}, len(occurrences))
		for _, occurrence := range occurrences {
			ts := occurrence.UTC().Unix()
			if _, ok := seen[ts]; ok {
				continue
			}
			seen[ts] = struct{}{}
			if isExcludedOccurrence(occurrence, ev.ExDates) {
				continue
			}
			instance := ev
			instance.Start = occurrence.UTC()
			if !ev.End.IsZero() {
				duration := ev.End.Sub(ev.Start)
				if duration < 0 {
					duration = 0
				}
				instance.End = occurrence.UTC().Add(duration)
			}
			instance.RecurrenceID = occurrence.UTC().Format("20060102T150405Z")
			key := uid + "|" + instance.RecurrenceID
			expanded[key] = instance
		}
	}

	for key, override := range overrides {
		expanded[key] = override
	}

	out := make([]parsedEvent, 0, len(expanded))
	for _, item := range expanded {
		out = append(out, item)
	}
	return out
}

func isExcludedOccurrence(value time.Time, excludes []time.Time) bool {
	ts := value.UTC().Unix()
	for _, ex := range excludes {
		if ex.UTC().Unix() == ts {
			return true
		}
	}
	return false
}

type parsedEvent struct {
	UID          string
	RecurrenceID string
	RRule        string
	RDates       []time.Time
	ExDates      []time.Time
	Summary      string
	Description  string
	Location     string
	Organizer    string
	Attendees    []string
	URL          string
	Status       string
	Start        time.Time
	End          time.Time
	AllDay       bool
}

func parseICSCalendarData(raw string) []parsedEvent {
	lines := unfoldICSLines(raw)
	defaultLoc := parseCalendarDefaultLocation(lines)
	var out []parsedEvent
	var in bool
	var component string
	current := parsedEvent{Status: "confirmed"}
	for _, line := range lines {
		upper := strings.ToUpper(line)
		switch upper {
		case "BEGIN:VEVENT":
			in = true
			component = "VEVENT"
			current = parsedEvent{Status: "confirmed"}
			continue
		case "BEGIN:VTODO":
			in = true
			component = "VTODO"
			current = parsedEvent{Status: "confirmed"}
			continue
		case "END:VEVENT":
			if in && component == "VEVENT" {
				if current.Start.IsZero() && !current.End.IsZero() {
					current.Start = current.End
				}
				out = append(out, current)
			}
			in = false
			component = ""
			continue
		case "END:VTODO":
			if in && component == "VTODO" {
				if current.Start.IsZero() && !current.End.IsZero() {
					current.Start = current.End
				}
				out = append(out, current)
			}
			in = false
			component = ""
			continue
		}
		if !in {
			continue
		}
		key, value := splitICSLine(line)
		keyUpper := strings.ToUpper(key)
		switch {
		case strings.HasPrefix(keyUpper, "UID"):
			current.UID = strings.TrimSpace(value)
		case strings.HasPrefix(keyUpper, "RECURRENCE-ID"):
			current.RecurrenceID = strings.TrimSpace(value)
		case strings.HasPrefix(keyUpper, "RRULE"):
			current.RRule = strings.TrimSpace(value)
		case strings.HasPrefix(keyUpper, "RDATE"):
			current.RDates = append(current.RDates, parseICSDateList(key, value, defaultLoc)...)
		case strings.HasPrefix(keyUpper, "EXDATE"):
			current.ExDates = append(current.ExDates, parseICSDateList(key, value, defaultLoc)...)
		case strings.HasPrefix(keyUpper, "SUMMARY"):
			current.Summary = unescapeICS(value)
		case strings.HasPrefix(keyUpper, "DESCRIPTION"):
			current.Description = unescapeICS(value)
		case strings.HasPrefix(keyUpper, "LOCATION"):
			current.Location = unescapeICS(value)
		case strings.HasPrefix(keyUpper, "ORGANIZER"):
			current.Organizer = parseICSParticipant(key, value)
		case strings.HasPrefix(keyUpper, "ATTENDEE"):
			current.Attendees = appendUniqueString(current.Attendees, parseICSParticipant(key, value))
		case strings.HasPrefix(keyUpper, "URL"):
			current.URL = strings.TrimSpace(unescapeICS(value))
		case strings.HasPrefix(keyUpper, "STATUS"):
			current.Status = strings.ToLower(strings.TrimSpace(value))
		case strings.HasPrefix(keyUpper, "DTSTART"):
			t, allDay, ok := parseICSTime(key, value, defaultLoc)
			if ok {
				current.Start = t
				current.AllDay = allDay
			}
		case strings.HasPrefix(keyUpper, "DTEND"):
			t, _, ok := parseICSTime(key, value, defaultLoc)
			if ok {
				current.End = t
			}
		case strings.HasPrefix(keyUpper, "DUE"):
			t, _, ok := parseICSTime(key, value, defaultLoc)
			if ok {
				current.End = t
			}
		case strings.HasPrefix(keyUpper, "COMPLETED"):
			current.Status = "completed"
		}
	}
	return out
}

func unfoldICSLines(raw string) []string {
	if !strings.Contains(raw, "\n") && strings.Contains(raw, `\n`) {
		raw = strings.ReplaceAll(raw, `\r\n`, "\n")
		raw = strings.ReplaceAll(raw, `\n`, "\n")
	}
	normalized := strings.ReplaceAll(raw, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")
	base := strings.Split(normalized, "\n")
	if len(base) == 0 {
		return nil
	}
	var out []string
	for _, line := range base {
		if line == "" {
			continue
		}
		if (strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")) && len(out) > 0 {
			out[len(out)-1] += strings.TrimLeft(line, " \t")
			continue
		}
		out = append(out, line)
	}
	return out
}

func splitICSLine(line string) (string, string) {
	parts := strings.SplitN(line, ":", 2)
	if len(parts) != 2 {
		return line, ""
	}
	return parts[0], parts[1]
}

func parseICSTime(key, value string, defaultLoc *time.Location) (time.Time, bool, bool) {
	k := strings.ToUpper(strings.TrimSpace(key))
	v := strings.TrimSpace(value)
	if strings.Contains(k, "VALUE=DATE") {
		t, err := time.Parse("20060102", v)
		if err != nil {
			return time.Time{}, true, false
		}
		return t.UTC(), true, true
	}
	if strings.HasSuffix(v, "Z") {
		t, err := time.Parse("20060102T150405Z", v)
		if err != nil {
			return time.Time{}, false, false
		}
		return t.UTC(), false, true
	}
	if tzid := extractTZID(key); tzid != "" {
		if loc, err := time.LoadLocation(tzid); err == nil {
			t, parseErr := time.ParseInLocation("20060102T150405", v, loc)
			if parseErr == nil {
				return t.UTC(), false, true
			}
		}
	}
	if defaultLoc != nil {
		t, err := time.ParseInLocation("20060102T150405", v, defaultLoc)
		if err == nil {
			return t.UTC(), false, true
		}
	}
	t, err := time.ParseInLocation("20060102T150405", v, time.UTC)
	if err != nil {
		return time.Time{}, false, false
	}
	return t.UTC(), false, true
}

func parseCalendarDefaultLocation(lines []string) *time.Location {
	for _, line := range lines {
		key, value := splitICSLine(line)
		if !strings.EqualFold(strings.TrimSpace(key), "X-WR-TIMEZONE") {
			continue
		}
		tzid := strings.TrimSpace(value)
		if tzid == "" {
			continue
		}
		loc, err := time.LoadLocation(tzid)
		if err == nil {
			return loc
		}
	}
	return nil
}

func extractTZID(key string) string {
	parts := strings.Split(key, ";")
	for _, part := range parts[1:] {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(kv[0]), "TZID") {
			return strings.Trim(strings.TrimSpace(kv[1]), `"`)
		}
	}
	return ""
}

func unescapeICS(input string) string {
	v := strings.ReplaceAll(input, `\n`, "\n")
	v = strings.ReplaceAll(v, `\,`, ",")
	v = strings.ReplaceAll(v, `\;`, ";")
	return strings.TrimSpace(v)
}

func parseICSParticipant(key, value string) string {
	if name := extractICSParam(key, "CN"); name != "" {
		return strings.TrimSpace(unescapeICS(name))
	}
	raw := strings.TrimSpace(unescapeICS(value))
	if strings.HasPrefix(strings.ToLower(raw), "mailto:") {
		raw = raw[len("mailto:"):]
	}
	return strings.TrimSpace(raw)
}

func extractICSParam(key, target string) string {
	parts := strings.Split(key, ";")
	for _, part := range parts[1:] {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(kv[0]), target) {
			return strings.Trim(strings.TrimSpace(kv[1]), `"`)
		}
	}
	return ""
}

func appendUniqueString(list []string, value string) []string {
	v := strings.TrimSpace(value)
	if v == "" {
		return list
	}
	for _, item := range list {
		if strings.EqualFold(strings.TrimSpace(item), v) {
			return list
		}
	}
	return append(list, v)
}

func splitCaldavAttendees(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	lines := strings.Split(raw, "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		v := strings.TrimSpace(line)
		if v == "" {
			continue
		}
		out = append(out, v)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func extractMeetingURL(primaryURL, description string) string {
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(primaryURL)), "http://") || strings.HasPrefix(strings.ToLower(strings.TrimSpace(primaryURL)), "https://") {
		return strings.TrimSpace(primaryURL)
	}
	fields := strings.Fields(strings.TrimSpace(description))
	for _, field := range fields {
		candidate := strings.Trim(field, " \t\r\n,.;:()[]<>\"'")
		lower := strings.ToLower(candidate)
		if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
			return candidate
		}
	}
	return ""
}

func sourceToResponse(source models.CaldavSource, calendars []models.CaldavCalendar) models.CaldavSourceResponse {
	return models.CaldavSourceResponse{
		ID:         source.ID,
		Name:       source.Name,
		BaseURL:    source.BaseURL,
		Username:   source.Username,
		IsActive:   source.IsActive,
		LastSyncAt: source.LastSyncAt,
		LastError:  source.LastError,
		Calendars:  calendars,
	}
}

func choicesToCalendars(choices []models.CaldavCalendarChoice) []models.CaldavCalendar {
	out := make([]models.CaldavCalendar, 0, len(choices))
	for _, choice := range choices {
		out = append(out, models.CaldavCalendar{
			CalendarURL: strings.TrimSpace(choice.CalendarURL),
			DisplayName: strings.TrimSpace(choice.DisplayName),
			Color:       strings.TrimSpace(choice.Color),
			IsSelected:  true,
		})
	}
	return out
}

func externalVirtualID(sourceID, calendarID int64, uid, recurrenceID string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(fmt.Sprintf("%d|%d|%s|%s", sourceID, calendarID, uid, recurrenceID)))
	v := int64(h.Sum64() % 1_000_000_000_000)
	return -1_000_000_000_000 - v
}

func encryptSecret(plainText, secret string) (string, error) {
	key := sha256.Sum256([]byte(strings.TrimSpace(secret) + ":caldav"))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	data := gcm.Seal(nil, nonce, []byte(plainText), nil)
	return base64.StdEncoding.EncodeToString(append(nonce, data...)), nil
}

func decryptSecret(cipherText, secret string) (string, error) {
	key := sha256.Sum256([]byte(strings.TrimSpace(secret) + ":caldav"))
	raw, err := base64.StdEncoding.DecodeString(cipherText)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	size := gcm.NonceSize()
	if len(raw) < size {
		return "", errors.New("invalid encrypted value")
	}
	nonce, data := raw[:size], raw[size:]
	plain, err := gcm.Open(nil, nonce, data, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
