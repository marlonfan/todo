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
	davNS       = "DAV:"
	caldavNS    = "urn:ietf:params:xml:ns:caldav"
	csNS        = "http://calendarserver.org/ns/"
	appleICalNS = "http://apple.com/ns/ical/"
	todoCalID   = "todo"
	davXMLLimit = 1 << 20
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

type davPropfindMode int

const (
	davPropfindAllProp davPropfindMode = iota
	davPropfindNamedProps
	davPropfindPropName
)

type davPropfindRequest struct {
	Mode       davPropfindMode
	Properties []xml.Name
}

func (request davPropfindRequest) includes(name xml.Name) bool {
	for _, property := range request.Properties {
		if property == name {
			return true
		}
	}
	return false
}

type davProperty struct {
	Name xml.Name
	XML  string
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
	body, ok := readDAVXMLBody(c)
	if !ok {
		return
	}
	propfind, err := parseDAVPropfindRequest(body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	depth := davDepth(c.GetHeader("Depth"))
	objects, err := h.objectsForDAV(reqCtx, depth)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	token := ""
	if propfindNeedsCollectionToken(reqCtx, depth, propfind) {
		token, err = h.exportService.CollectionToken(reqCtx.User.ID)
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
	}
	responses, err := h.propfindResponses(reqCtx, depth, objects, token, propfind)
	if err != nil {
		respondDAVObjectError(c, err)
		return
	}
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
	body, ok := readDAVXMLBody(c)
	if !ok {
		return
	}
	report, err := parseDAVReportRequest(body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	if report.Space != caldavNS || (report.Local != "calendar-query" && report.Local != "calendar-multiget") {
		c.Status(http.StatusForbidden)
		return
	}
	start, end := h.exportService.DefaultExportRange()
	if parsedStart, parsedEnd, ok := parseCalendarQueryTimeRange(body); ok {
		start, end = parsedStart, parsedEnd
	}

	var objects []service.CalendarObject
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
	if err != nil {
		if reqCtx.Kind == davResourceObject {
			respondDAVObjectError(c, err)
		} else {
			c.String(http.StatusInternalServerError, err.Error())
		}
		return
	}
	responses := make([]string, 0, len(objects))
	for _, object := range objects {
		responses = append(responses, calendarDataResponse(calendarObjectHref(reqCtx.User.Username, object.Href), &object))
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

func propfindNeedsCollectionToken(reqCtx *davRequestContext, depth int, request davPropfindRequest) bool {
	if reqCtx == nil {
		return false
	}
	if request.Mode == davPropfindPropName {
		return false
	}
	if request.Mode == davPropfindNamedProps && !request.includes(xml.Name{Space: csNS, Local: "getctag"}) {
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

func (h *CalendarExportHandler) propfindResponses(reqCtx *davRequestContext, depth int, objects []service.CalendarObject, syncToken string, request davPropfindRequest) ([]string, error) {
	username := reqCtx.User.Username
	responses := []string{}
	switch reqCtx.Kind {
	case davResourceRoot:
		responses = append(responses, propfindResponse("/dav/", rootProperties(reqCtx.User), request))
		if depth > 0 {
			responses = append(responses, propfindResponse(principalHref(username), principalProperties(reqCtx.User), request))
			responses = append(responses, propfindResponse(homeHref(username), homeProperties(reqCtx.User), request))
			responses = append(responses, propfindResponse(calendarHref(username), calendarCollectionProperties(username, "Todo", syncToken), request))
		}
	case davResourcePrincipal:
		responses = append(responses, propfindResponse(principalHref(username), principalProperties(reqCtx.User), request))
	case davResourceHome:
		responses = append(responses, propfindResponse(homeHref(username), homeProperties(reqCtx.User), request))
		if depth > 0 {
			responses = append(responses, propfindResponse(calendarHref(username), calendarCollectionProperties(username, "Todo", syncToken), request))
		}
	case davResourceCalendar:
		responses = append(responses, propfindResponse(calendarHref(username), calendarCollectionProperties(username, "Todo", syncToken), request))
		if depth > 0 {
			for _, object := range objects {
				item := object
				responses = append(responses, propfindResponse(calendarObjectHref(username, item.Href), objectProperties(&item), request))
			}
		}
	case davResourceObject:
		object, err := h.exportService.GetObject(reqCtx.User.ID, reqCtx.ObjectName)
		if err != nil {
			return nil, err
		}
		responses = append(responses, propfindResponse(calendarObjectHref(username, object.Href), objectProperties(object), request))
	}
	return responses, nil
}

func (h *CalendarExportHandler) writeDAVMultiStatus(c *gin.Context, responses []string) {
	setDAVHeaders(c)
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="utf-8"?>`)
	b.WriteString(`<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:A="http://apple.com/ns/ical/">`)
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

func readDAVXMLBody(c *gin.Context) ([]byte, bool) {
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, davXMLLimit))
	if err == nil {
		return body, true
	}
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		c.Status(http.StatusRequestEntityTooLarge)
	} else {
		c.Status(http.StatusBadRequest)
	}
	return nil, false
}

func parseDAVReportRequest(body []byte) (xml.Name, error) {
	if len(bytes.TrimSpace(body)) == 0 {
		return xml.Name{}, errors.New("empty REPORT body")
	}
	var envelope struct {
		XMLName xml.Name
	}
	if err := xml.Unmarshal(body, &envelope); err != nil {
		return xml.Name{}, err
	}
	return envelope.XMLName, nil
}

type davRequestedProperty struct {
	XMLName  xml.Name
	InnerXML string `xml:",innerxml"`
}

type davPropertyContainer struct {
	Properties []davRequestedProperty `xml:",any"`
}

type davPropfindEnvelope struct {
	XMLName  xml.Name              `xml:"DAV: propfind"`
	AllProp  *struct{}             `xml:"DAV: allprop"`
	PropName *struct{}             `xml:"DAV: propname"`
	Prop     *davPropertyContainer `xml:"DAV: prop"`
	Include  *davPropertyContainer `xml:"DAV: include"`
}

func parseDAVPropfindRequest(body []byte) (davPropfindRequest, error) {
	if len(bytes.TrimSpace(body)) == 0 {
		return davPropfindRequest{Mode: davPropfindAllProp}, nil
	}
	var envelope davPropfindEnvelope
	if err := xml.Unmarshal(body, &envelope); err != nil {
		return davPropfindRequest{}, err
	}
	if envelope.XMLName != (xml.Name{Space: davNS, Local: "propfind"}) {
		return davPropfindRequest{}, errors.New("invalid PROPFIND body")
	}
	toNames := func(container *davPropertyContainer) ([]xml.Name, error) {
		if container == nil {
			return nil, nil
		}
		if len(container.Properties) == 0 {
			return nil, errors.New("empty PROPFIND property list")
		}
		names := make([]xml.Name, 0, len(container.Properties))
		for _, property := range container.Properties {
			if property.InnerXML != "" {
				return nil, errors.New("PROPFIND property values are not allowed")
			}
			names = append(names, property.XMLName)
		}
		return names, nil
	}
	selectors := 0
	if envelope.Prop != nil {
		selectors++
	}
	if envelope.PropName != nil {
		selectors++
	}
	if envelope.AllProp != nil {
		selectors++
	}
	if selectors != 1 || (envelope.Include != nil && envelope.AllProp == nil) {
		return davPropfindRequest{}, errors.New("invalid PROPFIND selector")
	}
	if envelope.Prop != nil {
		properties, err := toNames(envelope.Prop)
		if err != nil {
			return davPropfindRequest{}, err
		}
		return davPropfindRequest{Mode: davPropfindNamedProps, Properties: properties}, nil
	}
	if envelope.PropName != nil {
		return davPropfindRequest{Mode: davPropfindPropName}, nil
	}
	properties, err := toNames(envelope.Include)
	if err != nil && envelope.Include != nil {
		return davPropfindRequest{}, err
	}
	return davPropfindRequest{Mode: davPropfindAllProp, Properties: properties}, nil
}

func rootProperties(user *models.User) []davProperty {
	username := user.Username
	return []davProperty{
		property(davNS, "displayname", escapeXML("Todo CalDAV")),
		property(davNS, "resourcetype", `<D:collection/>`),
		property(davNS, "current-user-principal", hrefValue(principalHref(username))),
		property(caldavNS, "calendar-home-set", hrefValue(homeHref(username))),
		property(caldavNS, "calendar-user-address-set", calendarUserAddressValue(user)),
		property(davNS, "current-user-privilege-set", readPrivilegeValue()),
	}
}

func principalProperties(user *models.User) []davProperty {
	username := user.Username
	return []davProperty{
		property(davNS, "displayname", escapeXML(username)),
		property(davNS, "resourcetype", `<D:collection/><D:principal/>`),
		property(davNS, "principal-URL", hrefValue(principalHref(username))),
		property(davNS, "current-user-principal", hrefValue(principalHref(username))),
		property(caldavNS, "calendar-home-set", hrefValue(homeHref(username))),
		property(caldavNS, "calendar-user-address-set", calendarUserAddressValue(user)),
		property(davNS, "current-user-privilege-set", readPrivilegeValue()),
	}
}

func homeProperties(user *models.User) []davProperty {
	username := user.Username
	return []davProperty{
		property(davNS, "displayname", escapeXML(username+" calendars")),
		property(davNS, "resourcetype", `<D:collection/>`),
		property(davNS, "owner", hrefValue(principalHref(username))),
		property(davNS, "current-user-principal", hrefValue(principalHref(username))),
		property(caldavNS, "calendar-home-set", hrefValue(homeHref(username))),
		property(caldavNS, "calendar-user-address-set", calendarUserAddressValue(user)),
		property(davNS, "current-user-privilege-set", readPrivilegeValue()),
	}
}

func calendarCollectionProperties(username, displayName, syncToken string) []davProperty {
	return []davProperty{
		property(davNS, "displayname", escapeXML(displayName)),
		property(davNS, "resourcetype", `<D:collection/><C:calendar/>`),
		property(davNS, "owner", hrefValue(principalHref(username))),
		property(davNS, "current-user-principal", hrefValue(principalHref(username))),
		property(caldavNS, "calendar-home-set", hrefValue(homeHref(username))),
		property(caldavNS, "supported-calendar-component-set", `<C:comp name="VEVENT"/><C:comp name="VTODO"/>`),
		property(caldavNS, "supported-calendar-data", `<C:calendar-data content-type="text/calendar" version="2.0"/>`),
		property(caldavNS, "calendar-description", escapeXML("Todo tasks")),
		property(davNS, "supported-report-set", supportedReportSetValue("C:calendar-query", "C:calendar-multiget")),
		property(csNS, "getctag", escapeXML(syncToken)),
		property(davNS, "current-user-privilege-set", readWritePrivilegeValue()),
		property(appleICalNS, "calendar-color", "#3A87ADFF"),
		property(appleICalNS, "calendar-order", "1"),
	}
}

func objectProperties(object *service.CalendarObject) []davProperty {
	if object == nil {
		return nil
	}
	privileges := readWritePrivilegeValue()
	if object.ReadOnly {
		privileges = readPrivilegeValue()
	}
	return []davProperty{
		property(davNS, "resourcetype", ""),
		property(davNS, "getetag", escapeXML(object.ETag)),
		property(davNS, "getcontenttype", "text/calendar; charset=utf-8"),
		property(davNS, "getcontentlength", strconv.Itoa(len(object.Data))),
		property(davNS, "current-user-privilege-set", privileges),
	}
}

func property(namespace, local, value string) davProperty {
	name := xml.Name{Space: namespace, Local: local}
	return davProperty{Name: name, XML: propertyXML(name, value)}
}

func propertyXML(name xml.Name, value string) string {
	prefix := namespacePrefix(name.Space)
	if prefix == "" {
		return `<` + name.Local + `>` + value + `</` + name.Local + `>`
	}
	return `<` + prefix + `:` + name.Local + `>` + value + `</` + prefix + `:` + name.Local + `>`
}

func emptyPropertyXML(name xml.Name) string {
	prefix := namespacePrefix(name.Space)
	if prefix != "" {
		return `<` + prefix + `:` + name.Local + `/>`
	}
	if name.Space == "" {
		return `<` + name.Local + `/>`
	}
	return `<X:` + name.Local + ` xmlns:X="` + escapeXML(name.Space) + `"/>`
}

func namespacePrefix(namespace string) string {
	switch namespace {
	case davNS:
		return "D"
	case caldavNS:
		return "C"
	case csNS:
		return "CS"
	case appleICalNS:
		return "A"
	default:
		return ""
	}
}

func propertyKey(name xml.Name) string {
	return name.Space + "\x00" + name.Local
}

func propfindResponse(href string, available []davProperty, request davPropfindRequest) string {
	availableByName := make(map[string]davProperty, len(available))
	for _, property := range available {
		availableByName[propertyKey(property.Name)] = property
	}

	okProps := make([]string, 0, len(available))
	missingProps := []string{}
	switch request.Mode {
	case davPropfindNamedProps:
		for _, requested := range request.Properties {
			if property, ok := availableByName[propertyKey(requested)]; ok {
				okProps = append(okProps, property.XML)
			} else {
				missingProps = append(missingProps, emptyPropertyXML(requested))
			}
		}
	case davPropfindPropName:
		for _, property := range available {
			okProps = append(okProps, emptyPropertyXML(property.Name))
		}
	default:
		for _, property := range available {
			okProps = append(okProps, property.XML)
		}
		for _, included := range request.Properties {
			if _, ok := availableByName[propertyKey(included)]; !ok {
				missingProps = append(missingProps, emptyPropertyXML(included))
			}
		}
	}

	var b strings.Builder
	b.WriteString(`<D:response><D:href>`)
	b.WriteString(escapeXML(href))
	b.WriteString(`</D:href>`)
	if len(okProps) > 0 || len(missingProps) == 0 {
		b.WriteString(propstatXML(strings.Join(okProps, ""), "HTTP/1.1 200 OK"))
	}
	if len(missingProps) > 0 {
		b.WriteString(propstatXML(strings.Join(missingProps, ""), "HTTP/1.1 404 Not Found"))
	}
	b.WriteString(`</D:response>`)
	return b.String()
}

func propstatXML(properties, status string) string {
	return `<D:propstat><D:prop>` + properties + `</D:prop><D:status>` + status + `</D:status></D:propstat>`
}

func hrefValue(href string) string {
	return `<D:href>` + escapeXML(href) + `</D:href>`
}

func calendarUserAddressValue(user *models.User) string {
	if user == nil || strings.TrimSpace(user.Email) == "" {
		return ""
	}
	return hrefValue("mailto:" + strings.TrimSpace(user.Email))
}

func readPrivilegeValue() string {
	return `<D:privilege><D:read/></D:privilege>`
}

func readWritePrivilegeValue() string {
	return readPrivilegeValue() + `<D:privilege><D:write/></D:privilege>`
}

func supportedReportSetValue(reports ...string) string {
	var b strings.Builder
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
	return b.String()
}

func calendarDataResponse(href string, object *service.CalendarObject) string {
	return propResponse(href, objectProps(object, true))
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
