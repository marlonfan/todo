.PHONY: dense-ui-smoke dev test build preview cross-build-check native-window-smoke designer-fixes-smoke title-editor-smoke linear-smoke empty-state-smoke smoke caldav-smoke notify-smoke account-smoke ai-smoke occurrence-smoke history-smoke calendar-drag-smoke task-actions-smoke sync-smoke incremental-smoke profile-offline-smoke category-offline-smoke category-backend-check calendar-export-check
CALENDAR_VALIDATOR_PYTHON ?= python3
dev:
	go tool mygo dev
test:
	go test -race ./...
build:
	go tool mygo build
preview:
	go tool mygo build -debug -skip-dmg
cross-build-check:
	go tool mygo build -platform linux/amd64,linux/arm64,windows/amd64,windows/arm64 -skip-installer -o build/cross-check
	@test -x build/cross-check/linux-amd64/mygo-todo
	@test -x build/cross-check/linux-arm64/mygo-todo
	@test -f 'build/cross-check/windows-amd64/Todo Native.exe'
	@test -f 'build/cross-check/windows-arm64/Todo Native.exe'
native-window-smoke:
	@if [ "$$(uname -s)" = Darwin ] && ioreg -n Root -d1 2>/dev/null | grep -q 'CGSSessionScreenIsLocked.*Yes'; then echo 'macOS 当前已锁屏，请解锁后重跑 make native-window-smoke；测试尚未开始。'; exit 2; fi
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/smoke.py
	python3 scripts/task_actions_smoke.py
	python3 scripts/occurrence_schedule_smoke.py
	python3 scripts/history_smoke.py
	python3 scripts/calendar_drag_smoke.py
	python3 scripts/sync_smoke.py
	python3 scripts/incremental_smoke.py
	python3 scripts/profile_offline_smoke.py
	python3 scripts/category_offline_smoke.py
	python3 scripts/account_smoke.py
	python3 scripts/notify_smoke.py
	python3 scripts/caldav_smoke.py
	python3 scripts/ai_smoke.py
	python3 scripts/linear_redesign_smoke.py
	python3 scripts/smoke.py --empty-only --artifacts artifacts/linear-empty
dense-ui-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/dense_ui_smoke.py --stage interaction

title-editor-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/title_editor_smoke.py
designer-fixes-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/designer_fixes_smoke.py
linear-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/linear_redesign_smoke.py
empty-state-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/smoke.py --empty-only --artifacts artifacts/linear-empty
smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/smoke.py
caldav-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/caldav_smoke.py
notify-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/notify_smoke.py

account-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/account_smoke.py

ai-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/ai_smoke.py

occurrence-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/occurrence_schedule_smoke.py

history-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/history_smoke.py

calendar-drag-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/calendar_drag_smoke.py

task-actions-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/task_actions_smoke.py

sync-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/sync_smoke.py

incremental-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/incremental_smoke.py

profile-offline-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/profile_offline_smoke.py

category-offline-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/category_offline_smoke.py

category-backend-check:
	TODO_CATEGORY_TEST_SERVER="$(abspath ../bin/todo-app)" go test -race -count=1 -timeout=90s ./internal/syncer -run TestCategoryBackend -v

calendar-export-check:
	cd .. && CGO_ENABLED=1 TODO_CALENDAR_TEST_ARTIFACTS="$(CURDIR)/artifacts/calendar-export" go test -race -count=1 -timeout=90s ./internal/service -run 'TestCalendarOccurrence|TestCalendarTimezone|TestCalendarMonthConstraint|TestLunarCalendarExport'
	$(CALENDAR_VALIDATOR_PYTHON) scripts/calendar_export_check.py

.PHONY: detail-interactions-smoke
detail-interactions-smoke:
	go build -tags=e2e -o build/qa/todo-native-qa .
	python3 scripts/detail_interactions_smoke.py --buildready

.PHONY: calendar-import-check
calendar-import-check:
	cd .. && CGO_ENABLED=1 go test -race -count=1 -timeout=90s ./internal/service ./internal/api -run 'TestCalendarImport|TestCalendarOccurrence|TestParseICalendar'
	TODO_NATIVE_TEST_ARTIFACTS="$(CURDIR)/artifacts" go test -race -count=1 ./internal/app -run TestNativeCalDAVOccurrenceActivityReadablePreview -v
