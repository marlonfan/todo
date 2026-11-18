//go:build e2e

package main

import (
	"context"
	"encoding/json"
	"github.com/egoist/mygo"
	_ "github.com/egoist/mygo/plugins/automation"
	"os"
	"time"
	"todo-native/internal/app"
	"todo-native/internal/reminders"
)

func init() {
	// QA can run beside the user's application with a separate instance lock.
	if os.Getenv("TODO_NATIVE_QA") == "1" {
		applicationName = "Todo Native QA"
		if path := os.Getenv("TODO_NATIVE_QA_SIZE_FILE"); path != "" {
			mygo.App.OnWindowCreated(func(w *mygo.Window) {
				// Resize the actual NSWindow through MyGo, avoiding Accessibility's
				// visible-screen clamp. Captures still come from its native surface.
				go func() {
					ticker := time.NewTicker(50 * time.Millisecond)
					defer ticker.Stop()
					last := ""
					for range ticker.C {
						data, err := os.ReadFile(path)
						if err != nil || string(data) == last {
							continue
						}
						var size struct{ Width, Height int }
						if json.Unmarshal(data, &size) != nil || size.Width < 900 || size.Width > 2560 || size.Height < 600 || size.Height > 1400 {
							continue
						}
						last = string(data)
						w.Update(func() { w.SetSize(size.Width, size.Height) })
					}
				}()
			})
		}
		if path := os.Getenv("TODO_NATIVE_REMINDER_LOG"); path != "" {
			app.ReminderDelivery = func(ctx context.Context, c reminders.Candidate) error {
				if err := ctx.Err(); err != nil {
					return err
				}
				f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
				if err != nil {
					return err
				}
				defer f.Close()
				if err = json.NewEncoder(f).Encode(c); err != nil {
					return err
				}
				return f.Sync()
			}
		}
	}
}
