package app

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/choice"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
	"todo-native/internal/api"
)

func validCategoryColor(raw string) bool {
	if len(raw) != 7 || raw[0] != '#' {
		return false
	}
	_, err := hex.DecodeString(raw[1:])
	return err == nil
}

func categoryPayload(cat api.Category) (map[string]string, error) {
	name, emoji, color := strings.TrimSpace(cat.Name), strings.TrimSpace(cat.Emoji), strings.TrimSpace(cat.Color)
	if name == "" || utf8.RuneCountInString(name) > 50 {
		return nil, errors.New("分类名称应为 1–50 个字符")
	}
	if utf8.RuneCountInString(emoji) > 16 {
		return nil, errors.New("分类表情最多 16 个字符")
	}
	if emoji == "" {
		emoji = "📁"
	}
	if color == "" {
		color = "#3788d8"
	}
	if !validCategoryColor(color) {
		return nil, errors.New("分类颜色应为 #RRGGBB，例如 #3788d8")
	}
	return map[string]string{"name": name, "emoji": emoji, "color": color}, nil
}

func categoryPreview(c *ui.Context, cat api.Category) {
	name, emoji := strings.TrimSpace(cat.Name), strings.TrimSpace(cat.Emoji)
	if name == "" {
		name = "未命名分类"
	}
	if emoji == "" {
		emoji = "📁"
	}
	color := c.Theme().TextMuted
	if raw := strings.TrimSpace(cat.Color); validCategoryColor(raw) {
		color = ui.Hex(raw)
	}
	ui.Row(c).Gap(10).AlignItems(ui.Center).Grow(1).MinWidth(0).Label("分类预览 " + name).Children(func() {
		ui.Box(c).Width(10).Height(10).Radius(5).Shrink(0).Background(color).AccessHidden(true)
		ui.Text(c, emoji).FontSize(16).Shrink(0)
		ui.Text(c, name).FontSize(14).SingleLine().MinWidth(0).Tooltip(name)
	})
}

func (a *App) editCategory(cat api.Category) {
	if a.busy {
		return
	}
	if cat.ID == 0 {
		cat.Emoji, cat.Color = "📁", "#3788d8"
	}
	a.categoryDraft, a.categoryEditing, a.failure = cat, true, ""
}

func (a *App) categoriesView(c *ui.Context) {
	ui.Scroll(c.Key("categories-content")).Grow(1).MinHeight(0).Padding(24).Children(func() {
		ui.Row(c).Justify(ui.Center).Children(func() {
			ui.Column(c).Width(780).MaxWidthPercent(100).Gap(16).Children(func() {
				ui.Row(c).AlignItems(ui.Center).Children(func() {
					ui.Text(c, fmt.Sprintf("%d 个分类", len(a.categories))).FontSize(14).TextColor(c.Theme().TextMuted).Grow(1)
					newCatBtn := ui.ButtonBase(c.Key("add-category")).Label("新建分类").Tooltip("新建分类").Size(28, 28).Radius(7).Center().
						Background(tokensOf(c).Accent).Cursor(ui.CursorPointer).Disabled(a.busy).OnClick(func() { a.editCategory(api.Category{}) })
					if newCatBtn.Hovered() {
						newCatBtn.Background(tokensOf(c).AccentHover)
					}
					newCatBtn.Children(func() {
						ui.Icon(c, lucide.Plus()).Size(15, 15).TextColor(tokensOf(c).TextOnAccent).AccessHidden(true)
					})
				})
				ui.Text(c, "分类在本机立即可用，联网后同步到其他设备。").FontSize(12).TextColor(c.Theme().TextMuted)
				if len(a.categories) == 0 {
					appEmptyState(c, "还没有分类", "新建一个分类，让任务更容易查找。", "", nil)
				}
				ui.Column(c).BorderWidth(1, 0, 0, 0).BorderColor(c.Theme().Border).Children(func() {
					for _, cat := range a.categories {
						ui.Row(c.Key(cat.ID)).MinHeight(44).Padding(4).Gap(8).AlignItems(ui.Center).BorderWidth(0, 0, 1, 0).BorderColor(tokensOf(c).BorderSubtle).Children(func() {
							categoryPreview(c, cat)
							for _, op := range a.cache.CategoryOutbox {
								if op.CategoryID == cat.ID {
									display.Tag(c, "待同步", display.TagProps{Color: display.TagProcessing})
									break
								}
							}
							iconButton(c, "编辑分类 "+cat.Name, lucide.Pencil()).Size(28, 28).Padding(6).Disabled(a.busy).OnClick(func() { a.editCategory(cat) })
							holder := ui.Box(c.Key("category-actions")).Shrink(0)
							open := ui.Local(holder, "open", func() bool { return false })
							holder.Children(func() {
								key := appDropdown(c, open, []overlay.MenuItem{{Key: "delete", Label: "删除分类", Danger: true, Disabled: a.busy}}, func(trigger ui.Element) {
									styleAppButton(c, trigger, "", "ghost").Label("更多分类操作 "+cat.Name).Tooltip("更多操作").Size(28, 28).Padding(6).Disabled(a.busy).Children(func() {
										ui.Icon(c, lucide.Ellipsis()).Size(15, 15).TextColor(tokensOf(c).TextSecondary).AccessHidden(true)
									})
								})
								if key == "delete" && !a.busy {
									copy := cat
									a.deleteCategory = &copy
									a.failure = ""
								}
							})
						})
					}
				})
			})
		})
	})
}

func (a *App) categoryEditorView(c *ui.Context) {
	wasOpen := a.categoryEditing
	appDialog(c, &a.categoryEditing, func() {
		d := &a.categoryDraft
		title := "新建分类"
		if d.ID != 0 {
			title = "编辑分类"
		}
		ui.Text(c, title).FontSize(fontTitle).FontWeight(600)
		ui.Text(c, "保存后在本机生效，联网后自动同步到其他客户端。").TextColor(c.Theme().TextMuted)
		_, height := c.Size()
		reserved := float32(250)
		if a.failure != "" {
			reserved += 80
		}
		ui.Scroll(c.Key("category-editor")).Height(max(140, min(420, height-reserved))).Gap(14).Disabled(a.busy).Children(func() {
			layout.Block(c, layout.BlockProps{Variant: layout.BlockFilled}).Padding(14).Gap(10).Children(func() {
				ui.Text(c, "分类预览").FontSize(12).TextColor(c.Theme().TextMuted)
				categoryPreview(c, *d)
			})
			layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
				ui.Field(c, "分类名称", func() {
					if ui.TextInput(c, &d.Name).AutoFocus().Changed() {
						a.failure = ""
					}
				}).Description("1–50 个字符")
				ui.Field(c, "表情", func() {
					if ui.TextInput(c, &d.Emoji).Changed() {
						a.failure = ""
					}
				}).Description("可留空使用 📁")
				ui.Field(c, "颜色", func() {
					if ui.TextInput(c, &d.Color).Placeholder("#3788d8").Changed() {
						a.failure = ""
					}
				}).Description("#RRGGBB；留空使用默认蓝色")
				selected := ui.Hex("#3788d8")
				if raw := strings.TrimSpace(d.Color); validCategoryColor(raw) {
					selected = ui.Hex(raw)
				}
				before := selected
				swatches := choice.ColorSwatches(c, &selected, choice.ColorSwatchesProps{Colors: []choice.ColorSwatch{
					{Color: ui.Hex("#3788d8"), Title: "分类蓝色"}, {Color: ui.Hex("#16a34a"), Title: "分类绿色"},
					{Color: ui.Hex("#d97706"), Title: "分类橙色"}, {Color: ui.Hex("#dc2626"), Title: "分类红色"},
					{Color: ui.Hex("#9333ea"), Title: "分类紫色"}, {Color: ui.Hex("#64748b"), Title: "分类灰色"},
				}})
				// The returned radio group does not aggregate child change flags.
				// Commit input, then compare the local binding before copying it back.
				swatches.Changed()
				if selected != before {
					d.Color = fmt.Sprintf("#%02x%02x%02x", selected.R, selected.G, selected.B)
					a.failure = ""
				}
			})
		})
		if a.failure != "" {
			ui.Scroll(c.Key("category-editor-error")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "取消分类编辑", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.categoryEditing = false; a.categoryDraft = api.Category{}; a.failure = "" })
			appActionButton(c, "保存分类", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(func() {
				payload, err := categoryPayload(*d)
				if err != nil {
					a.failure = err.Error()
					return
				}
				method, path := "POST", "/categories"
				if d.ID != 0 {
					method, path = "PUT", fmt.Sprintf("/categories/%d", d.ID)
				}
				a.mutate(method, path, payload, 0, func() { a.categoryEditing = false; a.categoryDraft = api.Category{}; a.message = "分类已保存" })
			})
		})
	}).Width(500).MaxWidthPercent(95)
	if wasOpen && !a.categoryEditing {
		if a.busy {
			a.categoryEditing = true
		} else {
			a.categoryDraft = api.Category{}
		}
	}
}
