# Todo Electron Desktop

Electron implementation of the existing Tauri desktop shell.

## What It Covers

- Desktop window: `1280x800`, minimum `900x600`, title `Todo`.
- macOS tray menu with `显示 Todo` and `退出`.
- macOS close-to-hide behavior.
- System notifications through an Electron IPC bridge.
- Hash routing for desktop builds loaded from `file://`.
- Reuses the existing React frontend in `web/`.
- Reuses existing Tauri icon assets from `src-tauri/icons/`.

Android-specific Tauri token storage is intentionally not implemented.

## Development

Install dependencies once:

```bash
cd electron
npm install
```

Start the Electron shell with the Vite frontend:

```bash
npm run dev
```

Run the Go API separately:

```bash
cd ..
./build.sh && ./bin/todo-app
```

The frontend defaults to `http://127.0.0.1:8080/api` inside Electron. Override it with `VITE_API_BASE_URL` when needed.

## Build

```bash
cd electron
npm run build
```

This first runs `web`'s `build:desktop` script, then packages the app with `electron-builder`.
