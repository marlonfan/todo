package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
)

func TestNativeDescriptionLivePreview(t *testing.T) {
	for _, occurrence := range []bool{false, true} {
		name := "task"
		if occurrence {
			name = "occurrence"
		}
		t.Run(name, func(t *testing.T) {
			a := autosaveFixture(t)
			label := "备注"
			if occurrence {
				a, _ = linearOccurrenceFixture(t)
				label = "本次描述"
				a.occurrenceEditing = true
				a.occurrenceTitle = a.selectedOccurrence.Title
				a.occurrenceDescription = a.selectedOccurrence.Description
			} else {
				a.descriptionPreview = false
				a.draft.Description = a.draft.Task.Description
			}
			tt := ui.NewTester(a.view, 1280, 900)
			if err := tt.Click(label); err != nil {
				t.Fatal(err)
			}
			tt.Key(ui.Cmd, ui.KeyA)
			handle := a.taskDescriptionInput
			for _, part := range []string{"#", "#", " ", "同步", "预览"} {
				tt.Type(part)
				tt.Frame()
				if a.taskDescriptionInput != handle {
					t.Fatal("native WYSIWYG editor replaced during typing")
				}
				if len(a.cache.Outbox) != 0 {
					t.Fatal("WYSIWYG persisted per keystroke")
				}
			}
			field, ok := tt.AccessByRole(ui.RoleTextField, label)
			if !ok {
				t.Fatal("WYSIWYG editor disappeared")
			}
			if field.Value != "同步预览" || strings.Contains(field.Value, "##") {
				t.Fatalf("WYSIWYG did not convert live heading shortcut: value=%q", field.Value)
			}
			if a.richDoc == nil || a.richDoc.Formatting().Paragraph.Heading != 2 {
				t.Fatalf("expected H2 block formatting, got %+v", a.richDoc.Formatting())
			}
			// Composition is still observed on the same native WYSIWYG input.
			tt.Compose("组合", 2)
			if !a.autosave.composing || a.flushDetailAutosave() {
				t.Fatal("WYSIWYG bypassed IME guard")
			}
			tt.Compose("", 0)
			tt.Frame()
			if !a.flushDetailAutosave() {
				t.Fatal(a.autosave.failure)
			}
			if len(a.cache.Outbox) != 1 {
				t.Fatal("expected one explicit durable save", len(a.cache.Outbox))
			}
			var body map[string]any
			if err := json.Unmarshal(a.cache.Outbox[0].Body, &body); err != nil {
				t.Fatal(err)
			}
			if occurrence {
				if body["instance_id"] != a.selectedOccurrence.InstanceID || body["occurrence_date"] != a.selectedOccurrence.OccurrenceDate || body["scope"] == "series" {
					t.Fatal("WYSIWYG escaped instance scope", body)
				}
				if a.tasks[0].Description != "系列描述" {
					t.Fatal("WYSIWYG changed series")
				}
			} else if body["description"] != "## 同步预览" || body["description"] != a.draft.Description {
				t.Fatal(body)
			}
		})
	}
}
