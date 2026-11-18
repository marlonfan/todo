package app

import (
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
