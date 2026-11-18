package app

import (
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/richtext"
)

// Capability probe for the pinned native dependency, not a production editor.
// Remove this negative capability assertion when MyGo exposes rich composition.
func TestDescriptionRichtextCompositionCapability(t *testing.T) {
	doc := richtext.NewDocument(richtext.NewText("原文 original"))
	var ref ui.Ref
	var composing, changed bool
	tt := ui.NewTester(func(c *ui.Context) {
		e := richtext.EditorBase(c, doc).Fill().Ref(&ref).Label("rich description probe")
		composing = e.Composing()
		changed = changed || e.Changed()
	}, 500, 400)
	if err := tt.Click("rich description probe"); err != nil {
		t.Fatal(err)
	}
	doc.SetSelection(0, 2)
	tt.Frame()
	tt.Compose("zhong", 5)
	if composing {
		t.Fatal("dependency now exposes rich composition: reassess integration gate")
	}
	if doc.Text().String() != " original" || !changed {
		t.Fatalf("expected selected text deletion published during preedit: text=%q changed=%v", doc.Text().String(), changed)
	}
	// This is precisely why Changed alone cannot authorize serialization/save.
	tt.Type("中文")
	if doc.Text().String() != "中文 original" {
		t.Fatal(doc.Text().String())
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if doc.Text().String() != "原文 original" {
		t.Fatal("IME undo did not restore original")
	}
}

func TestDescriptionRichtextSerializationLimits(t *testing.T) {
	for _, tc := range []struct{ name, source, lost string }{
		{"fence language", "```go\nfmt.Println(1)\n```", "```go"},
		{"table", "| A | B |\n| --- | --- |\n| one | two |", "| --- |"},
		{"HTML attributes", "<span data-private=\"keep\">hello</span>", "data-private"},
		{"image title", "![alt](https://example.com/a.png \"title\")", "\"title\""},
		{"ordered start", "7. seven\n8. eight", "7."},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := richtext.ParseMarkdown(tc.source).Markdown()
			if strings.Contains(got, tc.lost) {
				t.Fatalf("capability changed; reassess loss gate: %q", got)
			}
			t.Logf("source=%q serialized=%q", tc.source, got)
		})
	}
}
