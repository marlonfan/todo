package app

import (
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/richtext"
)

func TestNativeDescriptionLivePreviewSyntaxAndSelection(t *testing.T) {
	cases := []struct{ name, source, rendered string }{
		{"heading", "## Heading 标题", "Heading 标题"},
		{"list", "- 列表 item\n- 第二项", "列表 item"},
		{"task-list", "- [ ] 待办 item\n- [x] 完成 done", "待办 item"},
		{"quote", "> 引用 quote", "引用 quote"},
		{"fenced-code", "```go\nfmt.Println(\"中文 hello\")\n```", "fmt.Println(\"中文 hello\")"},
		{"mixed-paste", "## 中英 Mixed\n\n粘贴 paste，标点 punctuation。", "中英 Mixed"},
		{"long-document", strings.TrimRight("## 长文 Long\n\n"+strings.Repeat("长文 paragraph English。\n\n- 列表 item\n\n", 200), "\n"), "长文 Long"},
	}
	for _, occurrence := range []bool{false, true} {
		kind := "task"
		if occurrence {
			kind = "occurrence"
		}
		for _, tc := range cases {
			t.Run(kind+"/"+tc.name, func(t *testing.T) {
				var a *App
				label := "备注"
				if occurrence {
					a, _ = linearOccurrenceFixture(t)
					a.occurrenceEditing = true
					a.occurrenceTitle = a.selectedOccurrence.Title
					a.occurrenceDescription = a.selectedOccurrence.Description
					label = "本次描述"
				} else {
					a = autosaveFixture(t)
					a.descriptionPreview = false
				}
				var focused bool
				tt := ui.NewTester(func(c *ui.Context) {
					a.view(c)
					input := c.Resolve(a.taskDescriptionInput)
					focused = input.Focused()
				}, 1280, 900)
				if err := tt.Click(label); err != nil {
					t.Fatal(err)
				}
				handle := a.taskDescriptionInput
				tt.Key(ui.Cmd, ui.KeyA)
				tt.SetClipboard(tc.source)
				before := time.Now()
				tt.Command("paste")
				tt.Frame()
				elapsed := time.Since(before)
				source := func() string {
					if occurrence {
						return a.occurrenceDescription
					}
					return a.draft.Description
				}
				if source() != tc.source {
					t.Fatalf("paste changed source: %q", source())
				}
				field, ok := tt.AccessByRole(ui.RoleTextField, label)
				if !ok || !strings.Contains(field.Value, tc.rendered) {
					t.Fatalf("missing WYSIWYG rendered text %q in %q", tc.rendered, field.Value)
				}
				if strings.Contains(field.Value, "## ") || strings.Contains(field.Value, "- [ ]") || strings.Contains(field.Value, "```go") {
					t.Fatalf("WYSIWYG leaked raw Markdown syntax into rendered text: %q", field.Value)
				}
				if tc.name == "task-list" {
					taskParas := 0
					for _, p := range a.richDoc.Text().Paragraphs() {
						if p.Style.List == richtext.Tasks {
							taskParas++
						}
					}
					if taskParas != 2 {
						t.Fatalf("task markers did not parse as interactive richtext tasks: %d", taskParas)
					}
					a.richDoc.ToggleChecked(0)
					tt.Frame()
					if !strings.HasPrefix(source(), "- [x] 待办 item") {
						t.Fatalf("toggling WYSIWYG checkbox did not update Markdown source: %q", source())
					}
					a.richDoc.ToggleChecked(0)
					tt.Frame()
				}
				// Keep a keyboard-created selection through multiple render frames.
				tt.Key(ui.Shift, ui.KeyLeft)
				tt.Frame()
				selAnchor, selCaret := a.richDoc.Selection()
				if selAnchor == selCaret {
					t.Fatal("keyboard failed to select WYSIWYG text")
				}
				for range 3 {
					tt.Frame()
				}
				afterAnchor, afterCaret := a.richDoc.Selection()
				if afterAnchor != selAnchor || afterCaret != selCaret || !focused || a.taskDescriptionInput != handle {
					t.Fatal("WYSIWYG frame rebuild changed native focus/selection/ref")
				}
				original := source()
				tt.Type("替换 X")
				tt.Frame()
				tt.Key(ui.Cmd, ui.KeyZ)
				tt.Frame()
				if source() != original {
					t.Fatalf("undo did not restore WYSIWYG edit: got %q want %q", source(), original)
				}
				if len(a.cache.Outbox) != 0 {
					t.Fatal("WYSIWYG/paste/selection wrote per input", len(a.cache.Outbox))
				}
				t.Logf("source_bytes=%d paste_and_render=%s (headless; informational, no wall-clock threshold)", len(tc.source), elapsed)
			})
		}
	}
}
