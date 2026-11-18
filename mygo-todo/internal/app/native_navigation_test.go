package app

import "github.com/egoist/mygo/ui"

// Follow the same responsive navigation path as a user, including the drawer.
func clickNavigation(tt *ui.Tester, label string) error {
	if _, ok := tt.AccessByRole(ui.RoleButton, "展开导航"); ok {
		if err := tt.Click("展开导航"); err != nil {
			return err
		}
	}
	return tt.Click(label)
}
