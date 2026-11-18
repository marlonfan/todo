package app

import (
	"strings"

	"github.com/egoist/mygo/transfer"
	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/markdown"
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
	complexSyntax  bool
	sourceMode     bool
	composing      bool
	linkOpen       bool
	linkURL        string
}

// inspectMarkdownSource detects fenced code block info strings (so we can
// restore ```go, ```json, etc. when serializing richtext back to Markdown) and
// checks whether the source uses constructs that richtext's flat paragraph
// model cannot round-trip losslessly (GFM tables, raw HTML attributes, ordered
// lists not starting at 1, thematic breaks, image titles).
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
			switch b.Kind {
			case parser.CodeBlock:
				if b.Fenced {
					lang := strings.TrimSpace(b.Info())
					fenceLangs = append(fenceLangs, lang)
				}
			case parser.Table, parser.HTMLBlock, parser.MathBlock, parser.ThematicBreak:
				complexSyntax = true
			case parser.Quote:
				if b.Alert != parser.NoAlert {
					complexSyntax = true
				}
			case parser.List:
				if b.Ordered && b.Number != 0 && b.Number != 1 {
					complexSyntax = true
				}
			}
			inlines := d.Inlines(idx)
			for k := 0; k < len(inlines); k++ {
				in := &inlines[k]
				switch in.Kind {
				case parser.Image:
					if in.Title != "" {
						complexSyntax = true
					}
				case parser.HTML:
					raw := strings.ToLower(strings.TrimSpace(in.Text))
					inner := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(raw, "<"), ">"))
					inner = strings.TrimPrefix(inner, "/")
					inner = strings.TrimSuffix(inner, "/")
					if strings.ContainsAny(inner, " \t=") {
						complexSyntax = true
					} else {
						switch inner {
						case "br", "u", "ins", "s", "strike", "del", "b", "strong", "i", "em":
						default:
							if inner != "" {
								complexSyntax = true
							}
						}
					}
				}
			}
			walk(idx)
		}
	}
	walk(0)
	return fenceLangs, complexSyntax
}

// serializeRichMarkdown exports richtext.Text to CommonMark/GFM while restoring
// fenced code block language tags recorded from the source document.
func serializeRichMarkdown(txt richtext.Text, fenceLangs []string) string {
	out := txt.Markdown()
	if len(fenceLangs) == 0 || !strings.Contains(out, "```") {
		return out
	}
	lines := strings.Split(out, "\n")
	inFence := false
	openFence := ""
	langIdx := 0
	for i, line := range lines {
		trimmed := strings.TrimLeft(line, "> ")
		prefix := line[:len(line)-len(trimmed)]
		if !inFence && strings.HasPrefix(trimmed, "```") {
			ticks := trimmed
			if strings.Trim(ticks, "`") == "" {
				inFence = true
				openFence = ticks
				if langIdx < len(fenceLangs) && fenceLangs[langIdx] != "" {
					lines[i] = prefix + ticks + fenceLangs[langIdx]
				}
				langIdx++
			}
		} else if inFence && trimmed == openFence {
			inFence = false
			openFence = ""
		}
	}
	return strings.Join(lines, "\n")
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
// task checkboxes, fence-language preservation, lossless fallback for GFM
// tables/HTML, and an optional raw Markdown source toggle.
func (a *App) wysiwygMarkdownEditor(c *ui.Context, key, identity, label, placeholder string, source *string, readOnly bool, ref *ui.Handle, onEdit func(), onAI func()) {
	t := tokensOf(c)
	root := ui.Column(c.Key(key)).Grow(1).MinHeight(140).MinWidth(0).Gap(6)
	st := ui.Local(root, "wysiwyg-state", func() wysiwygEditorState { return wysiwygEditorState{} })

	reloadDoc := func(src string) {
		langs, complex := inspectMarkdownSource(src)
		st.identity = identity
		st.loadedSource = src
		st.lastSerialized = src
		st.fenceLangs = langs
		st.complexSyntax = complex
		if st.doc == nil {
			st.doc = richtext.NewDocument(richtext.ParseMarkdown(src))
		} else {
			st.doc.SetText(richtext.ParseMarkdown(src))
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

	root.Children(func() {
		// Whisper-quiet, borderless icon-only formatting strip — no heavy gray box,
		// no bulky text buttons, letting editorial Markdown typography lead.
		toolbar := ui.Row(c.Key(key+"-toolbar")).MinHeight(26).Padding(0, 2).Gap(1).Wrap().AlignItems(ui.Center)
		toolbar.Children(func() {
			if !st.sourceMode && !st.complexSyntax && !readOnly {
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
			} else if st.complexSyntax && !st.sourceMode {
				ui.Text(c, "包含表格或扩展语法 · 已启用无损渲染").FontSize(11).TextColor(t.TextSecondary).Padding(0, 4)
			} else {
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
		if st.sourceMode {
			ed := appTextArea(c.Key(key+"-raw"), source, field.TextAreaProps{
				Variant:     field.InputBorderless,
				Placeholder: placeholder,
				MinRows:     6,
				MaxRows:     24,
			}).Label(label).Grow(1).MinHeight(120).MinWidth(0).Padding(6, 4).Disabled(readOnly)
			if ref != nil {
				ed.Ref(ref)
			}
			if ed.Changed() {
				st.lastSerialized = *source
				if onEdit != nil {
					onEdit()
				}
			}
		} else if st.complexSyntax {
			// Lossless rich surface for tasks containing GFM tables or custom HTML:
			// preserves every byte until explicitly edited in source mode.
			ui.Scroll(c.Key(key+"-complex-scroll")).Label("描述预览").Grow(1).MinHeight(120).MinWidth(0).Padding(4, 2).Children(func() {
				markdown.View(c, *source, &a.markdown)
				if !readOnly {
					appActionButton(c, "编辑源码", action.ButtonProps{Variant: action.Text, Size: theme.Small}).Margin(6, 0, 0, 0).OnClick(func() {
						st.sourceMode = true
					})
				}
			})
		} else {
			svc := c.Services()
			pasteGuard := ui.Column(c.Key(key + "-rich-wrap")).Grow(1).MinHeight(120).MinWidth(0).
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
					langs, complex := inspectMarkdownSource(plain)
					if complex {
						return
					}
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
				}).Grow(1).MinHeight(120).MinWidth(0).Padding(6, 2)
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
