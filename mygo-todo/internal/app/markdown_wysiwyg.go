package app

import (
	"math"
	"strings"

	"github.com/egoist/mygo/transfer"
	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/markdown/parser"
	"github.com/egoist/mygo/ui/richtext"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/field"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

type wysiwygEditorState struct {
	identity          string
	doc               *richtext.Document
	loadedSource      string
	lastSerialized    string
	docVersion        uint64
	fenceLangs        []string
	sourceMode        bool
	composing         bool
	linkOpen          bool
	linkURL           string
	moreOpen          bool
	dark              bool
	contentW          float32
	richViewH         float32
	rawViewH          float32
	overscroll        ui.ScrollState
	lastVisParaIdx    int
	lastVisParaTop    float32
	hasLastVisPara    bool
	prevVisDocVersion uint64
}

const editorBottomOverscrollRatio = 0.5

// editorHalfScreenPadding returns bottom padding (~50% of viewport height) so
// raw Markdown editing keeps comfortable half-screen scroll breathing room.
func editorHalfScreenPadding(viewH float32) float32 {
	if viewH <= 0 {
		return 6
	}
	return max(float32(6), float32(math.Round(float64(viewH)*editorBottomOverscrollRatio)))
}

// computeEditorBottomOverscroll computes the extra bottom scroll space below the
// WYSIWYG editor (up to half the viewport height) so long notes can scroll past
// the last line into the vertical middle of the pane, while short notes in the
// upper half keep zero unnecessary scrolling.
func computeEditorBottomOverscroll(viewH float32, boxes []richtext.ParagraphBox, paraCount int) float32 {
	if viewH <= 0 || len(boxes) == 0 {
		return 0
	}
	halfH := float32(math.Round(float64(viewH) * editorBottomOverscrollRatio))
	if halfH <= 0 {
		return 0
	}
	first := boxes[0]
	last := boxes[len(boxes)-1]
	overflows := first.Index > 0 || first.Top < -0.5 || last.Index < paraCount-1 || last.Top+last.Height > viewH+0.5
	if overflows {
		return halfH
	}
	lastBottom := last.Top + last.Height
	if lastBottom <= viewH-halfH {
		return 0
	}
	return min(halfH, float32(math.Round(float64(lastBottom-(viewH-halfH)))))
}

type richBlockAttachment struct {
	kind string // "table", "hr", "rawblock"
	raw  string
}

type parsedTableData struct {
	aligns []parser.Align
	rows   [][]string
	header []bool
	colW   []float32
	rowH   []float32
	totalW float32
	totalH float32
}

// inspectMarkdownSource detects fenced code block info strings (so we can
// restore ```go, ```json, etc. when serializing richtext back to Markdown).
func inspectMarkdownSource(src string) (fenceLangs []string, complexSyntax bool) {
	if strings.TrimSpace(src) == "" {
		return nil, false
	}
	d := parser.New(parser.Default)
	d.Set(src)
	var walk func(parent int)
	walk = func(parent int) {
		for idx := range d.Children(parent) {
			b := d.Block(idx)
			if b.Kind == parser.CodeBlock && b.Fenced {
				fenceLangs = append(fenceLangs, strings.TrimSpace(b.Info()))
			}
			walk(idx)
		}
	}
	walk(0)
	return fenceLangs, false
}

func extractTableData(d *parser.Document, tableIdx int, targetW float32) parsedTableData {
	if targetW < 220 {
		targetW = 540
	}
	b := d.Block(tableIdx)
	cols := len(b.Align)
	if cols == 0 {
		cols = 1
	}
	td := parsedTableData{
		aligns: append([]parser.Align(nil), b.Align...),
		colW:   make([]float32, cols),
	}
	for c := 0; c < cols; c++ {
		td.colW[c] = 72
	}
	for r := tableIdx + 1; r < d.Block(tableIdx).Next; r = d.Block(r).Next {
		row := d.Block(r)
		cells := make([]string, cols)
		k := 0
		for cell := r + 1; cell < d.Block(r).Next && k < cols; cell = d.Block(cell).Next {
			txt := strings.TrimSpace(parser.PlainText(d.Inlines(cell)))
			cells[k] = txt
			font := ui.Font{Size: 13, Weight: 400}
			if row.Header {
				font.Size = 12
				font.Weight = 600
			}
			w, _ := ui.ShapeText(txt, font, 0).Size()
			td.colW[k] = max(td.colW[k], min(280, w+28))
			k++
		}
		td.rows = append(td.rows, cells)
		td.header = append(td.header, row.Header)
	}
	var sumW float32
	for _, w := range td.colW {
		sumW += w
	}
	if sumW <= 0 {
		sumW = 1
	}
	td.totalW = targetW
	td.rowH = make([]float32, len(td.rows))
	var totalH float32 = 6
	for ri, row := range td.rows {
		isHeader := ri < len(td.header) && td.header[ri]
		minH := float32(36)
		font := ui.Font{Size: 13, Weight: 400, LineHeight: 1.45}
		if isHeader {
			minH = 34
			font = ui.Font{Size: 12, Weight: 600, LineHeight: 1.35}
		}
		rh := minH
		for ci := 0; ci < cols && ci < len(row); ci++ {
			if row[ci] == "" {
				continue
			}
			cw := targetW * (td.colW[ci] / sumW)
			_, th := ui.ShapeText(row[ci], font, max(24, cw-22)).Size()
			rh = max(rh, th+16)
		}
		td.rowH[ri] = rh
		totalH += rh
	}
	td.totalH = max(40, totalH)
	return td
}

func wysiwygBodyColor(t designTokens, dark bool) ui.Color {
	if dark {
		return t.TextPrimary.Mix(t.TextSecondary, 0.08)
	}
	return t.TextPrimary.Mix(t.TextSecondary, 0.22)
}

func drawWYSIWYGTable(p *ui.Painter, r ui.Rect, td parsedTableData, t designTokens, dark bool) {
	if len(td.rows) == 0 || r.W <= 4 || r.H <= 4 {
		return
	}
	box := ui.Rect{X: r.X, Y: r.Y + 3, W: r.W, H: max(16, r.H-6)}
	cols := max(1, len(td.colW))
	var sumColW float32
	for _, w := range td.colW {
		sumColW += w
	}
	if sumColW <= 0 {
		sumColW = 1
	}
	var sumRowH float32
	for _, h := range td.rowH {
		sumRowH += h
	}
	if sumRowH <= 0 {
		sumRowH = float32(len(td.rows)) * 36
	}
	scaleY := box.H / sumRowH

	headerFill := t.BgSubtle.Alpha(0.62)
	if dark {
		headerFill = t.BgSubtle.Alpha(0.80)
	}
	bodyColor := wysiwygBodyColor(t, dark)

	ry := box.Y
	for ri, row := range td.rows {
		rowH := float32(36) * scaleY
		if ri < len(td.rowH) {
			rowH = td.rowH[ri] * scaleY
		}
		isHeader := ri < len(td.header) && td.header[ri]
		rowRect := ui.Rect{X: box.X, Y: ry, W: box.W, H: rowH}
		if isHeader {
			p.Fill(rowRect, headerFill, 6)
			p.Fill(ui.Rect{X: box.X, Y: ry + rowH - 1, W: box.W, H: 1}, t.BorderDefault.Alpha(0.80), 0)
		} else {
			p.Fill(ui.Rect{X: box.X, Y: ry + rowH - 1, W: box.W, H: 1}, t.BorderSubtle.Alpha(0.85), 0)
		}
		cx := box.X
		for ci := 0; ci < cols; ci++ {
			cw := box.W * (td.colW[ci] / sumColW)
			if ci == cols-1 {
				cw = box.X + box.W - cx
			}
			if ci < len(row) && row[ci] != "" {
				font := ui.Font{Size: 13, Weight: 400, LineHeight: 1.45}
				fg := bodyColor
				if isHeader {
					font = ui.Font{Size: 12, Weight: 600, LineHeight: 1.35}
					fg = t.TextSecondary
				}
				padX := float32(11)
				availW := max(1, cw-padX*2)
				layout := ui.ShapeText(row[ci], font, availW)
				tw, th := layout.Size()
				tx := cx + padX
				if ci < len(td.aligns) {
					switch td.aligns[ci] {
					case parser.AlignCenter:
						tx = cx + max(6, (cw-tw)/2)
					case parser.AlignRight:
						tx = cx + max(6, cw-padX-tw)
					}
				}
				ty := ry + max(2, (rowH-th)/2)
				p.TextLayout(layout, tx, ty, fg)
			}
			cx += cw
		}
		ry += rowH
	}
}

func makeDividerAttachment(raw string, t designTokens, targetW float32) *richtext.Attachment {
	if strings.TrimSpace(raw) == "" {
		raw = "---"
	}
	if targetW < 220 {
		targetW = 540
	}
	return &richtext.Attachment{
		Width:  targetW,
		Height: 18,
		Name:   "分隔线",
		Data:   richBlockAttachment{kind: "hr", raw: raw},
		Draw: func(p *ui.Painter, r ui.Rect) {
			y := r.Y + r.H/2
			p.Fill(ui.Rect{X: r.X, Y: y, W: r.W, H: 1}, t.BorderSubtle, 0)
		},
	}
}

func makeTableAttachment(d *parser.Document, idx int, raw string, t designTokens, dark bool, targetW float32) *richtext.Attachment {
	td := extractTableData(d, idx, targetW)
	summaryParts := []string{}
	for _, row := range td.rows {
		summaryParts = append(summaryParts, strings.Join(row, " "))
	}
	return &richtext.Attachment{
		Width:  td.totalW,
		Height: td.totalH,
		Name:   strings.Join(summaryParts, " · "),
		Data:   richBlockAttachment{kind: "table", raw: raw},
		Draw: func(p *ui.Painter, r ui.Rect) {
			drawWYSIWYGTable(p, r, td, t, dark)
		},
	}
}

func makeRawBlockAttachment(raw string, t designTokens, targetW float32) *richtext.Attachment {
	if targetW < 220 {
		targetW = 540
	}
	trimmed := strings.TrimSpace(raw)
	font := ui.Font{Family: "SF Mono, Menlo, ui-monospace, monospace", Size: 12, LineHeight: 1.45}
	layout := ui.ShapeText(trimmed, font, max(120, targetW-20))
	_, th := layout.Size()
	h := max(32, th+16)
	return &richtext.Attachment{
		Width:  targetW,
		Height: h,
		Name:   trimmed,
		Data:   richBlockAttachment{kind: "rawblock", raw: raw},
		Draw: func(p *ui.Painter, r ui.Rect) {
			box := ui.Rect{X: r.X, Y: r.Y + 1, W: r.W, H: max(16, r.H-2)}
			p.Fill(box, t.BgSubtle, 6)
			p.Stroke(box, t.BorderSubtle, 6, 1)
			l := ui.ShapeText(trimmed, font, max(1, box.W-20))
			p.TextLayout(l, box.X+10, box.Y+7, t.TextSecondary)
		},
	}
}

func docHasBlockAttachments(doc *richtext.Document) bool {
	if doc == nil {
		return false
	}
	for _, p := range doc.Text().Paragraphs() {
		if len(p.Runs) == 1 && p.Runs[0].Attributes.Attachment != nil {
			if _, ok := p.Runs[0].Attributes.Attachment.Data.(richBlockAttachment); ok {
				return true
			}
		}
	}
	return false
}

// parseRichMarkdown converts CommonMark/GFM into richtext.Text while rendering
// GFM tables, horizontal dividers (---), and raw HTML/Math blocks as visual inline
// canvas attachments that span 100% of editor width and round-trip losslessly.
func parseRichMarkdown(src string, t designTokens, dark bool, targetW float32) richtext.Text {
	if src == "" {
		return richtext.Text{}
	}
	d := parser.New(parser.Default)
	d.Set(src)

	var paras []richtext.Paragraph
	spanStart := -1
	flushSpan := func(end int) {
		if spanStart >= 0 && end > spanStart {
			chunk := strings.Trim(src[spanStart:end], "\r\n")
			if chunk != "" {
				for _, p := range richtext.ParseMarkdown(chunk).Paragraphs() {
					paras = append(paras, p)
				}
			}
		}
		spanStart = -1
	}

	for idx := range d.Children(0) {
		b := d.Block(idx)
		switch b.Kind {
		case parser.Table:
			flushSpan(b.Start)
			raw := strings.TrimRight(src[b.Start:b.End], "\r\n")
			at := makeTableAttachment(d, idx, raw, t, dark, targetW)
			paras = append(paras, richtext.Paragraph{
				Runs: []richtext.Run{{
					Text:       string(richtext.ObjectReplacement),
					Attributes: richtext.Attributes{Attachment: at},
				}},
			})
		case parser.ThematicBreak:
			flushSpan(b.Start)
			raw := strings.TrimRight(src[b.Start:b.End], "\r\n")
			at := makeDividerAttachment(raw, t, targetW)
			paras = append(paras, richtext.Paragraph{
				Runs: []richtext.Run{{
					Text:       string(richtext.ObjectReplacement),
					Attributes: richtext.Attributes{Attachment: at},
				}},
			})
		case parser.HTMLBlock, parser.MathBlock:
			flushSpan(b.Start)
			raw := strings.TrimRight(src[b.Start:b.End], "\r\n")
			at := makeRawBlockAttachment(raw, t, targetW)
			paras = append(paras, richtext.Paragraph{
				Runs: []richtext.Run{{
					Text:       string(richtext.ObjectReplacement),
					Attributes: richtext.Attributes{Attachment: at},
				}},
			})
		default:
			if spanStart < 0 {
				spanStart = b.Start
			}
		}
	}
	flushSpan(len(src))

	if len(paras) == 0 {
		return richtext.ParseMarkdown(src)
	}
	return richtext.TextOf(paras...)
}

func restoreFenceLanguages(out string, fenceLangs []string, langIdx *int) string {
	if len(fenceLangs) == 0 || !strings.Contains(out, "```") {
		return out
	}
	lines := strings.Split(out, "\n")
	inFence := false
	openFence := ""
	for i, line := range lines {
		trimmed := strings.TrimLeft(line, "> ")
		prefix := line[:len(line)-len(trimmed)]
		if !inFence && strings.HasPrefix(trimmed, "```") {
			ticks := trimmed
			if strings.Trim(ticks, "`") == "" {
				inFence = true
				openFence = ticks
				if *langIdx < len(fenceLangs) && fenceLangs[*langIdx] != "" {
					lines[i] = prefix + ticks + fenceLangs[*langIdx]
				}
				*langIdx++
			}
		} else if inFence && trimmed == openFence {
			inFence = false
			openFence = ""
		}
	}
	return strings.Join(lines, "\n")
}

// serializeRichMarkdown exports richtext.Text to CommonMark/GFM while restoring
// fenced code block language tags and lossless block attachments (tables, rules, etc.).
func serializeRichMarkdown(txt richtext.Text, fenceLangs []string) string {
	var blocks []string
	var normalSpan []richtext.Paragraph
	langIdx := 0

	flushNormal := func() {
		if len(normalSpan) == 0 {
			return
		}
		md := richtext.TextOf(normalSpan...).Markdown()
		md = restoreFenceLanguages(md, fenceLangs, &langIdx)
		if md != "" {
			blocks = append(blocks, md)
		}
		normalSpan = normalSpan[:0]
	}

	for _, p := range txt.Paragraphs() {
		if len(p.Runs) == 1 && p.Runs[0].Attributes.Attachment != nil {
			if meta, ok := p.Runs[0].Attributes.Attachment.Data.(richBlockAttachment); ok {
				flushNormal()
				blocks = append(blocks, meta.raw)
				continue
			}
		}
		normalSpan = append(normalSpan, p)
	}
	flushNormal()
	return strings.Join(blocks, "\n\n")
}

func wysiwygThemeOf(c *ui.Context) *richtext.Theme {
	t := tokensOf(c)
	dark := c.Theme().Dark
	bodyText := wysiwygBodyColor(t, dark)
	// Soft, delicate unchecked checkbox stroke and placeholder tone matching
	// the refined rounded checkboxes in the left task list.
	mutedStroke := t.BorderDefault.Mix(t.TextTertiary, 0.55)
	if dark {
		mutedStroke = t.BorderDefault.Mix(t.TextTertiary, 0.45)
	}
	return &richtext.Theme{
		Text:                bodyText,
		Muted:               mutedStroke,
		Link:                t.Accent,
		Caret:               t.Accent,
		Selection:           t.Accent.Alpha(0.18),
		CodeFont:            "SF Mono, Menlo, ui-monospace, monospace",
		CodeSize:            0.89,
		Code:                t.TextPrimary,
		CodeBackground:      t.BgSubtle,
		CodeBlockBackground: t.BgSubtle,
		CodeBlockRadius:     0.45,
		CodeBlockPadding:    [2]float32{0.95, 0.72},
		ParagraphSpacing:    0.62,
		Indent:              1.75,
		Marker:              t.TextTertiary,
		Checkbox:            t.Accent,
		Checkmark:           t.TextOnAccent,
		QuoteBar:            t.BorderDefault,
		QuoteText:           t.TextSecondary,
		QuoteBarWidth:       2.5,
		Headings: [6]richtext.HeadingStyle{
			{Size: 1.22, Weight: 600, Color: t.TextPrimary, Top: 0.60, Bottom: 0.22},
			{Size: 1.12, Weight: 600, Color: t.TextPrimary, Top: 0.52, Bottom: 0.18},
			{Size: 1.04, Weight: 600, Color: t.TextPrimary, Top: 0.42, Bottom: 0.15},
			{Size: 1.00, Weight: 600, Color: t.TextPrimary, Top: 0.34, Bottom: 0.13},
			{Size: 0.96, Weight: 600, Color: t.TextSecondary, Top: 0.28, Bottom: 0.12},
			{Size: 0.92, Weight: 600, Color: t.TextSecondary, Top: 0.25, Bottom: 0.12},
		},
	}
}

// wysiwygMarkdownEditor provides a single-surface WYSIWYG Markdown editor
// backed by MyGo's native richtext engine, with formatting controls, interactive
// task checkboxes, fence-language preservation, full-width inline GFM tables and
// dividers, and an optional raw Markdown source toggle.
func (a *App) wysiwygMarkdownEditor(c *ui.Context, key, identity, label, placeholder string, source *string, readOnly bool, ref *ui.Handle, onEdit func(), onAI func()) {
	t := tokensOf(c)
	dark := c.Theme().Dark
	root := ui.Column(c.Key(key)).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Gap(4).Clip()
	st := ui.Local(root, "wysiwyg-state", func() wysiwygEditorState { return wysiwygEditorState{} })

	rootW := root.Bounds().W
	targetW := st.contentW
	if rootW > 120 {
		targetW = max(float32(220), float32(math.Floor(float64(rootW-6))))
	} else if targetW <= 0 {
		winW, _ := c.Size()
		if winW > 0 {
			est := winW - 44
			if winW >= 1180 {
				if a.page == "calendar" {
					ws := winW - a.sidebarWidth - 1
					est = min(float32(440), max(float32(detailMinWidth), ws*0.36)) - 44
				} else {
					listW := a.taskListFitWidth
					if listW <= 0 {
						listW = taskListDefaultWidth
					}
					est = winW - a.sidebarWidth - listW - 46
				}
			}
			targetW = max(float32(240), float32(math.Floor(float64(est))))
		} else {
			targetW = 540
		}
	}

	reloadDoc := func(src string, width float32) {
		langs, _ := inspectMarkdownSource(src)
		st.identity = identity
		st.loadedSource = src
		st.lastSerialized = src
		st.fenceLangs = langs
		st.dark = dark
		st.contentW = width
		parsed := parseRichMarkdown(src, t, dark, width)
		if st.doc == nil {
			st.doc = richtext.NewDocument(parsed)
		} else {
			st.doc.SetText(parsed)
		}
		st.docVersion = st.doc.Version()
	}

	if st.doc == nil || st.identity != identity {
		st.sourceMode = false
		st.composing = false
		st.linkOpen = false
		st.moreOpen = false
		st.overscroll = ui.ScrollState{}
		st.hasLastVisPara = false
		a.richComposing = false
		reloadDoc(*source, targetW)
	} else if !st.composing && *source != st.lastSerialized && *source != st.loadedSource {
		// External update (e.g. AI generation or remote sync rebase on clean draft).
		reloadDoc(*source, targetW)
	} else if st.dark != dark && !st.composing && !st.sourceMode {
		// Refresh attachment theme colors on light/dark theme switch.
		reloadDoc(*source, targetW)
	} else if rootW > 120 && math.Abs(float64(targetW-st.contentW)) > 2 && !st.composing && !st.sourceMode {
		st.contentW = targetW
		if docHasBlockAttachments(st.doc) {
			anchor, caret := st.doc.Selection()
			currentSrc := serializeRichMarkdown(st.doc.Text(), st.fenceLangs)
			st.doc.SetText(parseRichMarkdown(currentSrc, t, dark, targetW))
			st.doc.SetSelection(anchor, caret)
			st.docVersion = st.doc.Version()
			c.Invalidate()
		}
	}
	a.richDoc = st.doc

	syncRichToSource := func() {
		if st.doc == nil || st.composing || st.doc.Version() == st.docVersion {
			return
		}
		st.docVersion = st.doc.Version()
		serialized := serializeRichMarkdown(st.doc.Text(), st.fenceLangs)
		st.lastSerialized = serialized
		if *source != serialized {
			if onEdit != nil {
				onEdit()
			}
			*source = serialized
		}
	}

	insertMarkdownBlock := func(rawBlock string) {
		syncRichToSource()
		cur := strings.TrimRight(*source, "\r\n")
		if cur == "" {
			*source = rawBlock
		} else {
			*source = cur + "\n\n" + rawBlock
		}
		if onEdit != nil {
			onEdit()
		}
		reloadDoc(*source, targetW)
	}

	root.Children(func() {
		// Single-line, quiet, de-noised formatting strip with automatic overflow
		// dropdown in narrow drawers so no lone icon ever wraps onto a second row.
		toolbar := ui.Row(c.Key(key+"-toolbar")).Height(28).Shrink(0).Padding(0, 0).Gap(1).AlignItems(ui.Center)
		toolbar.Children(func() {
			var linkAnchor ui.Element
			if !st.sourceMode && !readOnly {
				f := st.doc.Formatting()
				runFmt := func(actionFn func()) {
					actionFn()
					syncRichToSource()
					if ref != nil {
						ref.Focus()
					}
				}
				fmtBtn := func(id, tip string, active bool, icon *ui.SVG, actionFn func()) ui.Element {
					btn := ui.ButtonBase(c.Key("fmt-"+id)).Label(tip).Tooltip(tip).Size(24, 24).Padding(0).Radius(5).Center().Shrink(0).
						Cursor(ui.CursorPointer).FocusRingColor(t.Accent)
					fg := t.TextTertiary.Alpha(0.80)
					if active {
						btn.Background(t.BgSelected)
						fg = t.Accent
					} else if btn.Hovered() {
						btn.Background(t.BgHover)
						fg = t.TextPrimary
					}
					btn.OnClick(func() { runFmt(actionFn) })
					btn.Children(func() {
						ui.Icon(c, icon).Size(13.5, 13.5).TextColor(fg).AccessHidden(true)
					})
					return btn
				}

				toolbarDivider := func() {
					ui.Box(c).Width(1).Height(11).Margin(0, 3).Shrink(0).Background(t.BorderSubtle.Alpha(0.85)).AccessHidden(true)
				}

				// Width tiers guarantee strictly 1 line with zero orphaned wrapping icons.
				wideBar := rootW == 0 || rootW >= 448
				medBar := rootW >= 344 && rootW < 448

				fmtBtn("h1", "一级标题", !f.ParagraphsMixed && f.Paragraph.Heading == 1, lucide.Heading1(), func() {
					if !f.ParagraphsMixed && f.Paragraph.Heading == 1 {
						st.doc.SetHeading(0)
					} else {
						st.doc.SetHeading(1)
					}
				})
				fmtBtn("h2", "二级标题", !f.ParagraphsMixed && f.Paragraph.Heading == 2, lucide.Heading2(), func() {
					if !f.ParagraphsMixed && f.Paragraph.Heading == 2 {
						st.doc.SetHeading(0)
					} else {
						st.doc.SetHeading(2)
					}
				})
				toolbarDivider()
				fmtBtn("bold", "加粗 (⌘B)", f.Bold == richtext.FormatOn, lucide.Bold(), func() { st.doc.ToggleBold() })
				fmtBtn("italic", "斜体 (⌘I)", f.Italic == richtext.FormatOn, lucide.Italic(), func() { st.doc.ToggleItalic() })
				if wideBar {
					fmtBtn("strike", "删除线 (⇧⌘X)", f.Strikethrough == richtext.FormatOn, lucide.Strikethrough(), func() { st.doc.ToggleStrikethrough() })
				}
				if wideBar || medBar {
					fmtBtn("code", "行内代码 (⌘E)", f.Code == richtext.FormatOn, lucide.Code(), func() { st.doc.ToggleCode() })
				}
				toolbarDivider()
				fmtBtn("bullet", "无序列表", !f.ParagraphsMixed && f.Paragraph.List == richtext.Bullets, lucide.List(), func() { st.doc.ToggleList(richtext.Bullets) })
				if wideBar {
					fmtBtn("number", "有序列表", !f.ParagraphsMixed && f.Paragraph.List == richtext.Numbers, lucide.ListOrdered(), func() { st.doc.ToggleList(richtext.Numbers) })
				}
				fmtBtn("task", "待办清单", !f.ParagraphsMixed && f.Paragraph.List == richtext.Tasks, lucide.ListTodo(), func() { st.doc.ToggleList(richtext.Tasks) })
				if wideBar || medBar {
					fmtBtn("quote", "引用", !f.ParagraphsMixed && f.Paragraph.Quote, lucide.Quote(), func() { st.doc.ToggleQuote() })
				}
				if wideBar {
					fmtBtn("codeblock", "代码块", !f.ParagraphsMixed && f.Paragraph.CodeBlock, lucide.SquareCode(), func() { st.doc.ToggleCodeBlock() })
					fmtBtn("table", "插入表格", false, lucide.Table(), func() {
						insertMarkdownBlock("| 阶段 | 内容 | 状态 |\n| --- | --- | --- |\n| 计划 | 核心事项 | 进行中 |")
					})
					fmtBtn("hr", "插入分隔线", false, lucide.Minus(), func() {
						insertMarkdownBlock("---")
					})
				}
				if wideBar || medBar {
					linkAnchor = fmtBtn("link", "插入链接 (⌘K)", f.Link != "", lucide.Link(), func() {
						st.linkURL = f.Link
						st.linkOpen = !st.linkOpen
					})
				}

				// Overflow formatting dropdown for narrow drawers & compact panes
				if !wideBar {
					var overflow []overlay.MenuItem
					if !medBar {
						overflow = append(overflow,
							overlay.MenuItem{Key: "code", Label: "行内代码", Hotkey: "⌘E", Icon: lucide.Code()},
							overlay.MenuItem{Key: "quote", Label: "引用", Icon: lucide.Quote()},
							overlay.MenuItem{Key: "link", Label: "插入链接", Hotkey: "⌘K", Icon: lucide.Link()},
							overlay.MenuItem{Divider: true},
						)
					}
					overflow = append(overflow,
						overlay.MenuItem{Key: "strike", Label: "删除线", Hotkey: "⇧⌘X", Icon: lucide.Strikethrough()},
						overlay.MenuItem{Key: "number", Label: "有序列表", Icon: lucide.ListOrdered()},
						overlay.MenuItem{Key: "codeblock", Label: "代码块", Icon: lucide.SquareCode()},
						overlay.MenuItem{Divider: true},
						overlay.MenuItem{Key: "table", Label: "插入表格", Icon: lucide.Table()},
						overlay.MenuItem{Key: "hr", Label: "插入分隔线", Icon: lucide.Minus()},
					)
					choice := appDropdown(c.Key(key+"-fmt-more"), &st.moreOpen, overflow, func(trigger ui.Element) {
						trigger.Label("更多格式").Tooltip("更多格式").Size(24, 24).Padding(0).Radius(5).Center().Shrink(0).
							Cursor(ui.CursorPointer).FocusRingColor(t.Accent)
						fg := t.TextTertiary.Alpha(0.80)
						if st.moreOpen {
							trigger.Background(t.BgSelected)
							fg = t.Accent
						} else if trigger.Hovered() {
							trigger.Background(t.BgHover)
							fg = t.TextPrimary
						}
						trigger.Children(func() {
							ui.Icon(c, lucide.Ellipsis()).Size(13.5, 13.5).TextColor(fg).AccessHidden(true)
						})
						if !medBar {
							linkAnchor = trigger
						}
					})
					switch choice {
					case "strike":
						runFmt(func() { st.doc.ToggleStrikethrough() })
					case "code":
						runFmt(func() { st.doc.ToggleCode() })
					case "number":
						runFmt(func() { st.doc.ToggleList(richtext.Numbers) })
					case "quote":
						runFmt(func() { st.doc.ToggleQuote() })
					case "codeblock":
						runFmt(func() { st.doc.ToggleCodeBlock() })
					case "table":
						insertMarkdownBlock("| 阶段 | 内容 | 状态 |\n| --- | --- | --- |\n| 计划 | 核心事项 | 进行中 |")
					case "hr":
						insertMarkdownBlock("---")
					case "link":
						st.linkURL = f.Link
						st.linkOpen = true
					}
				}

				if st.linkOpen {
					ui.PopoverBase(c.Key(key+"-link-popover"), linkAnchor, &st.linkOpen, func(panel ui.Element) {
						panel.AttachTo(linkAnchor, ui.AnchorBottomStart, ui.AnchorTopStart)
						elevateFloatingSurface(c, panel.Width(280).Padding(12).Gap(8).Radius(10).Label("设置链接"))
						panel.Children(func() {
							ui.Text(c, "链接地址").FontSize(12).FontWeight(600).TextColor(t.TextPrimary)
							applyLink := func() {
								st.doc.SetLink(strings.TrimSpace(st.linkURL))
								syncRichToSource()
								st.linkOpen = false
								if ref != nil {
									ref.Focus()
								}
							}
							appInput(c.Key(key+"-link-input"), &st.linkURL, "链接地址").Placeholder("https://…").AutoFocus().OnSubmit(applyLink)
							ui.Row(c).Gap(6).Justify(ui.End).Children(func() {
								if f.Link != "" {
									appActionButton(c, "移除", action.ButtonProps{Variant: action.Text, Size: theme.Small}).TextColor(t.Danger).OnClick(func() {
										st.linkURL = ""
										applyLink()
									})
								}
								primaryButton(c, "确定", theme.Small).OnClick(applyLink)
							})
						})
					})
				}
			} else if st.sourceMode {
				ui.Text(c, "Markdown 源码").FontSize(11.5).FontWeight(500).TextColor(t.TextSecondary).Padding(0, 2)
			}

			ui.Spacer(c)
			if onAI != nil && !readOnly {
				aiBtn := ui.ButtonBase(c.Key(key+"-ai")).Label("AI 生成描述").Tooltip("AI 辅助写作").Size(24, 24).Radius(5).Center().Shrink(0).Cursor(ui.CursorPointer)
				aiCol := t.TextTertiary.Alpha(0.80)
				if aiBtn.Hovered() {
					aiBtn.Background(t.BgHover)
					aiCol = t.Accent
				}
				aiBtn.Disabled(a.busy).OnClick(onAI).Children(func() {
					ui.Icon(c, lucide.Sparkles()).Size(13.5, 13.5).TextColor(aiCol).AccessHidden(true)
				})
			}
			if !readOnly {
				modeTip := "切换为 Markdown 源码编辑"
				modeIcon := lucide.FileCode()
				if st.sourceMode {
					modeTip = "切换为所见即所得编辑"
					modeIcon = lucide.Eye()
				}
				toggle := ui.ButtonBase(c.Key(key+"-mode-toggle")).Label(modeTip).Tooltip(modeTip).Size(24, 24).Radius(5).Center().Shrink(0).Cursor(ui.CursorPointer)
				col := t.TextTertiary.Alpha(0.80)
				if st.sourceMode {
					toggle.Background(t.BgSelected)
					col = t.Accent
				} else if toggle.Hovered() {
					toggle.Background(t.BgHover)
					col = t.TextPrimary
				}
				toggle.OnClick(func() {
					st.overscroll = ui.ScrollState{}
					st.hasLastVisPara = false
					if !st.sourceMode {
						syncRichToSource()
						st.sourceMode = true
					} else {
						reloadDoc(*source, targetW)
						st.sourceMode = false
					}
				}).Children(func() {
					ui.Icon(c, modeIcon).Size(13.5, 13.5).TextColor(col).AccessHidden(true)
				})
			}
		})

		// Main Editor Surface
		// Wrap the editor surface in a clipped flex container (Basis(0).MinHeight(0).Clip())
		// because MyGo invokes an element's own Draw callback before pushing its child
		// clip rect; clipping on the wrapper guarantees long descriptions never bleed
		// above into the toolbar/title or below into any footer.
		if st.sourceMode {
			rawWrap := ui.Column(c.Key(key + "-raw-wrap")).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Clip()
			rawWrap.Children(func() {
				rawH := rawWrap.Bounds().H
				if rawH <= 0 {
					c.Invalidate()
				} else if math.Abs(float64(rawH-st.rawViewH)) > 1 {
					st.rawViewH = rawH
					c.Invalidate()
				}
				bottomPad := editorHalfScreenPadding(rawH)
				ed := appTextArea(c.Key(key+"-raw"), source, field.TextAreaProps{
					Variant:     field.InputBorderless,
					Placeholder: placeholder,
					MinRows:     6,
					MaxRows:     24,
				}).Label(label).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Padding(6, 4, bottomPad, 4).Disabled(readOnly)
				if ref != nil {
					ed.Ref(ref)
				}
				if ed.Changed() {
					st.lastSerialized = *source
					if onEdit != nil {
						onEdit()
					}
				}
			})
		} else {
			svc := c.Services()
			pasteGuard := ui.Column(c.Key(key + "-rich-wrap")).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Clip().
				ObserveInput(func(ev ui.InputEvent) {
					if readOnly {
						return
					}
					switch ev.Kind {
					case ui.InputCompose:
						st.composing = ev.Text != ""
						a.richComposing = st.composing
						a.autosave.composing = st.composing
						return
					case ui.InputText:
						st.composing = false
						a.richComposing = false
						a.autosave.composing = false
					}
					isPaste := (ev.Kind == ui.InputCommand && ev.Text == "paste") ||
						(ev.Kind == ui.InputKeyDown && ev.Key == ui.KeyV && (ev.Mods&(ui.Cmd|ui.Ctrl)) != 0 && (ev.Mods&ui.Shift) == 0)
					if !isPaste {
						return
					}
					clip := svc.ReadClipboardData(richtext.Format, transfer.HTML, richtext.RTF, transfer.Markdown, transfer.Text)
					for _, richFmt := range []transfer.Format{richtext.Format, transfer.HTML, richtext.RTF, transfer.Markdown} {
						if b, err := clip.Read(richFmt); err == nil && len(b) > 0 {
							return
						}
					}
					plain := svc.ReadClipboard()
					if strings.TrimSpace(plain) == "" {
						return
					}
					langs, _ := inspectMarkdownSource(plain)
					if len(langs) > 0 {
						st.fenceLangs = append(st.fenceLangs, langs...)
					}
					// Upgrade plain-text Markdown on clipboard so richtext's native paste
					// parses headings, lists, checkboxes, quotes and code blocks cleanly.
					svc.WriteClipboardData(transfer.New(transfer.NewItem(
						transfer.Bytes(transfer.Markdown, []byte(plain)),
						transfer.Bytes(transfer.Text, []byte(plain)),
					)))
				})
			pasteGuard.Children(func() {
				scrollView := ui.Scroll(c.Key(key + "-overscroll")).TrackScroll(&st.overscroll).Scrollbars(false).Grow(1).Basis(0).MinHeight(0).MinWidth(0)
				viewH := scrollView.Bounds().H
				editorH := viewH
				if editorH <= 0 {
					_, winH := c.Size()
					if winH > 0 {
						editorH = max(float32(160), winH-180)
					} else {
						editorH = 320
					}
					c.Invalidate()
				} else if math.Abs(float64(viewH-st.richViewH)) > 1 {
					st.richViewH = viewH
					c.Invalidate()
				}
				boxes := st.doc.VisibleParagraphs()
				paraCount := st.doc.Text().ParagraphCount()
				docVer := st.doc.Version()
				if st.overscroll.Y > 0 && len(boxes) > 0 {
					lastBox := boxes[len(boxes)-1]
					if lastBox.Index < paraCount-1 {
						st.overscroll.Y = 0
					} else if st.hasLastVisPara && docVer == st.prevVisDocVersion {
						for _, b := range boxes {
							if b.Index == st.lastVisParaIdx {
								if delta := b.Top - st.lastVisParaTop; delta > 0.5 {
									st.overscroll.Y = max(0, st.overscroll.Y-delta)
								}
								break
							}
						}
					}
				}
				if len(boxes) > 0 {
					st.lastVisParaIdx = boxes[0].Index
					st.lastVisParaTop = boxes[0].Top
					st.hasLastVisPara = true
					st.prevVisDocVersion = docVer
				}
				overscrollH := computeEditorBottomOverscroll(viewH, boxes, paraCount)
				if overscrollH <= 0 && st.overscroll.Y > 0 {
					st.overscroll.Y = 0
				} else if st.overscroll.Y > overscrollH {
					st.overscroll.Y = overscrollH
				}
				scrollView.Children(func() {
					editor := richtext.EditorBase(c.Key(key+"-rich"), st.doc, richtext.EditorOptions{
						Label:       label,
						Placeholder: placeholder,
						Font:        ui.Font{Size: 14, Weight: 400, LineHeight: 1.72},
						ReadOnly:    readOnly,
						Theme:       wysiwygThemeOf(c),
						OnLinkCommand: func() {
							st.linkURL = st.doc.Formatting().Link
							st.linkOpen = true
						},
					}).FillWidth().Height(editorH).Shrink(0).MinWidth(0).Padding(6, 2)
					if ref != nil {
						editor.Ref(ref)
					}
					if !editor.Focused() && st.composing {
						st.composing = false
						a.richComposing = false
					}
					if editor.Changed() || (!st.composing && st.doc.Version() != st.docVersion) {
						syncRichToSource()
					}
					if overscrollH > 0 {
						ui.Box(c.Key(key + "-bottom-space")).Label("编辑区底部留白").Height(overscrollH).Shrink(0).FillWidth().Cursor(ui.CursorText).OnClick(func() {
							if !readOnly {
								end := st.doc.Text().Len()
								st.doc.SetSelection(end, end)
							}
							if ref != nil {
								ref.Focus()
							}
						})
					}
				})
			})
		}
	})
}

// plainMarkdownPreview strips Markdown formatting markers (#, **, - [ ], ```)
// so compact views like Calendar Agenda show clean, human-readable summaries.
func plainMarkdownPreview(src string) string {
	src = strings.TrimSpace(src)
	if src == "" {
		return ""
	}
	d := parser.New(parser.Default)
	d.Set(src)
	var parts []string
	var walk func(parent int)
	walk = func(parent int) {
		for idx := range d.Children(parent) {
			b := d.Block(idx)
			switch b.Kind {
			case parser.Paragraph, parser.Heading, parser.TableCell:
				if txt := strings.TrimSpace(parser.PlainText(d.Inlines(idx))); txt != "" {
					parts = append(parts, txt)
				}
			case parser.CodeBlock:
				if txt := strings.TrimSpace(d.Lines(idx)); txt != "" {
					first, _, _ := strings.Cut(txt, "\n")
					parts = append(parts, strings.TrimSpace(first))
				}
			}
			walk(idx)
		}
	}
	walk(0)
	return strings.Join(parts, " · ")
}
