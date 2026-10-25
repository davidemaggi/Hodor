# Changelog

All notable changes to Hodor end up here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-10-25

Hodor 1.1 "Aegon" comes to Windows package managers.

### Added

- **winget and Chocolatey:** every release is published there too, from the signed installer: `winget install DavideMaggi.Hodor` or `choco install hodor`. New packages are reviewed by those repositories first, so a release can take a few days to show up

### Changed

- Every minor version now has its own codename, all starting with its major's letter: 1.0 was Aerys, 1.1 is **Aegon**

### Fixed

- Linux: the app icon shows in KDE, GNOME and other desktops. The packages carried a single 1024 px icon, a size desktops don't look for; they now install 16 to 512 px, and refresh the icon cache

## [1.0.1] - 2026-10-24

Merging gets a page of its own, clusters can be exported, and production clusters ask before they're touched.

### Added

- **Merge kubeconfigs page** (Clusters → Merge kubeconfig, or drop files on Clusters): add files, or take contexts from one of your own kubeconfigs; tick the contexts to bring over and choose which of your kubeconfigs receives them. Each context shows what will happen (new, under another name, already there) before you merge. The target is backed up first and keeps its comments
- **Export a kubeconfig** from the clusters you tick on the Clusters page: just those contexts with their clusters and users, in a new file only you can read. Names that clash between kubeconfigs are renamed, relative certificate paths become absolute
- `hodor config:export [contexts...]`: the same from the terminal (tick from a list without names, print it when redirected)
- `hodor config:merge` at a terminal asks which contexts and which kubeconfig, and shows the plan before writing
- Production clusters take an explicit yes: running a template on one asks again in the app, and `hodor template:run` / `hodor ctx` ask too (default No; `--yes` for scripts)

### Fixed

- Dragging forwards into a new order in the template editor did nothing
- The production switch and the "new version" toggle in Settings didn't save
- Windows: the signed installer is built and signed from a clean workspace, so it can't pick up another version's files

## [1.0.0] - 2026-10-23

**Hodor 1.0 "Aerys"**, the first stable release. Hodor holds your Kubernetes port-forwards open: save them as templates, run them on any cluster, from the desktop app or the `hodor` command. Four release candidates went before it; the app is the same as `1.0.0-rc.4`.

### What's in it

- **Clusters:** every context from every kubeconfig in `~/.kube`, which ones answer and their server version, kubectl's default and the last one you used. Browse namespaces, services and pods with their ports
- **Templates:** forwards saved by name, description and tags, without the cluster: you pick it when you run. Built by clicking ports, edited freely, searched, dragged into order, imported and exported
- **Running:** start and stop a forward, a template or everything; live state, connections, pod and logs per forward. Editing a running template offers a restart
- **Linked secrets and config maps:** see and copy their values while the forward runs, masked until you ask; the clipboard is wiped after 30 seconds
- **Tray:** close the window and your forwards keep running; copy addresses and linked values from the tray
- **kubectl:** switch its default context and namespace (when kubectl is installed), merge kubeconfigs with preview and backup, and get the equivalent `kubectl port-forward` commands for bash or PowerShell
- **The `hodor` command** comes with the app and needs no Node.js. `hodor` on its own opens a menu, and every command asks for what you leave out. The Windows installer puts it on your PATH, the Linux deb/rpm packages add `/usr/bin/hodor`, and on macOS the app offers to link it on first launch (Settings → Command line, any time)
- **English and Italian**, Snow and Night themes (or follow the system)
- An optional check for new releases on GitHub, which is the only thing Hodor ever asks the internet. No telemetry

### Downloads

- **Windows x64:** `Hodor-1.0.0-win-x64-signed.exe` (installer) or `-signed.zip`, code-signed by Davide Maggi (Certum). The unsigned `.exe` and `.zip` are there too
- **macOS** (Apple silicon `arm64`, Intel `x64`): `.dmg`, `.zip`. Not notarized by Apple yet: the README shows how to open it the first time
- **Linux** x64 and arm64: `.AppImage`, `.deb`, `.rpm`, `.tar.gz`

`SHA256SUMS` lists every file's checksum, and every file has a GitHub build attestation (`gh attestation verify <file> --repo davidemaggi/Hodor`).

### Tested on

- Kubernetes 1.34, 1.35, 1.36 and 1.37, on kind clusters in CI: the core's port-forwarding and the app's whole flow
- The app's smoke tests and the `hodor` command in a real terminal (ConPTY on Windows) on Linux, macOS and Windows, in CI
- By hand: the app on macOS and Windows, the CLI on Windows, the tray and close-to-tray
- The `.deb` installed in an Ubuntu 24.04 container. The `.rpm`, the AppImage and the Windows installer's PATH entry haven't been checked by hand yet: tell us if something's off

## [1.0.0-rc.4] - 2026-10-23

The fourth release candidate of Hodor 1.0 "Aerys", the first with a signed Windows build.

### Added

- Signed Windows builds: when the signing runner is online, each release also gets `Hodor-…-win-x64-signed.exe` and `-signed.zip`, code-signed with a Certum certificate, with their own checksums and attestations

## [1.0.0-rc.3] - 2026-10-23

The release workflow gained a signed Windows build, but it didn't make it into rc.3: these files are unsigned, like rc.2's. The app is the same as rc.2.

## [1.0.0-rc.2] - 2026-10-23

The second release candidate of Hodor 1.0 "Aerys": the `hodor` command, fixed on Windows and a lot friendlier everywhere.

### Fixed

- **Windows:** every list or question in `hodor` failed with `ERR_USE_AFTER_CLOSE`. The installed command runs on the app's own Electron, whose input isn't the console on Windows; Hodor now reads answers from the console directly

### Changed

- `hodor` on its own opens a menu of every command
- Leave out the argument and the command asks for it: `template:run`, `template:edit` and `template:delete` let you pick the template, `template:stop` picks among the running ones (or all of them), `template:command` asks for shell, forwards, context and format, `template:export` lets you tick templates and choose the file, `template:import` and `config:merge` ask for the file
- With no terminal to ask in (a script, a pipe), a missing argument is an error with a hint instead of a hang

### Downloads

Same files as rc.1, each with its `SHA256SUMS` entry and build attestation. The builds are still unsigned: see the README for opening them on macOS and Windows.

## [1.0.0-rc.1] - 2026-10-23

The first release candidate of Hodor 1.0 "Aerys". Hodor holds your Kubernetes port-forwards open: save them as templates, run them on any cluster, from the desktop app or the `hodor` command.

This is a **pre-release**: please try it and [open an issue](https://github.com/davidemaggi/Hodor/issues) when something breaks. The builds are **not code-signed** yet, so macOS and Windows will warn you the first time; the README explains how to open it anyway and how to check the download.

### What's in it

- **Clusters:** every context from every kubeconfig in `~/.kube`, which ones answer and their server version, kubectl's default and the last one you used. Browse namespaces, services and pods with their ports
- **Templates:** forwards saved by name, description and tags, without the cluster: you pick it when you run. Built by clicking ports, edited freely, searched, dragged into order, imported and exported
- **Running:** start and stop a forward, a template or everything; live state, connections, pod and logs per forward. Editing a running template offers a restart
- **Linked secrets and config maps:** see and copy their values while the forward runs, masked until you ask; the clipboard is wiped after 30 seconds
- **Tray:** close the window and your forwards keep running; copy addresses and linked values from the tray
- **kubectl:** switch its default context and namespace (when kubectl is installed), merge kubeconfigs with preview and backup, and get the equivalent `kubectl port-forward` commands for bash or PowerShell
- **The `hodor` command** comes with the app: the Windows installer puts it on your PATH, the Linux deb/rpm packages add `/usr/bin/hodor`, and on macOS the app offers to link it on first launch (Settings → Command line, any time)
- **English and Italian**, Snow and Night themes (or follow the system)
- An optional check for new releases on GitHub, which is the only thing Hodor ever asks the internet. No telemetry

### Downloads

macOS (Apple silicon and Intel): `.dmg`, `.zip` · Windows x64: installer `.exe`, `.zip` · Linux x64 and arm64: `.AppImage`, `.deb`, `.rpm`, `.tar.gz`. `SHA256SUMS` lists every file's checksum and each one has a GitHub build attestation.

### Tested on

Kubernetes 1.34, 1.35, 1.36 and 1.37, on kind clusters in CI. The app's smoke tests run on Linux, macOS and Windows.

## Before 1.0

The development milestones below were never released on their own; they are all part of 1.0.

### 0.9.0-dev

#### Added

- Run templates from the app: pick the cluster (last used preselected), see each forward's live state, connections, pod and errors
- Start/stop single forwards, restart or stop templates, "Stop everything"; logs per forward
- Linked secrets and config maps while running: masked values shown on request, copied by the main process, clipboard wiped after 30 seconds
- Tray (menu bar on macOS): running templates and forwards, copy addresses and linked values, stop things, open, quit
- Closing the window with templates running keeps Hodor and its forwards in the tray (Linux asks)
- Quitting with templates running asks first; one Hodor instance at a time

#### Changed

- Templates started in the app are registered with `source: "app"`: `hodor template:stop` asks the app to stop them instead of terminating the app process

#### Changed (after the Impeccable review of 0.8-0.9, 27/40)

- Production stays visible after Run: prod tag and amber edge on the run, "Running on <cluster>" in Templates, "Run on <cluster>" and an announced warning in the Run dialog, a note above production values
- Unsaved template edits are protected on every way out (sidebar, shortcuts, palette, Back)
- The command palette acts: run or stop a template, copy any running address; it matches ports
- Templates table fits the 960px minimum window (tags and updated move out, actions go icon-only)
- Config map values show straight away; secrets stay masked until asked
- Logs follow the tail and no longer flood screen readers; destructive confirmations are red; clearer labels ("Commands", "Secrets (2)", "Windows (PowerShell)")

#### Security

- The app can only read secrets and config maps linked to the running forward in its template; values are fetched one at a time on request and never stored

### 0.8.0-dev

#### Added

- Desktop app, Templates: create and edit templates by clicking ports on a cluster, with suggested local ports, linked secret/config map names, validation and conflict warnings
- Search, tag filters, drag & drop or Alt+↑/↓ reordering of templates and forwards (the order is saved)
- kubectl commands panel per template: bash or PowerShell, one forward or all, any context, full script
- Import/export of one or many templates from the app (native file dialogs)
- Editing a running template offers to restart it; deleting one stops it first
- Keyboard: `/` search, ⌘/Ctrl+K command palette, ⌘/Ctrl+1-4 sections
- Core: `ResourceBrowser.linkables` (secret and config map names only), `TemplateStorage.reorder`, template file schema, `suggestLocalPort`, `findPortConflicts`

#### Changed

- Template export format is now `{ "kind": "hodor-templates", "version": 1, "templates": [...] }` without ids or timestamps; old exports still import
- Imports are validated field by field and unknown fields are dropped; a name that already exists gets a ` (2)` suffix

### 0.7.0-dev

#### Added

- Desktop app, Clusters: open a cluster to browse its namespaces, services and pods with their ports; filter by name or port; reopened on restart
- Make a context kubectl's default and set its default namespace from the app (needs kubectl)
- Merge kubeconfigs from the app: pick or drop files, preview, confirm; or merge the file a context comes from in one click
- Core: `ResourceBrowser` (pods/services/namespaces summaries), `KubeConfigMerger.planMerge`, `ContextManager.mergeFiles`, `KubernetesApiError` keeping the HTTP status

#### Changed (after the Impeccable review, 25/40)

- Switching kubectl's default context or namespace from the app confirms what changed ("now points at X, was Y"), mentions the backup and offers Undo
- Clusters can be marked as production: switching kubectl to one asks first, and the top bar turns amber with a "prod" tag while kubectl points at it
- Running checks every local port and flags forwards that aren't listening
- Explanations that were tooltips are now on screen: why a context can't be switched, why a cluster doesn't answer, which service each template port maps to, a legend for ★ and ↺
- First run on Clusters: the empty state is the drop zone, with a button to choose a kubeconfig
- Accessibility: copy results announced in a status region, input borders at 3:1, no invalid ARIA on table rows, namespace field with a button as well as Enter
- Copy failures are reported instead of failing silently

#### Fixed

- Merging a kubeconfig (CLI and app) no longer drops the comments and formatting of your existing kubeconfig

#### Security

- Merges go through a single-use preview token: the renderer can never ask to write an arbitrary path
- Dropped files are checked in the main process (absolute path, regular file, under 5 MB, valid kubeconfig)

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
