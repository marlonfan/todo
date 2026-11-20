package app

import (
	"math"
	"strconv"
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/storage"
)

func TestWYSIWYGModeToggleAndTableFallback(t *testing.T) {
	for _, width := range []int{420, 280} {
		t.Run(strconv.Itoa(width), func(t *testing.T) {
			a := New(storage.Store{Dir: t.TempDir()})
			defer a.Close()
			source := "## 预览首段\n\n" + strings.Repeat("长文中段\n\n", 40) + "预览尾段"
			var ref ui.Handle
			tt := ui.NewTester(func(c *ui.Context) {
				applyAppTheme(c)
				ui.Column(c).Fill().Padding(8).MinWidth(0).Children(func() {
					a.wysiwygMarkdownEditor(c, "ed", "doc-1", "备注", "占位", &source, false, &ref, nil, nil)
				})
			}, width, 600)
			tt.Frame()

			field, ok := tt.AccessByRole(ui.RoleTextField, "备注")
			if !ok || strings.Contains(field.Value, "## ") || !strings.Contains(field.Value, "预览首段") {
				t.Fatalf("expected WYSIWYG rich editor at width %d: %+v", width, field)
			}
			toggle, ok := tt.AccessByRole(ui.RoleButton, "切换为 Markdown 源码编辑")
			if !ok || toggle.Bounds.X < 0 || toggle.Bounds.X+toggle.Bounds.W > float32(width)+1 {
				t.Fatalf("mode toggle clipped at width %d: %+v", width, toggle)
			}
			// Switch to raw source mode and back without losing Markdown
			if err := tt.Click("切换为 Markdown 源码编辑"); err != nil {
				t.Fatal(err)
			}
			rawField, ok := tt.AccessByRole(ui.RoleTextField, "备注")
			if !ok || !strings.HasPrefix(rawField.Value, "## 预览首段") {
				t.Fatalf("raw source mode did not expose Markdown syntax: %q", rawField.Value)
			}
			if err := tt.Click("切换为所见即所得编辑"); err != nil {
				t.Fatal(err)
			}
			richAgain, ok := tt.AccessByRole(ui.RoleTextField, "备注")
			if !ok || strings.Contains(richAgain.Value, "## ") {
				t.Fatalf("switching back to WYSIWYG leaked syntax: %q", richAgain.Value)
			}

			// GFM table renders inline inside the live WYSIWYG editor (no locked fallback banner!)
			// and preserves its Markdown source losslessly.
			tableMD := "## 进度概览\n\n| 阶段 | 状态 |\n| --- | --- |\n| 重构 | 已完成 |\n\n---\n\n后续计划正常推进。"
			source = tableMD
			tt.Frame()
			if source != tableMD {
				t.Fatalf("inline WYSIWYG table mutated Markdown source: %q", source)
			}
			if tt.HasText("包含表格或扩展语法 · 已启用无损渲染") {
				t.Fatalf("unexpected legacy fallback banner in texts: %v", tt.Texts())
			}
			richWithTable, ok := tt.AccessByRole(ui.RoleTextField, "备注")
			if !ok || !strings.Contains(richWithTable.Value, "进度概览") || !strings.Contains(richWithTable.Value, "后续计划正常推进") {
				t.Fatalf("expected live WYSIWYG editor with inline table attachment, got %+v", richWithTable)
			}
			// Formatting toolbar remains active even with tables and dividers in the document
			if _, ok := tt.AccessByRole(ui.RoleButton, "一级标题"); !ok {
				t.Fatal("WYSIWYG formatting toolbar was hidden when document contained a table")
			}
		})
	}
}

func TestWYSIWYGToolbarSingleLineAndOverflowInNarrowDrawer(t *testing.T) {
	for _, width := range []int{600, 390, 280} {
		t.Run(strconv.Itoa(width), func(t *testing.T) {
			a := New(storage.Store{Dir: t.TempDir()})
			defer a.Close()
			source := "正文内容测试"
			var ref ui.Handle
			tt := ui.NewTester(func(c *ui.Context) {
				applyAppTheme(c)
				ui.Column(c).Fill().Padding(8).MinWidth(0).Children(func() {
					a.wysiwygMarkdownEditor(c, "ed", "doc-tb", "备注", "占位", &source, false, &ref, nil, func() {})
				})
			}, width, 500)
			tt.Frame()
			tt.Frame()

			h1, ok1 := tt.AccessByRole(ui.RoleButton, "一级标题")
			ai, ok2 := tt.AccessByRole(ui.RoleButton, "AI 生成描述")
			toggle, ok3 := tt.AccessByRole(ui.RoleButton, "切换为 Markdown 源码编辑")
			if !ok1 || !ok2 || !ok3 {
				t.Fatalf("missing toolbar controls at width %d", width)
			}
			if math.Abs(float64(h1.Bounds.Y-ai.Bounds.Y)) > 1 || math.Abs(float64(h1.Bounds.Y-toggle.Bounds.Y)) > 1 {
				t.Fatalf("toolbar wrapped onto multiple rows at width %d: h1=%+v ai=%+v toggle=%+v", width, h1.Bounds, ai.Bounds, toggle.Bounds)
			}
			if toggle.Bounds.X+toggle.Bounds.W > float32(width)+1 {
				t.Fatalf("toolbar overflowed right edge at width %d: %+v", width, toggle.Bounds)
			}
			if width < 448 {
				more, ok := tt.AccessByRole(ui.RoleMenuButton, "更多格式")
				if !ok || math.Abs(float64(more.Bounds.Y-h1.Bounds.Y)) > 1 {
					t.Fatalf("expected single-line overflow menu button at narrow width %d: %+v", width, more)
				}
				if err := tt.Click("更多格式"); err != nil {
					t.Fatal(err)
				}
				if err := tt.Click("插入分隔线"); err != nil {
					t.Fatal(err)
				}
				if !strings.Contains(source, "---") {
					t.Fatalf("overflow menu divider action did not update source at width %d: %q", width, source)
				}
			}
		})
	}
}

func TestWYSIWYGTableSpansFullEditorWidthAndTypographyHierarchy(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	source := "## 二级标题\n\n| 阶段 | 内容 | 状态 |\n| --- | --- | --- |\n| 计划 | 核心事项 | 进行中 |"
	var ref ui.Handle
	var h2Size float32
	tt := ui.NewTester(func(c *ui.Context) {
		applyAppTheme(c)
		theme := wysiwygThemeOf(c)
		h2Size = 14 * theme.Headings[1].Size
		ui.Column(c).Fill().Padding(10).MinWidth(0).Children(func() {
			a.wysiwygMarkdownEditor(c, "ed", "doc-table", "备注", "占位", &source, false, &ref, nil, nil)
		})
	}, 720, 540)
	tt.Frame()
	tt.Frame()

	if float32(detailTitleFontSize)-h2Size < 5.5 {
		t.Fatalf("title (%dpx) and body H2 (%.1fpx) lack sufficient visual hierarchy gap", detailTitleFontSize, h2Size)
	}
	var tableW float32
	for _, p := range a.richDoc.Text().Paragraphs() {
		if len(p.Runs) == 1 && p.Runs[0].Attributes.Attachment != nil {
			if meta, ok := p.Runs[0].Attributes.Attachment.Data.(richBlockAttachment); ok && meta.kind == "table" {
				tableW = p.Runs[0].Attributes.Attachment.Width
			}
		}
	}
	if tableW < 640 {
		t.Fatalf("expected inline table attachment to span full editor width (~690px), got %.1f", tableW)
	}
}
