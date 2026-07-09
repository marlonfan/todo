package handler

import (
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"
	"todo-app/internal/api/middleware"
	"todo-app/internal/models"
	"todo-app/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	davNS     = "DAV:"
	caldavNS  = "urn:ietf:params:xml:ns:caldav"
	csNS      = "http://calendarserver.org/ns/"
	todoCalID = "todo"
)

type CalendarExportHandler struct {
	exportService *service.CalendarExportService
	authService   *service.AuthService
}

type davResourceKind string

const (
	davResourceRoot      davResourceKind = "root"
	davResourcePrincipal davResourceKind = "principal"
	davResourceHome      davResourceKind = "home"
	davResourceCalendar  davResourceKind = "calendar"
	davResourceObject    davResourceKind = "object"
	davResourceUnknown   davResourceKind = "unknown"
)

type davRequestContext struct {
	User       *models.User
	Kind       davResourceKind
	ObjectName string
}

func NewCalendarExportHandler(exportService *service.CalendarExportService, authService *service.AuthService) *CalendarExportHandler {
	return &CalendarExportHandler{exportService: exportService, authService: authService}
}

func (h *CalendarExportHandler) GetSubscriptionInfo(c *gin.Context) {
	userID := middleware.GetUserID(c)
	info, err := h.exportService.SubscriptionInfoForUserID(userID, requestBaseURL(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (h *CalendarExportHandler) ServeFeed(c *gin.Context) {
	rawToken := strings.TrimSuffix(c.Param("token"), ".ics")
	user, err := h.exportService.ParseFeedToken(rawToken)
	if err != nil {
		c.String(http.StatusUnauthorized, "invalid calendar token")
		return
	}
	start, end := h.exportService.DefaultExportRange()
	if parsedStart, parsedEnd, ok := parseOptionalCalendarRange(c.Query("start"), c.Query("end")); ok {
		start, end = parsedStart, parsedEnd
	}
	data, err := h.exportService.ExportFeed(user.ID, start, end)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	c.Header("Content-Disposition", `inline; filename="todo.ics"`)
	c.Header("Cache-Control", "private, max-age=300")
	c.Data(http.StatusOK, "text/calendar; charset=utf-8", []byte(data))
}

func (h *CalendarExportHandler) RedirectWellKnown(c *gin.Context) {
	c.Redirect(http.StatusTemporaryRedirect, "/dav/")
}

func (h *CalendarExportHandler) DAVOptions(c *gin.Context) {
	setDAVHeaders(c)
	c.Status(http.StatusNoContent)
}

func (h *CalendarExportHandler) DAVPropfind(c *gin.Context) {
	reqCtx, ok := h.authenticateDAV(c)
	if !ok {
		return
	}
	depth := davDepth(c.GetHeader("Depth"))
	objects, _ := h.objectsForDAV(reqCtx, depth)
	token := ""
	if propfindNeedsCollectionToken(reqCtx, depth) {
		token, _ = h.exportService.CollectionToken(reqCtx.User.ID)
	}
	responses := h.propfindResponses(c, reqCtx, depth, objects, token)
	h.writeDAVMultiStatus(c, responses)
}

func (h *CalendarExportHandler) DAVReport(c *gin.Context) {
	reqCtx, ok := h.authenticateDAV(c)
	if !ok {
		return
	}
	if reqCtx.Kind != davResourceCalendar && reqCtx.Kind != davResourceObject {
		c.Status(http.StatusForbidden)
		return
	}
	body, _ := io.ReadAll(c.Request.Body)
	bodyLower := strings.ToLower(string(body))
	start, end := h.exportService.DefaultExportRange()
	if parsedStart, parsedEnd, ok := parseCalendarQueryTimeRange(body); ok {
		start, end = parsedStart, parsedEnd
	}

	var objects []service.CalendarObject
	var err error
	if hrefs := parseDAVHrefs(body); len(hrefs) > 0 {
		objects, err = h.objectsByHrefs(reqCtx.User.ID, hrefs)
	} else if reqCtx.Kind == davResourceObject {
		object, getErr := h.exportService.GetObject(reqCtx.User.ID, reqCtx.ObjectName)
		if getErr == nil {
			objects = []service.CalendarObject{*object}
		}
		err = getErr
	} else {
		objects, err = h.exportService.ListObjects(reqCtx.User.ID, start, end, false)
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	token := ""
	if strings.Contains(bodyLower, "sync-collection") {
		token, _ = h.exportService.CollectionToken(reqCtx.User.ID)
	}
	responses := make([]string, 0, len(objects)+1)
	for _, object := range objects {
		responses = append(responses, calendarDataResponse(calendarObjectHref(reqCtx.User.Username, object.Href), &object))
	}
	if strings.Contains(bodyLower, "sync-collection") {
		responses = append(responses, syncTokenResponse(calendarHref(reqCtx.User.Username), token))
	}
	h.writeDAVMultiStatus(c, responses)
}

func (h *CalendarExportHandler) DAVGet(c *gin.Context) {
	reqCtx, ok := h.authenticateDAV(c)
	if !ok {
		return
	}
	if reqCtx.Kind != davResourceObject {
		c.Status(http.StatusMethodNotAllowed)
		return
	}
	object, err := h.exportService.GetObject(reqCtx.User.ID, reqCtx.ObjectName)
	if err != nil {
		respondDAVObjectError(c, err)
		return
	}
	c.Header("ETag", object.ETag)
	c.Header("Cache-Control", "private, max-age=60")
	c.Data(http.StatusOK, "text/calendar; charset=utf-8", []byte(object.Data))
}

func (h *CalendarExportHandler) DAVPut(c *gin.Context) {
	reqCtx, ok := h.authenticateDAV(c)
	if !ok {
		return
	}
	if reqCtx.Kind != davResourceObject {
		c.Status(http.StatusMethodNotAllowed)
		return
	}
	if !h.checkPreconditions(c, reqCtx) {
		return
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.String(http.StatusBadRequest, "failed to read calendar object")
		return
	}
	object, created, err := h.exportService.UpsertObject(reqCtx.User.ID, reqCtx.ObjectName, body)
	if err != nil {
		if isReadOnlyCalendarObjectError(err) {
			c.Status(http.StatusForbidden)
			return
		}
		c.String(http.StatusBadRequest, err.Error())
		return
	}
	c.Header("ETag", object.ETag)
	if created {
		c.Status(http.StatusCreated)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *CalendarExportHandler) DAVDelete(c *gin.Context) {
	reqCtx, ok := h.authenticateDAV(c)
	if !ok {
		return
	}
	if reqCtx.Kind != davResourceObject {
		c.Status(http.StatusMethodNotAllowed)
		return
	}
	if !h.checkPreconditions(c, reqCtx) {
		return
	}
	if err := h.exportService.DeleteObject(reqCtx.User.ID, reqCtx.ObjectName); err != nil {
		if isReadOnlyCalendarObjectError(err) {
			c.Status(http.StatusForbidden)
			return
		}
		respondDAVObjectError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *CalendarExportHandler) DAVMethodNotAllowed(c *gin.Context) {
	setDAVHeaders(c)
	c.Status(http.StatusMethodNotAllowed)
}

func (h *CalendarExportHandler) authenticateDAV(c *gin.Context) (*davRequestContext, bool) {
	setDAVHeaders(c)
	username, password, ok := c.Request.BasicAuth()
	if !ok {
		h.requestDAVAuth(c)
		return nil, false
	}
	user, err := h.authService.AuthenticateBasic(username, password)
	if err != nil {
		h.requestDAVAuth(c)
		return nil, false
	}
	reqCtx := &davRequestContext{User: user}
	kind, pathUsername, objectName := classifyDAVPath(c.Request.URL.Path)
	if pathUsername != "" {
		decoded, _ := url.PathUnescape(pathUsername)
		if decoded != user.Username {
			c.Status(http.StatusForbidden)
			return nil, false
		}
	}
	reqCtx.Kind = kind
	reqCtx.ObjectName = objectName
	if reqCtx.Kind == davResourceUnknown {
		c.Status(http.StatusNotFound)
		return nil, false
	}
	return reqCtx, true
}

func (h *CalendarExportHandler) requestDAVAuth(c *gin.Context) {
	c.Header("WWW-Authenticate", `Basic realm="Todo CalDAV"`)
	c.Status(http.StatusUnauthorized)
}

func (h *CalendarExportHandler) checkPreconditions(c *gin.Context, reqCtx *davRequestContext) bool {
	ifNoneMatch := strings.TrimSpace(c.GetHeader("If-None-Match"))
	ifMatch := strings.TrimSpace(c.GetHeader("If-Match"))
	if ifNoneMatch == "" && ifMatch == "" {
		return true
	}
	object, err := h.exportService.GetObject(reqCtx.User.ID, reqCtx.ObjectName)
	exists := err == nil && object != nil
	if ifNoneMatch == "*" && exists {
		c.Status(http.StatusPreconditionFailed)
		return false
	}
	if ifMatch != "" {
		if !exists || ifMatch != object.ETag {
			c.Status(http.StatusPreconditionFailed)
			return false
		}
	}
	return true
}

func (h *CalendarExportHandler) objectsForDAV(reqCtx *davRequestContext, depth int) ([]service.CalendarObject, error) {
	if reqCtx.Kind != davResourceCalendar || depth == 0 {
		return nil, nil
	}
	start, end := h.exportService.DefaultExportRange()
	return h.exportService.ListObjects(reqCtx.User.ID, start, end, true)
}

func (h *CalendarExportHandler) objectsByHrefs(userID int64, hrefs []string) ([]service.CalendarObject, error) {
	objectNames := make([]string, 0, len(hrefs))
	for _, href := range hrefs {
		objectName := path.Base(strings.TrimSpace(href))
		if objectName == "." || objectName == "/" || objectName == "" {
			continue
		}
		objectNames = append(objectNames, objectName)
	}
	return h.exportService.GetObjectsByNames(userID, objectNames)
}

func propfindNeedsCollectionToken(reqCtx *davRequestContext, depth int) bool {
	if reqCtx == nil {
		return false
	}
	switch reqCtx.Kind {
	case davResourceCalendar:
		return true
	case davResourceRoot, davResourceHome:
		return depth > 0
	default:
		return false
	}
}

func (h *CalendarExportHandler) propfindResponses(c *gin.Context, reqCtx *davRequestContext, depth int, objects []service.CalendarObject, syncToken string) []string {
	username := reqCtx.User.Username
	responses := []string{}
	switch reqCtx.Kind {
	case davResourceRoot:
		responses = append(responses, rootPropResponse("/dav/", username))
		if depth > 0 {
			responses = append(responses, principalPropResponse(principalHref(username), reqCtx.User, username))
			responses = append(responses, homePropResponse(homeHref(username), username))
			responses = append(responses, calendarCollectionPropResponse(calendarHref(username), "Todo", syncToken))
		}
	case davResourcePrincipal:
		responses = append(responses, principalPropResponse(principalHref(username), reqCtx.User, username))
	case davResourceHome:
		responses = append(responses, homePropResponse(homeHref(username), username))
		if depth > 0 {
			responses = append(responses, calendarCollectionPropResponse(calendarHref(username), "Todo", syncToken))
		}
	case davResourceCalendar:
		responses = append(responses, calendarCollectionPropResponse(calendarHref(username), "Todo", syncToken))
		if depth > 0 {
			for _, object := range objects {
				item := object
				responses = append(responses, objectPropResponse(calendarObjectHref(username, item.Href), &item))
			}
		}
	case davResourceObject:
		object, err := h.exportService.GetObject(reqCtx.User.ID, reqCtx.ObjectName)
		if err == nil {
			responses = append(responses, objectPropResponse(calendarObjectHref(username, object.Href), object))
		}
	default:
		_ = c
	}
	return responses
}

func (h *CalendarExportHandler) writeDAVMultiStatus(c *gin.Context, responses []string) {
	setDAVHeaders(c)
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="utf-8"?>`)
	b.WriteString(`<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">`)
	for _, response := range responses {
		b.WriteString(response)
	}
	b.WriteString(`</D:multistatus>`)
	c.Data(207, "application/xml; charset=utf-8", []byte(b.String()))
}

func requestBaseURL(c *gin.Context) string {
	proto := c.GetHeader("X-Forwarded-Proto")
	if proto == "" {
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}
	return proto + "://" + host
}

func setDAVHeaders(c *gin.Context) {
	c.Header("DAV", "1, calendar-access")
	c.Header("MS-Author-Via", "DAV")
	c.Header("Allow", "OPTIONS, PROPFIND, REPORT, GET, PUT, DELETE")
}

func davDepth(raw string) int {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "0" {
		return 0
	}
	return 1
}

func classifyDAVPath(rawPath string) (davResourceKind, string, string) {
	cleaned := path.Clean("/" + strings.TrimPrefix(rawPath, "/"))
	trailing := strings.HasSuffix(rawPath, "/")
	parts := strings.Split(strings.Trim(cleaned, "/"), "/")
	if len(parts) == 1 && parts[0] == "dav" {
		return davResourceRoot, "", ""
	}
	if len(parts) >= 3 && parts[0] == "dav" && parts[1] == "principals" {
		return davResourcePrincipal, parts[2], ""
	}
	if len(parts) >= 3 && parts[0] == "dav" && parts[1] == "calendars" {
		username := parts[2]
		if len(parts) == 3 {
			return davResourceHome, username, ""
		}
		if len(parts) >= 4 && parts[3] == todoCalID {
			if len(parts) == 4 && trailing {
				return davResourceCalendar, username, ""
			}
			if len(parts) == 4 {
				return davResourceCalendar, username, ""
			}
			if len(parts) == 5 {
				return davResourceObject, username, parts[4]
			}
		}
	}
	return davResourceUnknown, "", ""
}

func parseOptionalCalendarRange(startRaw, endRaw string) (time.Time, time.Time, bool) {
	if strings.TrimSpace(startRaw) == "" || strings.TrimSpace(endRaw) == "" {
		return time.Time{}, time.Time{}, false
	}
	start, err := time.Parse(time.RFC3339, startRaw)
	if err != nil {
		return time.Time{}, time.Time{}, false
	}
	end, err := time.Parse(time.RFC3339, endRaw)
	if err != nil || !end.After(start) {
		return time.Time{}, time.Time{}, false
	}
	return start.UTC(), end.UTC(), true
}

var (
	caldavTimeRangeTagPattern  = regexp.MustCompile(`(?i)<[^>]*time-range[^>]*>`)
	caldavTimeRangeAttrPattern = regexp.MustCompile(`(?i)\b(start|end)="([^"]+)"`)
)

func parseCalendarQueryTimeRange(body []byte) (time.Time, time.Time, bool) {
	match := caldavTimeRangeTagPattern.Find(body)
	if len(match) == 0 {
		return time.Time{}, time.Time{}, false
	}
	values := map[string]string{}
	for _, attr := range caldavTimeRangeAttrPattern.FindAllSubmatch(match, -1) {
		if len(attr) == 3 {
			values[strings.ToLower(string(attr[1]))] = string(attr[2])
		}
	}
	parse := func(raw []byte) (time.Time, bool) {
		value := strings.TrimSpace(string(raw))
		if value == "" {
			return time.Time{}, false
		}
		parsed, err := time.Parse("20060102T150405Z", value)
		return parsed.UTC(), err == nil
	}
	start, hasStart := parse([]byte(values["start"]))
	end, hasEnd := parse([]byte(values["end"]))
	if !hasStart && !hasEnd {
		return time.Time{}, time.Time{}, false
	}
	if !hasStart {
		start = time.Now().UTC().Add(-defaultReportPast())
	}
	if !hasEnd {
		end = start.Add(defaultReportFuture())
	}
	if !end.After(start) {
		return time.Time{}, time.Time{}, false
	}
	return start, end, true
}

func defaultReportPast() time.Duration {
	return 365 * 24 * time.Hour
}

func defaultReportFuture() time.Duration {
	return 730 * 24 * time.Hour
}

func parseDAVHrefs(body []byte) []string {
	type hrefNode struct {
		Value string `xml:",chardata"`
	}
	decoder := xml.NewDecoder(bytes.NewReader(body))
	hrefs := []string{}
	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		start, ok := token.(xml.StartElement)
		if !ok || strings.ToLower(start.Name.Local) != "href" {
			continue
		}
		var node hrefNode
		if err := decoder.DecodeElement(&node, &start); err == nil {
			if value := strings.TrimSpace(node.Value); value != "" {
				hrefs = append(hrefs, value)
			}
		}
	}
	return hrefs
}

func rootPropResponse(href, username string) string {
	return propResponse(href, `
<D:displayname>Todo CalDAV</D:displayname>
<D:resourcetype><D:collection/></D:resourcetype>
<D:current-user-principal><D:href>`+escapeXML(principalHref(username))+`</D:href></D:current-user-principal>
<D:principal-collection-set><D:href>/dav/principals/</D:href></D:principal-collection-set>
`+supportedReportSet("D:principal-property-search", "D:expand-property"))
}

func principalPropResponse(href string, user *models.User, username string) string {
	email := ""
	if user != nil {
		email = strings.TrimSpace(user.Email)
	}
	address := ""
	if email != "" {
		address = `<D:href>mailto:` + escapeXML(email) + `</D:href>`
	}
	return propResponse(href, `
<D:displayname>`+escapeXML(username)+`</D:displayname>
<D:resourcetype><D:principal/></D:resourcetype>
<C:calendar-home-set><D:href>`+escapeXML(homeHref(username))+`</D:href></C:calendar-home-set>
<C:calendar-user-address-set>`+address+`</C:calendar-user-address-set>
<D:current-user-principal><D:href>`+escapeXML(principalHref(username))+`</D:href></D:current-user-principal>
`+supportedReportSet("D:principal-property-search", "D:expand-property"))
}

func homePropResponse(href, username string) string {
	return propResponse(href, `
<D:displayname>`+escapeXML(username)+` calendars</D:displayname>
<D:resourcetype><D:collection/></D:resourcetype>
<D:current-user-principal><D:href>`+escapeXML(principalHref(username))+`</D:href></D:current-user-principal>
`+supportedReportSet("D:sync-collection"))
}

func calendarCollectionPropResponse(href, displayName, syncToken string) string {
	return propResponse(href, `
<D:displayname>`+escapeXML(displayName)+`</D:displayname>
<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>
<C:supported-calendar-component-set><C:comp name="VEVENT"/><C:comp name="VTODO"/></C:supported-calendar-component-set>
<C:calendar-description>Todo tasks</C:calendar-description>
`+supportedReportSet("C:calendar-query", "C:calendar-multiget", "D:sync-collection")+`
<CS:getctag>`+escapeXML(syncToken)+`</CS:getctag>
<D:sync-token>`+escapeXML(syncToken)+`</D:sync-token>
<D:current-user-privilege-set><D:privilege><D:read/></D:privilege><D:privilege><D:write/></D:privilege></D:current-user-privilege-set>`)
}

func objectPropResponse(href string, object *service.CalendarObject) string {
	return propResponse(href, objectProps(object, false))
}

func calendarDataResponse(href string, object *service.CalendarObject) string {
	return propResponse(href, objectProps(object, true))
}

func syncTokenResponse(href, token string) string {
	return propResponse(href, `<D:sync-token>`+escapeXML(token)+`</D:sync-token>`)
}

func objectProps(object *service.CalendarObject, includeData bool) string {
	if object == nil {
		return ""
	}
	props := `
<D:getetag>` + escapeXML(object.ETag) + `</D:getetag>
<D:getcontenttype>text/calendar; charset=utf-8</D:getcontenttype>
<D:getcontentlength>` + strconv.Itoa(len(object.Data)) + `</D:getcontentlength>`
	if object.ReadOnly {
		props += `<D:current-user-privilege-set><D:privilege><D:read/></D:privilege></D:current-user-privilege-set>`
	} else {
		props += `<D:current-user-privilege-set><D:privilege><D:read/></D:privilege><D:privilege><D:write/></D:privilege></D:current-user-privilege-set>`
	}
	if includeData {
		props += `<C:calendar-data>` + escapeXML(object.Data) + `</C:calendar-data>`
	}
	return props
}

func supportedReportSet(reports ...string) string {
	var b strings.Builder
	b.WriteString("<D:supported-report-set>")
	for _, report := range reports {
		report = strings.TrimSpace(report)
		if report == "" {
			continue
		}
		prefix, name, ok := strings.Cut(report, ":")
		if !ok || strings.TrimSpace(prefix) == "" || strings.TrimSpace(name) == "" {
			continue
		}
		b.WriteString("<D:supported-report><D:report><")
		b.WriteString(prefix)
		b.WriteString(":")
		b.WriteString(name)
		b.WriteString("/></D:report></D:supported-report>")
	}
	b.WriteString("</D:supported-report-set>")
	return b.String()
}

func propResponse(href, props string) string {
	return `<D:response><D:href>` + escapeXML(href) + `</D:href><D:propstat><D:prop>` + props + `</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`
}

func principalHref(username string) string {
	return "/dav/principals/" + url.PathEscape(username) + "/"
}

func homeHref(username string) string {
	return "/dav/calendars/" + url.PathEscape(username) + "/"
}

func calendarHref(username string) string {
	return homeHref(username) + todoCalID + "/"
}

func calendarObjectHref(username, objectName string) string {
	return calendarHref(username) + url.PathEscape(objectName)
}

func escapeXML(value string) string {
	var b strings.Builder
	_ = xml.EscapeText(&b, []byte(value))
	return b.String()
}

func respondDAVObjectError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "not found") {
		c.Status(http.StatusNotFound)
		return
	}
	c.String(http.StatusInternalServerError, err.Error())
}

func isReadOnlyCalendarObjectError(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "read-only")
}
