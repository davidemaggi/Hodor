# @hodor/gui

The Hodor desktop app: Electron + React, built with electron-vite.

```bash
pnpm dev            # the app with hot reload
pnpm build          # typecheck + production build into out/
pnpm preview:web    # renderer only, in a browser, with sample data (design reviews)
```

```
src/main       window, security settings, IPC handlers (talks to @hodor/core)
src/preload    the bridge: exposes window.hodor, nothing else
src/shared     the API contract shared by main, preload and renderer
src/renderer   React app: views, components, styles (Snow/Night tokens), locales
```
