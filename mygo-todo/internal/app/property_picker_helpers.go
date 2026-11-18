package app

import (
	"fmt"
	"slices"
	"strings"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/syncer"
)

type propertyPickerFocus struct {
	anchor ui.Ref
	open   bool
}

type propertyPickerSession struct {
	close             func()
	entering, focused bool
}

type propertyPickerScopeKey struct{}

func propertyPickerScope(c *ui.Context) *propertyPickerSession {
	return ui.Local(c.Root(), propertyPickerScopeKey{}, func() propertyPickerSession { return propertyPickerSession{} })
}

func propertyPickerClose(c *ui.Context) func() {
	close := propertyPickerScope(c).close
	return func() {
		if close != nil {
			close()
		}
	}
}

func matchingPropertyCategories(categories []api.Category, query string) []api.Category {
	query = strings.ToLower(strings.TrimSpace(query))
	matches := make([]api.Category, 0, len(categories))
	for _, cat := range categories {
		if query == "" || strings.Contains(strings.ToLower(cat.Name), query) || strings.Contains(cat.Emoji, query) {
			matches = append(matches, cat)
		}
	}
	return matches
}

// Multi-select category picker: stays open across multiple toggles, filters
// live by name/emoji, and supports 1-click inline creation + auto-attachment
// when typing a new category name.
func (a *App) taskCategoryProperty(c *ui.Context, d *Draft) {
	t := tokensOf(c)
	holder := ui.Column(c.Key("category-property-picker")).Gap(6).MinWidth(0)
	query := ui.Local(holder, "query", func() string { return "" })
	hook := propertyPickerScope(c)
	entering := hook.entering
	hook.entering = false
	defer func() { hook.entering = entering }()
	close := propertyPickerClose(c)

	trimmedQuery := strings.TrimSpace(*query)
	exactMatch := slices.ContainsFunc(a.categories, func(cat api.Category) bool {
		return strings.EqualFold(strings.TrimSpace(cat.Name), trimmedQuery)
	})

	createInline := func(name string) {
		name = strings.TrimSpace(name)
		if name == "" || a.busy {
			return
		}
		if a.cacheError != "" {
			a.failure = a.cacheError
			return
		}
		cat := api.Category{Name: name, Color: "#3B66F5", Emoji: "📁"}
		if _, err := categoryPayload(cat); err != nil {
			a.failure = err.Error()
			return
		}
		before := make(map[int64]bool, len(a.categories))
		for _, item := range a.categories {
			before[item.ID] = true
		}
		state, err := syncer.QueueCategory(a.cache, "POST", cat)
		if err != nil {
			a.failure = err.Error()
			return
		}
		if err := a.store.SaveCache(state); err != nil {
			a.failure = fmt.Sprintf("无法保存本地分类：%v", err)
			return
		}
		savedDraft := *d
		a.adoptCache(state)
		*d = savedDraft
		if d.Categories == nil {
			d.Categories = make(map[int64]bool)
		}
		for _, item := range a.categories {
			if !before[item.ID] || strings.EqualFold(item.Name, name) {
				d.Categories[item.ID] = true
			}
		}
		*query = ""
		a.refresh()
	}

	holder.Children(func() {
		input := appInput(c.Key("category-search"), query, "搜索分类").Placeholder("搜索或直接输入新建分类…").FillWidth().MinWidth(0)
		if entering {
			input.Focus()
		}
		if input.Submitted() && trimmedQuery != "" && !exactMatch {
			createInline(trimmedQuery)
		}
		matches := matchingPropertyCategories(a.categories, *query)
		ui.Scroll(c.Key("category-options")).MaxHeight(220).MinWidth(0).KeepScrollbars(true).Gap(2).Children(func() {
			for _, cat := range matches {
				propertyMultiOption(c.Key(cat.ID), cat.Name, d.Categories[cat.ID], func() {
					if d.Categories == nil {
						d.Categories = make(map[int64]bool)
					}
					d.Categories[cat.ID] = !d.Categories[cat.ID]
				})
			}
			if len(matches) == 0 && trimmedQuery == "" {
				ui.Text(c, "尚无分类，可在上方输入名称直接创建").FontSize(12).TextColor(t.TextReadable).Padding(6, 4)
			}
		})
		if trimmedQuery != "" && !exactMatch {
			quickBtn := ui.ButtonBase(c.Key("quick-create-category")).Label("创建并关联分类 "+trimmedQuery).Height(34).FillWidth().Padding(0, 9).Radius(6).Justify(ui.Start).
				Background(t.Accent.Alpha(0.10)).OnClick(func() { createInline(trimmedQuery) })
			if quickBtn.Hovered() {
				quickBtn.Background(t.Accent.Alpha(0.18))
			}
			quickBtn.Children(func() {
				ui.Text(c, "＋ 创建「"+trimmedQuery+"」并关联").FontSize(13).FontWeight(500).TextColor(t.Accent).SingleLine()
			})
		}
		ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)
		mgrBtn := ui.ButtonBase(c.Key("create-category")).Label("新建分类").Height(32).FillWidth().Padding(0, 9).Radius(6).Justify(ui.Start)
		if mgrBtn.Hovered() {
			mgrBtn.Background(t.BgHover)
		}
		mgrBtn.OnClick(func() {
			close()
			a.editCategory(api.Category{Name: trimmedQuery})
		}).Children(func() {
			ui.Text(c, "＋ 打开分类编辑器…").FontSize(12).TextColor(t.TextSecondary)
		})
	})
}
