package app

import (
	"fmt"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
	"todo-native/internal/api"
)

func taskMenuItems(task api.Task, busy bool) []overlay.MenuItem {
	items := []overlay.MenuItem{{Key: "open", Label: "查看与编辑", Disabled: busy}}
	if task.ReadOnly {
		items[0].Label = "查看只读任务"
		return items
	}
	scoped := !task.Recurring() || (task.InstanceID != "" && task.OccurrenceDate != "")
	suffix := "任务"
	if task.Recurring() {
		suffix = "本次"
	}
	if task.Status == "pending" {
		items = append(items, overlay.MenuItem{Key: "completed", Label: "完成" + suffix, Disabled: busy || !scoped})
		if task.Recurring() {
			items = append(items, overlay.MenuItem{Key: "skipped", Label: "跳过本次", Disabled: busy || !scoped})
		}
		items = append(items, overlay.MenuItem{Key: "cancelled", Label: "取消" + suffix, Disabled: busy || !scoped})
	} else {
		items = append(items, overlay.MenuItem{Key: "pending", Label: "恢复" + suffix + "待办", Disabled: busy || !scoped})
	}
	items = append(items, overlay.MenuItem{Key: "activity", Label: "提醒与活动记录", Disabled: busy || task.ID <= 0})
	deleteLabel := "删除任务"
	if task.Recurring() {
		items = append(items, overlay.MenuItem{Key: "series", Label: "编辑整个系列", Disabled: busy})
		deleteLabel = "删除整个系列"
	}
	return append(items, overlay.MenuItem{Divider: true}, overlay.MenuItem{Key: "delete", Label: deleteLabel, Danger: true, Disabled: busy})
}

func (a *App) performTaskAction(task api.Task, key string) {
	// Recheck availability when chosen; disabled menu items never bypass scope
	// or read-only restrictions, even if the row changed while it was open.
	allowed := false
	for _, item := range taskMenuItems(task, a.busy) {
		if item.Key == key && key != "" && !item.Disabled {
			allowed = true
			break
		}
	}
	if !allowed {
		return
	}
	switch key {
	case "open":
		a.openTask(task)
	case "completed", "pending", "cancelled", "skipped":
		a.setTaskStatus(task, key)
	case "activity":
		a.openTaskCenter(task)
	case "series", "delete":
		// A projected instance must never replace the canonical series anchor.
		for _, canonical := range a.tasks {
			if canonical.ID != task.ID || canonical.ReadOnly {
				continue
			}
			if key == "series" {
				a.editTask(canonical)
			} else {
				copy := canonical
				a.requestTaskTransition(func() { a.failure, a.deleteTask = "", &copy })
			}
			return
		}
		a.failure = "任务已变化，请刷新后重试"
	}
}

func (a *App) taskActions(c *ui.Context, task api.Task, visible ...bool) bool {
	ownsKeys := false
	holder := ui.Box(c.Key("task-actions")).Shrink(0)
	open := ui.Local(holder, "open", func() bool { return false })
	holder.Children(func() {
		key := appDropdown(c, open, taskMenuItems(task, a.busy), func(trigger ui.Element) {
			styleAppButton(c, trigger, "", "ghost").
				Label("更多操作 "+task.Title).Tooltip("更多操作").Size(32, 32).Radius(6).TextColor(tokensOf(c).TextSecondary).Disabled(a.busy).Children(func() {
				ui.Icon(c, lucide.Ellipsis()).Size(16, 16).TextColor(tokensOf(c).TextSecondary).AccessHidden(true)
			})
			ownsKeys = trigger.Focused()
			if len(visible) > 0 && !visible[0] && !*open && !trigger.Focused() {
				trigger.Opacity(0)
			}
		})
		if *open {
			a.taskMenuOpen = true
		}
		if key != "" {
			a.taskMenuOpen = false
			a.performTaskAction(task, key)
		}
	})
	return ownsKeys || *open
}

func taskRowKey(task api.Task) string { return fmt.Sprintf("%d:%s", task.ID, task.InstanceID) }
