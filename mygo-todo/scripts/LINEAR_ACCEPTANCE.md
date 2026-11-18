# Native Linear acceptance

Run on an unlocked macOS desktop **after the parent finishes the UI changes**. Run native window suites sequentially; the redesign script must have exclusive use of the QA window. The script's lock prevents two redesign runs, but cannot coordinate other smoke scripts or a person manipulating the window.

From the repository root:

```sh
go build -o bin/todo-app ./cmd/server
cd mygo-todo
go build -tags=e2e -o build/qa/todo-native-qa .
python3 scripts/linear_redesign_smoke.py --artifacts artifacts/linear
```

The script does not build binaries. Rebuild first so captures represent current source. It uses a random localhost port, SQLite database, API-registered account, seeded session, isolated native profile and notification file sink. It never stops port 8080 or uses an existing account/profile.

Each run writes a unique subdirectory containing `report.json`, native/backend logs, PNGs and accompanying accessibility/window JSON. The report records requested sizes separately from actual native bounds, and PNG pixel sizes separately from logical sizes. A screen/window-manager constraint on 1920 (or another width) fails the run and retains its actual capture; use a suitably sized display to complete acceptance. There is no fallback to a smaller width or headless screenshot.

## Automated coverage

- 1024, 1280, 1600 and 1920 widths, each in light and dark; actual frames are captured and reported.
- Native content window without WebView; API-seeded long title, long category, long Markdown and complex recurrence fixtures.
- Read-first title and description; explicit editors; save only for dirty/new tasks; no permanent `未修改` status.
- Seven property actions in vertical rows; each popover stays inside the actual window. Opening/closing property editors must not dirty data.
- Protected close and continue editing; narrow back-to-list and reselect retains title and description draft.
- Empty description entry and API-confirmed save; expandable activity module and real activity/reminder panel.
- Search empty/results, Enter opens detail, return preserves query and Esc exits. Quick add Enter persists, resets input, and Esc protects nonempty input.
- Settings and calendar captures in each size/theme; inbox/today/upcoming/completed/cancelled/skipped/categories captures.
- Description save preserves complex recurrence JSON and canonical series anchor.
- Validation failure retains input. Stopped disposable backend produces a persistent offline queue with truthful pending status; restart preserves content and operation IDs; reconnect creates exactly one task with the retained description.

## Headless UI regression and business suites

```sh
cd mygo-todo
go test ./internal/app -run 'TestLinearDetailReadEditAndVerticalProperties|TestNativeTaskNavigationAndValidation|TestNativeTaskWorkspaceKeepsSelectionAndDraft|TestNativeTaskMenuKeepsInstanceScopeAndCanonicalSeries|TestNativeMarkdownDescriptionPreview|TestNativeNotify' -count=1
go test ./...
# Real windows, sequentially, after the focused redesign acceptance:
make native-window-smoke
```

The shared `Native` helper enters title editing through `编辑任务标题`, description editing through `添加描述…`/`编辑描述`, and activity through `任务活动`. The existing scripts retain their business assertions for recurrence instances, revisions, conflict resolution, reminders and offline operation IDs. The redesign script complements those suites; its own PASS does not certify every business integration.

## Required human acceptance

Review the newly generated screenshots against the full `Todo-Native-Linear-UIUX-实施验收基准.md`. The script verifies geometry where there is an observable contract, but does not claim to measure typography, visual quality, or human input behavior.

Check SF/PingFang typography, semantic colors/contrast, neutral icons, spacing, density, aligned toolbar baselines, no large cards or excessive borders, title wrapping, category truncation, Markdown natural height, and absence of clipped/covered controls. Check hover, focus, Tab order, list keyboard navigation, Cmd+F/K/N/S where implemented, Chinese IME and trackpad input, splitter drag/persistence, reduced motion, and loading/error feedback. Confirm actual empty task-list and no-selection states as well as empty search/description captures. Review calendar/settings and auxiliary pages in both themes. Run the existing AI, notification, CalDAV, recurrence, sync, account and category suites for their business assertions. App/DMG packaging and Designer sign-off remain separate parent deliverables.

A failed build/test must be reported with its actual output and fixed at its source; do not skip assertions or relabel old captures as current acceptance.
