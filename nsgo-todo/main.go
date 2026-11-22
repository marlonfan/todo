package main

import (
	"github.com/nsgo-dev/nsgo"

	"nsgo-todo/internal/app"
)

func main() {
	// WindowSize is used when previewing on desktop (phone portrait proportions);
	// Android and iOS automatically use the device screen size.
	nsgo.Run(app.Root, nsgo.WindowSize(400, 844))
}
