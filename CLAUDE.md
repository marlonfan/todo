# Claude 使用说明

## 语言
所有回复请使用中文。

# Repository Guidelines

## Project Structure & Module Organization
- `cmd/server/main.go`: backend entrypoint and wiring.
- `internal/`: core backend code, split by layer:
  - `api/handler`, `api/middleware`, `api/router.go`
  - `service/` (business logic), `repository/` (data access), `models/` (entities)
  - `notify/` (notification plugins), `scheduler/`, `config/`, `database/`
- `migrations/`: schema migration logic.
- `pkg/utils/`: reusable helper utilities.
- `web/`: Vite + React frontend (`src/` for app code, `public/` for static assets).
- `deploy/` and `Dockerfile`: container/deployment assets.

## Build, Test, and Development Commands
- `make deps`: install Go and frontend dependencies.
- `make dev`: run frontend (`vite`) and backend (`air`) together for local development.
- `make run`: start backend with default config.
- `make run-config`: start backend with `config.yaml`.
- `make build`: run frontend build, then compile backend binary to `bin/todo-app`.
- `make test`: run backend tests (`go test -v ./...`).
- `cd web && npm test`: run frontend tests with Node’s built-in test runner.
- `cd web && npm run build`: run frontend tests and produce production bundle.
- After each code adjustment, first stop the existing process on `8080`: `lsof -tiTCP:8080 -sTCP:LISTEN | xargs -r kill`.
- Then start/restart the app with: `./build.sh && ./bin/todo-app`.

## Coding Style & Naming Conventions
- Go: format with `gofmt`/`go fmt`; keep package names short and lowercase; tests in `*_test.go`.
- Frontend: ES modules and React function components; existing code uses 2-space indentation and semicolons in many files.
- Naming:
  - Go exported identifiers: `PascalCase`; unexported: `camelCase`.
  - React components: `PascalCase` file names (for example `TaskList.jsx`).
  - Utility modules/hooks: `camelCase` files (for example `syncEngine.js`).

## Testing Guidelines
- Backend tests use Go `testing` package; keep tests close to implementation in the same package.
- Frontend tests use `node --test` with `*.test.js` naming (for example `calendarEventMerge.test.js`).
- Add regression tests for behavior changes in services, data sync, and calendar logic before merging.
- Before any frontend release, update the Service Worker cache version in `web/public/sw.js` when shipped frontend assets or static files change, and verify the production static cache policy still serves hashed `/assets/*` files with long-lived immutable caching while keeping `index.html`, `sw.js`, and `manifest.webmanifest` uncached/revalidated.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat(scope): ...`, `fix(scope): ...`, `chore: ...`, `ci: ...`, `build: ...`, `revert(scope): ...`.
- Keep subject lines imperative and focused on one change.
- PRs should include:
  - concise summary of what changed and why
  - linked issue (if applicable)
  - test evidence (`make test`, `cd web && npm test`)
  - screenshots/GIFs for UI changes in `web/`
