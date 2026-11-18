package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/egoist/mygo"
	_ "github.com/egoist/mygo/locales/zh-Hans"
	"todo-native/internal/app"
	"todo-native/internal/storage"
)

var applicationName = "Todo Native"

type mygoSecrets struct{}

func (mygoSecrets) Set(key string, value []byte) error { return mygo.Secrets.Set(key, value) }
func (mygoSecrets) Get(key string) ([]byte, error)     { return mygo.Secrets.Get(key) }
func (mygoSecrets) Delete(key string) error            { return mygo.Secrets.Delete(key) }

func main() {
	// Keep Electron and Native Todo's profiles and single-instance locks apart.
	mygo.App.SetName(applicationName)
	mygo.App.SetLanguages("zh-Hans")
	if !mygo.App.RequestSingleInstanceLock() {
		return
	}
	dir := os.Getenv("TODO_NATIVE_DATA_DIR")
	if dir == "" {
		root, err := os.UserConfigDir()
		if err != nil {
			log.Fatal(err)
		}
		dir = filepath.Join(root, "mygo-todo")
	}
	a := app.New(storage.Store{Dir: dir, Secrets: mygoSecrets{}})
	mygo.App.OnNotificationClick(a.OpenReminder)
	mygo.App.WhenReady(a.Start)
	mygo.App.OnSecondInstance(func([]string, string) { a.Show() })
	mygo.App.OnActivate(func(bool) { a.Show() })
	mygo.App.OnBeforeQuit(a.Quitting)
	mygo.App.OnQuit(a.Close)
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
