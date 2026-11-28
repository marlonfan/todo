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
	floatingHovered   bool
	slashIndex        int
	slashDismissedAt  int
	pendingSlashApply bool
	slashSnapStart    int
	slashSnapCaret    int
	slashRestoreCaret int
}

type slashCommand struct {
	ID    string
	Label string
	Hint  string
	Icon  *ui.SVG
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
		Padding:             [2]float32{14, 6},
		ParagraphSpacing:    0.62,
		Indent:              1.75,
		Marker:              t.TextTertiary,
		Checkbox:            t.Accent,
		Checkmark:           t.TextOnAccent,
		QuoteBar:            t.BorderDefault,
		QuoteText:           t.TextSecondary,
		QuoteBarWidth:       2.5,
		Headings: [6]richtext.HeadingStyle{
			{Size: 1.32, Weight: 600, Color: t.TextPrimary, Top: 0.62, Bottom: 0.24},
			{Size: 1.18, Weight: 600, Color: t.TextPrimary, Top: 0.54, Bottom: 0.20},
			{Size: 1.07, Weight: 600, Color: t.TextPrimary, Top: 0.44, Bottom: 0.16},
			{Size: 1.00, Weight: 600, Color: t.TextPrimary, Top: 0.36, Bottom: 0.14},
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
		st.floatingHovered = false
		st.slashIndex = 0
		st.slashDismissedAt = -1
		st.pendingSlashApply = false
		st.slashRestoreCaret = -1
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

	if st.slashRestoreCaret >= 0 && st.doc != nil {
		n := len([]rune(st.doc.Text().PlainText()))
		pos := max(0, min(st.slashRestoreCaret, n))
		st.doc.SetSelection(pos, pos)
		st.slashRestoreCaret = -1
	}

	detectSlash := func() (int, string) {
		if readOnly || st.sourceMode || st.composing || st.doc == nil {
			return -1, ""
		}
		anchor, caret := st.doc.Selection()
		if anchor != caret || caret <= 0 {
			return -1, ""
		}
		runes := []rune(st.doc.Text().PlainText())
		if caret > len(runes) {
			caret = len(runes)
		}
		for i := caret - 1; i >= 0; i-- {
			r := runes[i]
			if r == '\n' || r == ' ' || r == '\t' {
				return -1, ""
			}
			if r == '/' {
				if i == 0 || runes[i-1] == '\n' || runes[i-1] == ' ' || runes[i-1] == '\t' {
					return i, string(runes[i+1 : caret])
				}
				return -1, ""
			}
		}
		return -1, ""
	}

	allSlashCommands := func() []slashCommand {
		cmds := []slashCommand{
			{ID: "h1", Label: "一级标题", Hint: "# 标题", Icon: lucide.Heading1()},
			{ID: "h2", Label: "二级标题", Hint: "## 标题", Icon: lucide.Heading2()},
			{ID: "todo", Label: "待办清单", Hint: "- [ ] 任务", Icon: lucide.ListTodo()},
			{ID: "bullet", Label: "无序列表", Hint: "- 列表项", Icon: lucide.List()},
			{ID: "number", Label: "有序列表", Hint: "1. 列表项", Icon: lucide.ListOrdered()},
			{ID: "quote", Label: "引用", Hint: "> 引用块", Icon: lucide.Quote()},
			{ID: "code", Label: "代码块", Hint: "``` 代码", Icon: lucide.SquareCode()},
			{ID: "table", Label: "插入表格", Hint: "| 表格 |", Icon: lucide.Table()},
			{ID: "hr", Label: "插入分隔线", Hint: "---", Icon: lucide.Minus()},
		}
		if onAI != nil {
			cmds = append(cmds, slashCommand{ID: "ai", Label: "AI 生成描述", Hint: "智能整理", Icon: lucide.Sparkles()})
		}
		return cmds
	}

	filterSlashCommands := func(q string) []slashCommand {
		q = strings.ToLower(strings.TrimSpace(q))
		all := allSlashCommands()
		if q == "" {
			return all
		}
		var out []slashCommand
		for _, cmd := range all {
			if strings.Contains(strings.ToLower(cmd.ID+" "+cmd.Label+" "+cmd.Hint), q) {
				out = append(out, cmd)
			}
		}
		return out
	}

	execSlashCommand := func(cmdID string, startIdx, endIdx int) {
		if st.doc == nil {
			return
		}
		runes := []rune(st.doc.Text().PlainText())
		startIdx = max(0, min(startIdx, len(runes)))
		endIdx = max(startIdx, min(endIdx, len(runes)))
		if endIdx > startIdx {
			st.doc.Edit(func(e *richtext.Edit) {
				e.ReplaceString(startIdx, endIdx, "", richtext.Attributes{})
				e.Select(startIdx, startIdx)
			})
		}
		switch cmdID {
		case "h1":
			st.doc.SetHeading(1)
		case "h2":
			st.doc.SetHeading(2)
		case "todo":
			st.doc.ToggleList(richtext.Tasks)
		case "bullet":
			st.doc.ToggleList(richtext.Bullets)
		case "number":
			st.doc.ToggleList(richtext.Numbers)
		case "quote":
			st.doc.ToggleQuote()
		case "code":
			st.doc.ToggleCodeBlock()
		case "table":
			insertMarkdownBlock("| 阶段 | 内容 | 状态 |\n| --- | --- | --- |\n| 计划 | 核心事项 | 进行中 |")
			return
		case "hr":
			insertMarkdownBlock("---")
			return
		case "ai":
			syncRichToSource()
			if onAI != nil {
				onAI()
			}
			return
		}
		syncRichToSource()
		if ref != nil {
			ref.Focus()
		}
	}

	if st.pendingSlashApply {
		st.pendingSlashApply = false
		runes := []rune(st.doc.Text().PlainText())
		queryEnd := min(st.slashSnapCaret, len(runes))
		q := ""
		if st.slashSnapStart >= 0 && st.slashSnapStart < queryEnd {
			q = string(runes[st.slashSnapStart+1 : queryEnd])
		}
		matched := filterSlashCommands(q)
		if len(matched) > 0 {
			idx := max(0, min(st.slashIndex, len(matched)-1))
			// Eat the trailing newline inserted by Enter if present.
			delEnd := queryEnd
			if delEnd < len(runes) && runes[delEnd] == '\n' {
				delEnd++
			}
			execSlashCommand(matched[idx].ID, st.slashSnapStart, delEnd)
		}
	}

	slashStart, slashQuery := detectSlash()
	if st.slashDismissedAt >= 0 && slashStart != st.slashDismissedAt {
		st.slashDismissedAt = -1
	}
	var slashMatches []slashCommand
	if slashStart >= 0 && st.slashDismissedAt != slashStart {
		slashMatches = filterSlashCommands(slashQuery)
		if st.slashIndex >= len(slashMatches) {
			st.slashIndex = max(0, len(slashMatches)-1)
		}
	}
	slashOpen := len(slashMatches) > 0

	root.Children(func() {
		// Single-line, quiet formatting strip with automatic overflow dropdown in
		// narrow drawers so no lone icon wraps onto a second row.
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
						Cursor(ui.CursorPointer).FocusRingColor(t.Accent).Transition(motionColorsFast())
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
				fmtBtn("bold", "加粗 ("+shortcutHint("B")+")", f.Bold == richtext.FormatOn, lucide.Bold(), func() { st.doc.ToggleBold() })
				fmtBtn("italic", "斜体 ("+shortcutHint("I")+")", f.Italic == richtext.FormatOn, lucide.Italic(), func() { st.doc.ToggleItalic() })
				if wideBar {
					fmtBtn("strike", "删除线", f.Strikethrough == richtext.FormatOn, lucide.Strikethrough(), func() { st.doc.ToggleStrikethrough() })
				}
				if wideBar || medBar {
					fmtBtn("code", "行内代码 ("+shortcutHint("E")+")", f.Code == richtext.FormatOn, lucide.Code(), func() { st.doc.ToggleCode() })
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
					linkAnchor = fmtBtn("link", "插入链接 ("+shortcutHint("K")+")", f.Link != "", lucide.Link(), func() {
						st.linkURL = f.Link
						st.linkOpen = !st.linkOpen
					})
				}

				// Overflow formatting dropdown for narrow drawers & compact panes
				if !wideBar {
					var overflow []overlay.MenuItem
					if !medBar {
						overflow = append(overflow,
							overlay.MenuItem{Key: "code", Label: "行内代码", Hotkey: shortcutHint("E"), Icon: lucide.Code()},
							overlay.MenuItem{Key: "quote", Label: "引用", Icon: lucide.Quote()},
							overlay.MenuItem{Key: "link", Label: "插入链接", Hotkey: shortcutHint("K"), Icon: lucide.Link()},
							overlay.MenuItem{Divider: true},
						)
					}
					overflow = append(overflow,
						overlay.MenuItem{Key: "strike", Label: "删除线", Icon: lucide.Strikethrough()},
						overlay.MenuItem{Key: "number", Label: "有序列表", Icon: lucide.ListOrdered()},
						overlay.MenuItem{Key: "codeblock", Label: "代码块", Icon: lucide.SquareCode()},
						overlay.MenuItem{Divider: true},
						overlay.MenuItem{Key: "table", Label: "插入表格", Icon: lucide.Table()},
						overlay.MenuItem{Key: "hr", Label: "插入分隔线", Icon: lucide.Minus()},
					)
					choice := appDropdown(c.Key(key+"-fmt-more"), &st.moreOpen, overflow, func(trigger ui.Element) {
						trigger.Label("更多格式").Tooltip("更多格式").Size(24, 24).Padding(0).Radius(5).Center().Shrink(0).
							Cursor(ui.CursorPointer).FocusRingColor(t.Accent).Transition(motionColorsFast())
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
						elevateFloatingSurface(c, panel.Width(280).Padding(12).Gap(8).Radius(10).AttachedOrigin().Transition(motionPopup()).Label("设置链接"))
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
				aiBtn := ui.ButtonBase(c.Key(key+"-ai")).Label("AI 生成描述").Tooltip("AI 辅助写作").Size(24, 24).Radius(5).Center().Shrink(0).Cursor(ui.CursorPointer).
					Transition(motionColorsFast())
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
				toggle := ui.ButtonBase(c.Key(key+"-mode-toggle")).Label(modeTip).Tooltip(modeTip).Size(24, 24).Radius(5).Center().Shrink(0).Cursor(ui.CursorPointer).
					Transition(motionColorsFast())
				col := t.TextTertiary.Alpha(0.80)
				if st.sourceMode {
					toggle.Background(t.BgSelected)
					col = t.Accent
				} else if toggle.Hovered() {
					toggle.Background(t.BgHover)
					col = t.TextPrimary
				}
				toggle.OnClick(func() {
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
				ed := appTextArea(c.Key(key+"-raw"), source, field.TextAreaProps{
					Variant:     field.InputBorderless,
					Placeholder: placeholder,
					MinRows:     6,
					MaxRows:     24,
				}).Label(label).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Padding(6, 16, 6, 4).ScrollbarInsets(14, 2, 20, 0).Disabled(readOnly)
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
			pasteGuard := ui.Column(c.Key(key + "-rich-wrap")).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Margin(8, -4, 18, -10).Clip().
				ObserveInput(func(ev ui.InputEvent) {
					if readOnly {
						return
					}
					if slashOpen && ev.Kind == ui.InputKeyDown && ev.Mods == 0 {
						_, curCaret := st.doc.Selection()
						switch ev.Key {
						case ui.KeyEscape:
							st.slashDismissedAt = slashStart
							return
						case ui.KeyDown:
							st.slashIndex = (st.slashIndex + 1) % len(slashMatches)
							st.slashRestoreCaret = curCaret
							return
						case ui.KeyUp:
							st.slashIndex = (st.slashIndex + len(slashMatches) - 1) % len(slashMatches)
							st.slashRestoreCaret = curCaret
							return
						case ui.KeyEnter:
							st.pendingSlashApply = true
							st.slashSnapStart = slashStart
							st.slashSnapCaret = curCaret
							return
						}
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
			var editorElem ui.Element
			hasEditorElem := false
			pasteGuard.Children(func() {
				editorElem = richtext.Editor(c.Key(key+"-rich"), st.doc, richtext.EditorOptions{
					Label:       label,
					Placeholder: placeholder,
					Font:        ui.Font{Size: 14, Weight: 400, LineHeight: 1.72},
					ReadOnly:    readOnly,
					Theme:       wysiwygThemeOf(c),
					OnLinkCommand: func() {
						st.linkURL = st.doc.Formatting().Link
						st.linkOpen = true
					},
				}).Background(ui.Transparent).BorderWidth(0).Radius(0).Grow(1).Basis(0).MinHeight(0).MinWidth(0)
				hasEditorElem = true
				if ref != nil {
					editorElem.Ref(ref)
				}
				if !editorElem.Focused() && st.composing {
					st.composing = false
					a.richComposing = false
				}
				if editorElem.Changed() || (!st.composing && st.doc.Version() != st.docVersion) {
					syncRichToSource()
				}
			})

			// "/" Slash Command Menu
			if !readOnly && hasEditorElem {
				_, caret := st.doc.Selection()
				editorFocused := editorElem.Focused()
				eb := editorElem.Bounds()
				winW, winH := c.Size()

				paraTopForRune := func(runePos int) float32 {
					boxes := st.doc.VisibleParagraphs()
					if len(boxes) == 0 {
						return eb.Y + 8
					}
					chosen := boxes[0]
					for _, b := range boxes {
						if b.Start <= runePos {
							chosen = b
						} else {
							break
						}
					}
					return eb.Y + chosen.Top
				}

				if slashOpen && (editorFocused || st.floatingHovered) {
					menuTop := paraTopForRune(slashStart) + 26
					if menuTop+220 > winH-16 {
						menuTop = max(12, paraTopForRune(slashStart)-226)
					}
					menuLeft := max(float32(12), min(eb.X+14, winW-248))
					ui.Overlay(c, func() {
						menu := ui.Column(c.Key(key+"-slash-menu")).Label("斜杠命令菜单").
							Absolute().Left(menuLeft).Top(menuTop).Width(232).MaxHeight(260).
							Padding(6).Gap(2).Radius(10).Transition(motionPopup())
						elevateFloatingSurface(c, menu)
						st.floatingHovered = menu.Hovered()
						menu.Children(func() {
							ui.Text(c, "插入内容").FontSize(11).FontWeight(600).TextColor(t.TextTertiary).Padding(2, 8, 4, 8)
							ui.Scroll(c.Key("slash-scroll")).MaxHeight(220).Gap(2).Children(func() {
								for i, cmd := range slashMatches {
									cItem := cmd
									sel := i == st.slashIndex
									row := ui.ButtonBase(c.Key("slash-"+cItem.ID)).Label("斜杠命令 "+cItem.Label).
										Height(30).FillWidth().Padding(0, 8).Radius(6).Justify(ui.Start).Cursor(ui.CursorPointer).
										Transition(motionColorsFast()).
										OnClick(func() {
											execSlashCommand(cItem.ID, slashStart, caret)
										})
									iconCol := t.TextSecondary
									if sel {
										row.Background(t.BgSelected)
										iconCol = t.Accent
									} else if row.Hovered() {
										row.Background(t.BgHover)
									}
									row.Children(func() {
										ui.Row(c).FillWidth().Gap(8).AlignItems(ui.Center).Children(func() {
											ui.Icon(c, cItem.Icon).Size(14, 14).TextColor(iconCol).Shrink(0).AccessHidden(true)
											ui.Text(c, cItem.Label).FontSize(12.5).FontWeight(500).TextColor(t.TextPrimary).Grow(1).MinWidth(0).SingleLine()
											ui.Text(c, cItem.Hint).FontSize(11).TextColor(t.TextTertiary).Shrink(0).SingleLine()
										})
									})
								}
							})
						})
					})
				} else {
					st.floatingHovered = false
				}
			}
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
