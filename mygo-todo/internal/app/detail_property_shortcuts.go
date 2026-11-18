package app

import (
	"strings"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
)

// Retained for callers/tests referencing toolbar property helpers.
func (a *App) detailPropertyShortcuts(c *ui.Context, d *Draft) {
	for _, item := range []struct {
		key, label string
		icon       *ui.SVG
	}{
		{"start", "日期", lucide.Calendar()}, {"priority", "优先级", lucide.Flag()},
		{"categories", "分类", lucide.Folder()}, {"repeat", "重复", lucide.Repeat()},
	} {
		key := item.key + ":toolbar"
		active := strings.HasPrefix(a.taskMetaOpen, key)
		value, set := a.detailPropertySummary(d, item.key)
		description := value
		if item.key == "start" {
			description = "未设置"
			if d.HasStart {
				description = draftDateSummary(true, d.Start, d.AllDay)
			}
		}
		trigger := ui.ButtonBase(c.Key("header-"+item.key)).Label("快捷设置"+item.label).Description(item.label+" · "+description).
			Height(30).MinWidth(30).Shrink(0).Padding(0, 5).Radius(6).Background(ui.Transparent).FocusRingColor(tokensOf(c).Accent).Disabled(d.Task.ReadOnly).OnClick(func() {
			if active {
				a.taskMetaOpen = ""
			} else {
				a.taskMetaOpen = key
			}
		})
		trigger.Tooltip(item.label + " · " + description).Children(func() {
			color := tokensOf(c).TextReadable
			if set || active {
				color = tokensOf(c).Accent
			}
			ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
				ui.Icon(c, item.icon).Size(14, 14).TextColor(color).AccessHidden(true)
				if item.key == "start" {
					ui.Text(c, value).FontSize(12).SingleLine().TextColor(tokensOf(c).TextReadable).AccessHidden(true)
				}
			})
		})
		open := ownedPropertyOpen(trigger, active)
		if active {
			propertyPopover(c.Key("header-popup-"+item.key), trigger, open, func() { a.taskMetadataEditor(c, &a.draft) }, item.key)
			if !*open {
				a.taskMetaOpen = ""
			}
		}
	}
}

func (a *App) detailPropertySummary(d *Draft, key string) (string, bool) {
	switch key {
	case "start":
		if !d.HasStart {
			return "日期", false
		}
		return d.Start.Format("01/02"), true
	case "priority":
		return d.Priority, d.Priority != "" && d.Priority != "普通"
	case "repeat":
		return recurrenceSummary(d), d.Repeat != "" && d.Repeat != "不重复"
	case "categories":
		names := []string{}
		for _, cat := range a.categories {
			if d.Categories[cat.ID] {
				names = append(names, strings.TrimSpace(cat.Emoji+" "+cat.Name))
			}
		}
		if len(names) > 0 {
			return strings.Join(names, "、"), true
		}
		return "未分类", false
	}
	return "未设置", false
}
