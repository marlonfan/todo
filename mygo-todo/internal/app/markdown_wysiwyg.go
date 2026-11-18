package app

import (
	"strings"

	"github.com/egoist/mygo/transfer"
	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/markdown/parser"
	"github.com/egoist/mygo/ui/richtext"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/field"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

type wysiwygEditorState struct {
	identity       string
	doc            *richtext.Document
	loadedSource   string
	lastSerialized string
	docVersion     uint64
	fenceLangs     []string
	sourceMode     bool
	composing      bool
	linkOpen       bool
	linkURL        string
	dark           bool
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

func extractTableData(d *parser.Document, tableIdx int) parsedTableData {
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
		td.colW[c] = 88
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
				font.Weight = 600
			}
			w, _ := ui.ShapeText(txt, font, 0).Size()
			td.colW[k] = max(td.colW[k], min(220, w+26))
			k++
		}
		td.rows = append(td.rows, cells)
		td.header = append(td.header, row.Header)
	}
	var sumW float32
	for _, w := range td.colW {
		sumW += w
	}
	td.totalW = max(180, min(460, sumW))
	rowCount := max(1, len(td.rows))
	td.totalH = float32(rowCount)*32 + 4
	return td
}

func drawWYSIWYGTable(p *ui.Painter, r ui.Rect, td parsedTableData, t designTokens) {
	if len(td.rows) == 0 || r.W <= 4 || r.H <= 4 {
		return
	}
	box := ui.Rect{X: r.X, Y: r.Y + 2, W: r.W, H: max(16, r.H-4)}
	const radius = 7.0
	p.Fill(box, t.BgApp, radius)

	cols := max(1, len(td.colW))
	var sumColW float32
	for _, w := range td.colW {
		sumColW += w
	}
	if sumColW <= 0 {
		sumColW = 1
	}
	rowH := box.H / float32(len(td.rows))

	p.Clip(box, radius, func() {
		for ri, row := range td.rows {
			ry := box.Y + float32(ri)*rowH
			rowRect := ui.Rect{X: box.X, Y: ry, W: box.W, H: rowH}
			if ri < len(td.header) && td.header[ri] {
				p.Fill(rowRect, t.BgSubtle, 0)
			} else if ri%2 == 1 {
				p.Fill(rowRect, t.BgSubtle.Alpha(0.35), 0)
			}
			if ri > 0 {
				p.Fill(ui.Rect{X: box.X, Y: ry, W: box.W, H: 1}, t.BorderSubtle, 0)
			}
			cx := box.X
			for ci := 0; ci < cols; ci++ {
				cw := box.W * (td.colW[ci] / sumColW)
				if ci == cols-1 {
					cw = box.X + box.W - cx
				}
				if ci > 0 {
					p.Fill(ui.Rect{X: cx, Y: ry, W: 1, H: rowH}, t.BorderSubtle, 0)
				}
				if ci < len(row) && row[ci] != "" {
					font := ui.Font{Size: 12.5, Weight: 400}
					fg := t.TextPrimary
					if ri < len(td.header) && td.header[ri] {
						font.Weight = 600
					}
					availW := max(1, cw-20)
					layout := ui.ShapeText(row[ci], font, availW)
					tw, th := layout.Size()
					tx := cx + 10
					if ci < len(td.aligns) {
						switch td.aligns[ci] {
						case parser.AlignCenter:
							tx = cx + max(6, (cw-tw)/2)
						case parser.AlignRight:
							tx = cx + max(6, cw-10-tw)
						}
					}
					ty := ry + max(2, (rowH-th)/2)
					p.TextLayout(layout, tx, ty, fg)
				}
				cx += cw
			}
		}
	})
	p.Stroke(box, t.BorderDefault, radius, 1)
}

func makeDividerAttachment(raw string, t designTokens) *richtext.Attachment {
	if strings.TrimSpace(raw) == "" {
		raw = "---"
	}
	return &richtext.Attachment{
		Width:  360,
		Height: 16,
		Name:   "分隔线",
		Data:   richBlockAttachment{kind: "hr", raw: raw},
		Draw: func(p *ui.Painter, r ui.Rect) {
			y := r.Y + r.H/2
			p.Fill(ui.Rect{X: r.X, Y: y, W: r.W, H: 1}, t.BorderDefault, 0)
		},
	}
}

func makeTableAttachment(d *parser.Document, idx int, raw string, t designTokens) *richtext.Attachment {
	td := extractTableData(d, idx)
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
			drawWYSIWYGTable(p, r, td, t)
		},
	}
}

func makeRawBlockAttachment(raw string, t designTokens) *richtext.Attachment {
	trimmed := strings.TrimSpace(raw)
	font := ui.Font{Family: "SF Mono, Menlo, ui-monospace, monospace", Size: 12, LineHeight: 1.45}
	layout := ui.ShapeText(trimmed, font, 340)
	_, th := layout.Size()
	h := max(32, th+16)
	return &richtext.Attachment{
		Width:  360,
		Height: h,
		Name:   trimmed,
		Data:   richBlockAttachment{kind: "rawblock", raw: raw},
		Draw: func(p *ui.Painter, r ui.Rect) {
			box := ui.Rect{X: r.X, Y: r.Y + 1, W: r.W, H: max(16, r.H-2)}
			p.Fill(box, t.BgSubtle, 6)
			p.Stroke(box, t.BorderSubtle, 6, 1)
			l := ui.ShapeText(trimmed, font, max(1, box.W-16))
			p.TextLayout(l, box.X+8, box.Y+7, t.TextSecondary)
		},
	}
}

// parseRichMarkdown converts CommonMark/GFM into richtext.Text while rendering
// GFM tables, horizontal dividers (---), and raw HTML/Math blocks as visual inline
// canvas attachments that round-trip their exact Markdown source on save.
func parseRichMarkdown(src string, t designTokens) richtext.Text {
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
			at := makeTableAttachment(d, idx, raw, t)
			paras = append(paras, richtext.Paragraph{
				Runs: []richtext.Run{{
					Text:       string(richtext.ObjectReplacement),
					Attributes: richtext.Attributes{Attachment: at},
				}},
			})
		case parser.ThematicBreak:
			flushSpan(b.Start)
			raw := strings.TrimRight(src[b.Start:b.End], "\r\n")
			at := makeDividerAttachment(raw, t)
			paras = append(paras, richtext.Paragraph{
				Runs: []richtext.Run{{
					Text:       string(richtext.ObjectReplacement),
					Attributes: richtext.Attributes{Attachment: at},
				}},
			})
		case parser.HTMLBlock, parser.MathBlock:
			flushSpan(b.Start)
			raw := strings.TrimRight(src[b.Start:b.End], "\r\n")
			at := makeRawBlockAttachment(raw, t)
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
	return &richtext.Theme{
		Text:                t.TextPrimary,
		Muted:               t.TextReadable,
		Link:                t.Accent,
		Caret:               t.Accent,
		Selection:           t.Accent.Alpha(0.18),
		CodeFont:            "SF Mono, Menlo, ui-monospace, monospace",
		CodeSize:            0.90,
		Code:                t.TextPrimary,
		CodeBackground:      t.BgSubtle,
		CodeBlockBackground: t.BgSubtle,
		CodeBlockRadius:     0.45,
		CodeBlockPadding:    [2]float32{0.95, 0.72},
		ParagraphSpacing:    0.58,
		Indent:              1.65,
		Marker:              t.TextSecondary,
		Checkbox:            t.Accent,
		Checkmark:           t.TextOnAccent,
		QuoteBar:            t.BorderDefault,
		QuoteText:           t.TextSecondary,
		QuoteBarWidth:       3,
		Headings: [6]richtext.HeadingStyle{
			{Size: 1.44, Weight: 650, Color: t.TextPrimary, Top: 0.55, Bottom: 0.24},
			{Size: 1.25, Weight: 650, Color: t.TextPrimary, Top: 0.48, Bottom: 0.20},
			{Size: 1.12, Weight: 600, Color: t.TextPrimary, Top: 0.40, Bottom: 0.16},
			{Size: 1.04, Weight: 600, Color: t.TextPrimary, Top: 0.34, Bottom: 0.14},
			{Size: 1.00, Weight: 600, Color: t.TextSecondary, Top: 0.28, Bottom: 0.12},
			{Size: 0.94, Weight: 600, Color: t.TextSecondary, Top: 0.25, Bottom: 0.12},
		},
	}
}

// wysiwygMarkdownEditor provides a single-surface WYSIWYG Markdown editor
// backed by MyGo's native richtext engine, with formatting controls, interactive
// task checkboxes, fence-language preservation, inline visual GFM tables and
// dividers, and an optional raw Markdown source toggle.
func (a *App) wysiwygMarkdownEditor(c *ui.Context, key, identity, label, placeholder string, source *string, readOnly bool, ref *ui.Handle, onEdit func(), onAI func()) {
	t := tokensOf(c)
	dark := c.Theme().Dark
	root := ui.Column(c.Key(key)).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Gap(6).Clip()
	st := ui.Local(root, "wysiwyg-state", func() wysiwygEditorState { return wysiwygEditorState{} })

	reloadDoc := func(src string) {
		langs, _ := inspectMarkdownSource(src)
		st.identity = identity
		st.loadedSource = src
		st.lastSerialized = src
		st.fenceLangs = langs
		st.dark = dark
		parsed := parseRichMarkdown(src, t)
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
		a.richComposing = false
		reloadDoc(*source)
	} else if !st.composing && *source != st.lastSerialized && *source != st.loadedSource {
		// External update (e.g. AI generation or remote sync rebase on clean draft).
		reloadDoc(*source)
	} else if st.dark != dark && !st.composing && !st.sourceMode {
		// Refresh attachment theme colors on light/dark theme switch.
		reloadDoc(*source)
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
		reloadDoc(*source)
	}

	root.Children(func() {
		// Whisper-quiet, borderless icon-only formatting strip — always active in
		// WYSIWYG mode, even when the note contains tables or dividers.
		toolbar := ui.Row(c.Key(key+"-toolbar")).MinHeight(26).Shrink(0).Padding(0, 2).Gap(1).Wrap().AlignItems(ui.Center)
		toolbar.Children(func() {
			if !st.sourceMode && !readOnly {
				f := st.doc.Formatting()
				fmtBtn := func(id, tip string, active bool, icon *ui.SVG, actionFn func()) ui.Element {
					btn := ui.ButtonBase(c.Key("fmt-"+id)).Label(tip).Tooltip(tip).Size(25, 25).Padding(0).Radius(5).Center().
						Cursor(ui.CursorPointer).FocusRingColor(t.Accent)
					fg := t.TextTertiary
					if active {
						btn.Background(t.BgSelected)
						fg = t.Accent
					} else if btn.Hovered() {
						btn.Background(t.BgHover)
						fg = t.TextPrimary
					}
					btn.OnClick(func() {
						actionFn()
						syncRichToSource()
						if ref != nil {
							ref.Focus()
						}
					})
					btn.Children(func() {
						ui.Icon(c, icon).Size(14, 14).TextColor(fg).AccessHidden(true)
					})
					return btn
				}

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
				ui.Box(c).Width(1).Height(12).Margin(0, 3).Background(t.BorderSubtle).AccessHidden(true)
				fmtBtn("bold", "加粗 (⌘B)", f.Bold == richtext.FormatOn, lucide.Bold(), func() { st.doc.ToggleBold() })
				fmtBtn("italic", "斜体 (⌘I)", f.Italic == richtext.FormatOn, lucide.Italic(), func() { st.doc.ToggleItalic() })
				fmtBtn("strike", "删除线 (⇧⌘X)", f.Strikethrough == richtext.FormatOn, lucide.Strikethrough(), func() { st.doc.ToggleStrikethrough() })
				fmtBtn("code", "行内代码 (⌘E)", f.Code == richtext.FormatOn, lucide.Code(), func() { st.doc.ToggleCode() })
				ui.Box(c).Width(1).Height(12).Margin(0, 3).Background(t.BorderSubtle).AccessHidden(true)
				fmtBtn("bullet", "无序列表", !f.ParagraphsMixed && f.Paragraph.List == richtext.Bullets, lucide.List(), func() { st.doc.ToggleList(richtext.Bullets) })
				fmtBtn("number", "有序列表", !f.ParagraphsMixed && f.Paragraph.List == richtext.Numbers, lucide.ListOrdered(), func() { st.doc.ToggleList(richtext.Numbers) })
				fmtBtn("task", "待办清单", !f.ParagraphsMixed && f.Paragraph.List == richtext.Tasks, lucide.ListTodo(), func() { st.doc.ToggleList(richtext.Tasks) })
				fmtBtn("quote", "引用", !f.ParagraphsMixed && f.Paragraph.Quote, lucide.Quote(), func() { st.doc.ToggleQuote() })
				fmtBtn("codeblock", "代码块", !f.ParagraphsMixed && f.Paragraph.CodeBlock, lucide.SquareCode(), func() { st.doc.ToggleCodeBlock() })
				fmtBtn("table", "插入表格", false, lucide.Table(), func() {
					insertMarkdownBlock("| 阶段 | 内容 | 状态 |\n| --- | --- | --- |\n| 计划 | 核心事项 | 进行中 |")
				})
				fmtBtn("hr", "插入分隔线", false, lucide.Minus(), func() {
					insertMarkdownBlock("---")
				})

				linkAnchor := fmtBtn("link", "插入链接 (⌘K)", f.Link != "", lucide.Link(), func() {
					st.linkURL = f.Link
					st.linkOpen = !st.linkOpen
				})
				if st.linkOpen {
					ui.PopoverBase(c.Key(key+"-link-popover"), linkAnchor, &st.linkOpen, func(panel ui.Element) {
						panel.AttachTo(linkAnchor, ui.AnchorBottomStart, ui.AnchorTopStart)
						elevatePopup(c, panel.Width(280).Padding(10).Gap(8).Radius(popoverRadius).Background(t.BgApp).Label("设置链接"))
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
				ui.Text(c, "Markdown 源码").FontSize(11).FontWeight(500).TextColor(t.TextSecondary).Padding(0, 4)
			}

			ui.Spacer(c)
			if onAI != nil && !readOnly {
				aiBtn := ui.ButtonBase(c.Key(key+"-ai")).Label("AI 生成描述").Tooltip("AI 辅助写作").Size(25, 25).Radius(5).Center().Cursor(ui.CursorPointer)
				aiCol := t.TextTertiary
				if aiBtn.Hovered() {
					aiBtn.Background(t.BgHover)
					aiCol = t.Accent
				}
				aiBtn.Disabled(a.busy).OnClick(onAI).Children(func() {
					ui.Icon(c, lucide.Sparkles()).Size(14, 14).TextColor(aiCol).AccessHidden(true)
				})
			}
			if !readOnly {
				modeTip := "切换为 Markdown 源码编辑"
				modeIcon := lucide.FileCode()
				if st.sourceMode {
					modeTip = "切换为所见即所得编辑"
					modeIcon = lucide.Eye()
				}
				toggle := ui.ButtonBase(c.Key(key+"-mode-toggle")).Label(modeTip).Tooltip(modeTip).Size(25, 25).Radius(5).Center().Cursor(ui.CursorPointer)
				col := t.TextTertiary
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
						reloadDoc(*source)
						st.sourceMode = false
					}
				}).Children(func() {
					ui.Icon(c, modeIcon).Size(14, 14).TextColor(col).AccessHidden(true)
				})
			}
		})

		// Main Editor Surface
		// Wrap the editor surface in a clipped flex container (Basis(0).MinHeight(0).Clip())
		// because MyGo invokes an element's own Draw callback before pushing its child
		// clip rect; clipping on the wrapper guarantees long descriptions never bleed
		// above into the toolbar/title or below into the bottom save footer.
		if st.sourceMode {
			rawWrap := ui.Column(c.Key(key + "-raw-wrap")).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Clip()
			rawWrap.Children(func() {
				ed := appTextArea(c.Key(key+"-raw"), source, field.TextAreaProps{
					Variant:     field.InputBorderless,
					Placeholder: placeholder,
					MinRows:     6,
					MaxRows:     24,
				}).Label(label).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Padding(6, 4).Disabled(readOnly)
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
				editor := richtext.EditorBase(c.Key(key+"-rich"), st.doc, richtext.EditorOptions{
					Label:       label,
					Placeholder: placeholder,
					Font:        ui.Font{Size: 14, LineHeight: 1.72},
					ReadOnly:    readOnly,
					Theme:       wysiwygThemeOf(c),
					OnLinkCommand: func() {
						st.linkURL = st.doc.Formatting().Link
						st.linkOpen = true
					},
				}).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Padding(6, 2)
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
