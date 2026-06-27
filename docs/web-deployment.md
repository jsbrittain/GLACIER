(web-deployment)=

# Web server deployment

```{warning}
Web server mode is **experimental** and not fully supported. Some features may behave differently or be unavailable compared to the desktop application. For production use, run the native Electron app.
```

GLACIER can run as a web server instead of an Electron desktop app. This is useful for deployments where users access the interface through a browser rather than installing a native application.

## Building and starting

```bash
npm run build
npm run server
```

The server starts on `http://localhost:3030`.

## How it works

The web server mode:

1. Serves the same React frontend that the Electron app uses (compiled to `dist/renderer/`).
2. Imports the backend logic from `dist/main/collection.js`.
3. Provides an HTTP API at `/api/*` that mirrors the IPC channels used in Electron mode.

The `src/renderer/services/api.ts` module automatically detects whether it is running inside Electron or in a browser and routes API calls accordingly — through `window.electronAPI` (IPC) in Electron mode, or through `fetch('/api/...')` in web mode.

## Differences from desktop mode

| Aspect | Electron | Web |
|--------|----------|-----|
| **API transport** | IPC (main process) | HTTP POST to `/api/*` |
| **File dialogs** | Native OS dialogs | Browser file picker |
| **Path defaults** | Electron `userData` / `documents` | `~/GLACIER` / `~/Documents/GLACIER` |
| **Environment checks** | Full system access | Same backend checks apply |
| **Open folder** | Opens file manager | Not available in browser |

## Browser compatibility

The frontend is compatible with modern Chromium, Firefox, and Safari browsers.
