# Changelog

All notable changes to Hodor end up here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

Nothing has been released yet: everything below lives on `develop`.

## [Unreleased]

### 0.6.0-dev

#### Added

- **The desktop app's first look** (`pnpm --filter @hodor/gui dev`): Electron 45, React 19, electron-vite
  - Clusters: every context from every kubeconfig, live status with server version, ★ kubectl default, ↺ last used
  - Templates: your templates with their local ports, tags and which ones are running
  - Running: what's listening on which local port, copy the address, stop a template started from the terminal
  - Settings: Snow, Night or follow the system; language (English for now); kubectl and data folder info
- Snow and Night themes, IBM Plex Sans and Mono bundled locally, every string translatable
- Browser preview with sample data for design reviews: `pnpm --filter @hodor/gui preview:web`

#### Security

- Sandboxed, context-isolated renderer with no Node access and a strict Content-Security-Policy
- The renderer reaches only a typed API; each IPC call checks the sender frame and validates its arguments
- No navigation, no new windows, no webviews; every web permission denied except writing to the clipboard

#### Changed

- Settings now default to following the system theme; unused settings removed
- Removed the unused `i18next` dependency from the core

### 0.5.1-dev

#### Added

- `hodor clusters` reads **every** kubeconfig in `~/.kube`, checks which clusters are up (with server version), marks kubectl's default (★) and the last cluster used by Hodor (↺)
- `hodor template:stop [name] [--all]` stops templates running in another terminal
- `hodor template:edit <name>`: edit details, add/edit/remove/reorder forwards; offers to restart the template if it's running
- `hodor template:command <name>` prints the equivalent kubectl commands (or a full script with `--script`) for bash or PowerShell, optionally for one forward and a given `--context`
- `hodor template:run --logs` streams forward logs; the chosen cluster is remembered for next time
- `hodor template:list` shows which templates are running
- Unit tests for the core; opt-in integration tests (`HODOR_IT=1` real cluster, `HODOR_KEYCHAIN_IT=1` OS keychain)

#### Changed

- `hodor ctx` / `hodor ns` only work when kubectl is installed (they change kubectl's own defaults)
- `hodor config:merge` now merges into the default kubeconfig, with preview and confirmation; `-o` writes elsewhere
- Kubeconfig writes are atomic, `0600`, keep comments, and back up the previous file to `~/.hodor/backups` (last 10)
- Secure storage uses the OS keychain through `@napi-rs/keyring` (replaces the deprecated `keytar`)

#### Fixed

- **Port-forwarding actually works now.** It never opened a local port before. Each forward is a local listener on `127.0.0.1`, one stream per connection, service ports mapped to the pod's targetPort
- `KUBECONFIG` with several paths is split correctly on Windows
- The project builds; `pnpm-workspace.yaml` and `pnpm-lock.yaml` are no longer git-ignored

#### Removed

- The secure-storage "fallback" that kept secrets in memory and lost them on restart. No keychain, no secrets: Hodor tells you instead of pretending

### 0.1.0-dev – 0.5.0-dev

- Monorepo (pnpm workspaces): `@hodor/core`, `@hodor/cli`, `@hodor/gui` (empty until 0.6)
- Core: Kubernetes client wrapper, kubeconfig parsing/merging, context manager, template storage/manager/validator/executor, per-forward log capture, kubectl command generator
- CLI: `clusters`, `ctx`, `ns`, `config:merge`, `template:create|list|run|delete|export|import`
- Docs, CI workflow, issue/PR templates
