# Todo Electron Desktop

Electron desktop shell for the Todo app.

## What It Covers

- Desktop window: `1280x800`, minimum `900x600`, title `Todo`.
- Integrated title bar: macOS uses inset traffic lights and Windows uses Window Controls Overlay, while the app surface provides the draggable area.
- macOS tray menu with `显示 Todo` and `退出`.
- macOS close-to-hide behavior.
- System notifications through an Electron IPC bridge.
- Hash routing for desktop builds loaded from `file://`.
- Reuses the existing React frontend in `web/`.
- Bundles its own icon assets in `electron/icons/`.
- Keeps Chromium Developer Tools available in packaged builds for production diagnostics.

## Production Diagnostics

Open Developer Tools from the `开发` / `Developer` application menu. The shortcut is
`Option+Command+I` on macOS and `Control+Shift+I` on Windows and Linux.

To inspect task sync conflicts, enable the sync trace in the Console before reproducing the edit:

```js
window.__TODO_SYNC_DEBUG__ = true;
window.addEventListener('sync:trace', (event) => console.log('[sync:trace]', event.detail));
```

In the Network panel, compare the failed task request's `If-Match` header with the `latest.revision`
field in its `409` response. A lower `If-Match` value confirms that the local edit used a stale task
revision.

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

## Launch At Login

The desktop app exposes a Settings -> Launch at login switch for packaged macOS and Windows builds. It uses Electron's `app.setLoginItemSettings` API.

- macOS registers the app as a login item and starts hidden when launched by the system login item.
- Windows registers the installed `.exe` with the `--todo-startup-hidden` argument and checks the Task Manager startup-approved state.
- Development runs are intentionally unsupported so `electron .` is not added to the user's system startup items.

## macOS Notifications And Signing

macOS system notifications sent through Electron's native `Notification` API need the app bundle to be code signed. A build can be un-notarized and still work locally, but it should not be completely unsigned.

The packaged app uses bundle id `life.marlon.todo`. After changing signing mode, remove any stale notification permission for the old build and grant it again:

```bash
tccutil reset Notifications life.marlon.todo
```

### Development Signing

For a local development `.app` without an Apple Developer certificate, build an ad-hoc signed app:

```bash
cd electron
CSC_IDENTITY_AUTO_DISCOVERY=false npm run pack:dev-signed
npm run verify:mac-signature
open dist/mac*/Todo.app
```

Then open Settings -> Notifications and click "Allow system notifications", followed by "Test local notification".

This path uses `electron-builder --dir -c.mac.identity=- -c.mac.hardenedRuntime=false`. It is meant only for local testing. If macOS still suppresses the banner, check System Settings -> Notifications -> Todo and make sure alerts are enabled.

### Certificate Signing

For the final app, install a real signing identity in Keychain:

```bash
security find-identity -v -p codesigning
```

Useful identities are:

- `Developer ID Application: ...` for distribution outside the Mac App Store.
- `Mac Developer: ...` for local development builds. `Apple Development: ...` may work when passed explicitly with `CSC_NAME`, but `Developer ID Application` is the production path.

Then build with:

```bash
cd electron
CSC_NAME="Your Name (TEAMID)" npm run build:signed
npm run verify:mac-signature
```

`npm run build:signed` sets `forceCodeSigning=true`, so the build fails instead of silently producing an unsigned app when the certificate is missing. For normal `npm run build`, `electron-builder` will search Keychain automatically; if no identity exists it will skip signing.
