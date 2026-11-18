package app

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func (a *App) adoptCategoryAliases() {
	for oldID, newID := range a.cache.CategoryAliases {
		if a.quick.Draft.Categories[oldID] {
			delete(a.quick.Draft.Categories, oldID)
			a.quick.Draft.Categories[newID] = true
		}
		if a.quick.Base.Categories[oldID] {
			delete(a.quick.Base.Categories, oldID)
			a.quick.Base.Categories[newID] = true
		}
		if a.quick.Page == fmt.Sprintf("category:%d", oldID) {
			a.quick.Page = fmt.Sprintf("category:%d", newID)
		}
		if a.draft.Categories[oldID] {
			delete(a.draft.Categories, oldID)
			a.draft.Categories[newID] = true
		}
		if a.taskDraftBase != nil && a.taskDraftBase.Categories[oldID] {
			delete(a.taskDraftBase.Categories, oldID)
			a.taskDraftBase.Categories[newID] = true
		}
		if a.page == fmt.Sprintf("category:%d", oldID) {
			a.page = fmt.Sprintf("category:%d", newID)
		}
		if a.categoryDraft.ID == oldID {
			a.categoryDraft.ID = newID
		}
		if a.deleteCategory != nil && a.deleteCategory.ID == oldID {
			a.deleteCategory.ID = newID
		}
	}
}

func (a *App) queueCategory(method, path string, body any, after func()) {
	if a.busy {
		return
	}
	if a.cacheError != "" {
		a.failure = a.cacheError
		return
	}
	var category api.Category
	if method != "POST" {
		category.ID, _ = strconv.ParseInt(strings.TrimPrefix(path, "/categories/"), 10, 64)
	}
	if method == "DELETE" {
		for _, item := range a.categories {
			if item.ID == category.ID {
				category = item
				break
			}
		}
	} else {
		raw, err := json.Marshal(body)
		if err != nil {
			a.failure = err.Error()
			return
		}
		if err := json.Unmarshal(raw, &category); err != nil {
			a.failure = err.Error()
			return
		}
	}
	state, err := syncer.QueueCategory(a.cache, method, category)
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.run(func(context.Context) (func(), error) {
		if err := a.store.SaveCache(state); err != nil {
			return nil, fmt.Errorf("无法保存本地分类，请保留当前输入后重试：%w", err)
		}
		return func() {
			a.adoptCache(state)
			if after != nil {
				after()
			}
			a.message = "分类已保存到本机，等待同步"
			a.refresh()
		}, nil
	})
}

func (a *App) categorySyncCards(c *ui.Context) {
	blocked := map[int64]bool{}
	for _, op := range a.cache.CategoryOutbox {
		layout.Block(c.Key("category-"+op.ID), layout.BlockProps{Variant: layout.BlockOutlined}).Padding(16).Gap(12).Children(func() {
			ui.Row(c).Gap(8).Wrap().AlignItems(ui.Center).Children(func() {
				ui.Text(c, map[string]string{"POST": "新建分类", "PUT": "编辑分类", "DELETE": "删除分类"}[op.Method]).FontSize(18).Bold()
				label, color := "等待提交", display.TagProcessing
				if op.State == "rejected" {
					label, color = "需要处理", display.TagError
				} else if blocked[op.CategoryID] {
					label, color = "等待前序分类修改", display.TagWarning
				}
				display.Tag(c, label, display.TagProps{Color: color, Size: theme.Small})
			})
			categoryPreview(c, op.Local)
			if op.Method == "DELETE" {
				ui.Text(c, "任务会保留；仍引用此分类的待同步任务处理完成后，再移除服务器分类。").TextColor(c.Theme().TextMuted)
			}
			if op.CategoryID < 0 {
				ui.Text(c, "关联任务将等待服务器确认分类编号，随后自动同步。").FontSize(12).TextColor(c.Theme().TextMuted)
			}
			if op.Failure != "" {
				ui.Scroll(c).MaxHeight(100).Children(func() {
					feedback.Alert(c, "此分类修改尚未提交", feedback.AlertProps{Type: feedback.Warning, Description: op.Failure})
				})
			}
			ui.Row(c).Gap(8).Wrap().Children(func() {
				if op.State == "rejected" {
					appActionButton(c, "重新同步分类", action.ButtonProps{Variant: action.Primary}).Label("重新同步分类 " + op.Local.Name).Disabled(a.busy).OnClick(func() {
						a.changeOutbox(func(state storage.Cache) (storage.Cache, error) {
							state = syncer.Clone(state)
							for i := range state.CategoryOutbox {
								if state.CategoryOutbox[i].CategoryID == op.CategoryID {
									state.CategoryOutbox[i].State, state.CategoryOutbox[i].Failure = "pending", ""
								}
							}
							return state, nil
						})
					})
				}
				appActionButton(c, "放弃此分类的本地修改", action.ButtonProps{}).Label("放弃分类修改 " + op.Local.Name).Disabled(a.busy).OnClick(func() { id := op.CategoryID; a.discardCategoryID = &id })
			})
		})
		if op.State != "pending" {
			blocked[op.CategoryID] = true
		}
	}
}

func (a *App) categoryDiscardConfirmation(c *ui.Context) {
	open := a.discardCategoryID != nil
	ui.Modal(c, &open, func() {
		ui.Text(c, "放弃此分类的本地修改？").FontSize(fontTitle).Bold()
		feedback.Alert(c, "将移除此分类的全部待同步修改", feedback.AlertProps{Type: feedback.Warning, Description: "任务仍然保留；尚未确认编号的新分类将从本机待同步任务中解除关联。已送达服务器的操作不会撤销。"})
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "保留分类修改", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.discardCategoryID = nil })
			appActionButton(c, "确认放弃分类修改", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(func() {
				if a.discardCategoryID == nil {
					return
				}
				id := *a.discardCategoryID
				a.changeOutbox(func(state storage.Cache) (storage.Cache, error) { return syncer.DiscardCategory(state, id), nil })
			})
		})
	}).Width(500).MaxWidthPercent(95)
	if !open && !a.busy {
		a.discardCategoryID = nil
	}
}
