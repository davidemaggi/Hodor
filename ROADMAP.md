# 🗺️ Hodor Roadmap

Where Hodor is, and where it's going. No made-up dates: things ship when they work.

**Now:** `1.0.0 "Aerys"` · **Next stop:** `1.1`

Legend: ✅ done and tested · 🔜 next · 📋 planned · 💭 maybe

---

## ✅ 0.1 – 0.5 · Core engine and CLI

What exists today and has been exercised against a real cluster.

**Clusters & kubeconfig**

- ✅ Find every kubeconfig in `~/.kube` (plus the `KUBECONFIG` default), list all contexts
- ✅ Live "is it up?" check per context, with server version
- ✅ kubectl's default context is highlighted (★), last cluster used by Hodor is remembered (↺)
- ✅ Change kubectl's default context / namespace (`hodor ctx`, `hodor ns`), only when kubectl is installed
- ✅ Merge downloaded kubeconfigs into the default one, with preview and confirmation
- ✅ Every kubeconfig write is atomic, owner-only (`0600`), keeps comments and is backed up to `~/.hodor/backups`

**Port-forwarding**

- ✅ Forward to pods, services (service port → targetPort, named ports too) and deployments
- ✅ Local listeners bind to `127.0.0.1` only
- ✅ Pod died? The next connection picks a healthy one
- ✅ Per-forward logs (`--logs`)

**Templates**

- ✅ Create, list, search, filter by tag, edit everything, reorder forwards, delete
- ✅ Templates hold resource names only: no servers, contexts or credentials
- ✅ Run on any cluster, chosen at run time
- ✅ Stop one or all running templates from another terminal
- ✅ Editing a running template offers to restart it
- ✅ Export / import one or many templates
- ✅ Generate the equivalent `kubectl` commands or script for bash (Linux/macOS) and PowerShell

**Plumbing**

- ✅ Secrets go to the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- ✅ Unit tests for the core, opt-in integration tests against a real cluster and keychain

**Not done yet, carried forward**

- 📋 Start/stop a _single_ forward from the CLI (the app can) → 1.1
- 📋 Kubernetes version compatibility strategy → 1.0 (see "Decisions")

---

## ✅ 0.6 · GUI foundation

- ✅ Electron + React + TypeScript shell with secure defaults: sandbox, context isolation, no Node in the renderer, strict CSP, no navigation or new windows, every web permission denied except clipboard write
- ✅ Core runs in the main process; the renderer only reaches a typed API, every IPC call checks its sender and validates its arguments
- ✅ Snow (light) and Night (dark), follows the OS by default; native title bar and window controls follow the theme
- ✅ i18n wiring, English default, every string in `locales/en.json`
- ✅ Clusters (live status, ★ kubectl default, ↺ last used), Templates and Running (stop a CLI-started template from the app) read real data; Settings saves theme and language
- ✅ Loading, empty, first-run and error states for every view
- ✅ Designed with **Taste** (framed-sheet style); checked with its inspector in both themes
- 🔜 **Impeccable** review: waiting for the skill to be installed for Claude Code

## ✅ 0.7 · Clusters page

- ✅ All contexts from all kubeconfigs, live status, ★ kubectl default; the cluster you pick is remembered and reopened on restart
- ✅ Make a context kubectl's default and set its default namespace (only when kubectl is installed; contexts from other files are offered a one-click merge first)
- ✅ Merge kubeconfigs: pick or drop files, preview what's new and what's skipped, confirm; comments in your kubeconfig survive, a backup is taken first
- ✅ Browse a cluster: namespaces (or type one when you may not list them), services and pods with their ports, status, readiness, restarts and age, filter by name or port
- ✅ Unreachable cluster: what Hodor tried, plus the `kubectl cluster-info` command to see why
- ✅ Production clusters: confirm before kubectl points at them, amber top bar while it does; Undo after every kubectl change
- ✅ Impeccable review (25/40) acted on: P1s and P2s fixed; keyboard shortcuts move to 0.8, live forward status to 0.9

## ✅ 0.8 · Templates page

- ✅ Build templates by clicking ports of services and pods on a cluster; local ports suggested (80 → 10080, 5432 → 15432) avoiding ports other templates use; pods owned by a Deployment are forwarded through the Deployment
- ✅ Edit everything: name, description, tags, forwards (kind, name, namespace, ports), linked secret and config map names (suggested from the cluster)
- ✅ Inline validation: duplicate local ports or names, invalid names and ports, ports shared with other templates
- ✅ Search (names, tags, ports), tag filters, drag & drop (or Alt+↑/↓) to reorder templates and forwards
- ✅ kubectl commands for a template or one forward, for bash (Linux/macOS) or PowerShell, any context, single commands or a full script, one click to copy
- ✅ Import and export one or many templates; imports keep only template fields, so files can't smuggle cluster details in
- ✅ Edit a running template → "Restart now?"; delete a running one → stops it first
- ✅ Keyboard: `/` to search, ⌘/Ctrl+K palette, ⌘/Ctrl+1-4 sections

## ✅ 0.9 · Running templates, secrets & config maps

- ✅ Run a template from the app on a cluster picked at launch (last used preselected, production clusters flagged, port clashes with other running templates warned)
- ✅ Live state per forward: running, error with its reason, stopped, connections, resolved pod
- ✅ Start/stop a single forward, restart or stop a template, stop everything (app and terminal runs)
- ✅ Logs per forward
- ✅ Linked secrets and config maps: keys listed, values masked until shown (hidden again after 30 s), copied by the main process and wiped from the clipboard after 30 s; only names linked to that forward can be read
- ✅ The CLI sees templates started in the app and can stop or restart them without closing the app
- ✅ Tray / menu bar: running templates and forwards, copy addresses and linked values, stop a forward, a template or everything, open, quit (asks first)
- ✅ Closing the window with templates running hides Hodor and keeps the forwards up; on Linux it asks instead
- ⚠️ Not verified by hand yet: clicking the tray menu items and the real close button (tested through the same code paths and a unit-tested close policy, but not by a human click)

## ✅ 1.0.0 "Aerys" · First stable release

Released after four release candidates (`1.0.0-rc.1` to `rc.4`), installed and used on real machines.

**Scope**

- ✅ Italian next to English: app, CLI, tray and dialogs
- ✅ Kubernetes compatibility: the core's port-forwarding and the app's full flow on `kind` 1.34–1.37, in CI on every push
- ✅ "A new version is out" notice from GitHub Releases (no auto-update), can be turned off
- ✅ No telemetry, said plainly in the README
- ✅ A guided `hodor`: a menu on its own, a question for every argument left out

**Install**

- The `hodor` CLI ships inside the app and runs on Electron's Node (no Node.js needed), like VS Code's `code`:
  - ✅ Windows: works in a real console (checked by hand and in CI under ConPTY); 🔜 the per-user installer's PATH entry, still to be checked by hand
  - ✅ Linux: `.deb` installs `/usr/bin/hodor` and removes it again (checked in an Ubuntu 24.04 container); 🔜 `.rpm` and AppImage on a real machine; the `.tar.gz` links `~/.local/bin/hodor` from the app
  - ✅ macOS: the app offers "Install the hodor command" on first launch (symlink in `/usr/local/bin`)
- ✅ Artifacts: macOS arm64 and x64 (`.dmg`, `.zip`), Windows x64 (NSIS `.exe`, `.zip`, signed and unsigned), Linux x64 and arm64 (`.AppImage`, `.deb`, `.rpm`, `.tar.gz`)
- ✅ App id `dev.davidemaggi.hodor` (bundle id, Windows AppUserModelID, keychain service): fixed forever
- ✅ SHA256 checksums and GitHub build-provenance attestations for every file; the README explains how to open the unsigned macOS build

**Release**

- ✅ Release builds run on GitHub Actions **only on merge to `main`**: version read from `package.json`; when its tag already exists nothing is published; tag + GitHub Release with notes from CHANGELOG; versions with a suffix (`-rc.N`) are pre-releases
- ✅ E2E tests (Playwright): smoke tests and the `hodor` command on the three OSes, the full flow against `kind` on Linux
- ✅ By hand: the whole app on macOS and Windows, the CLI on Windows, tray and close-to-tray

## ✅ Signed Windows builds (from 1.0.0-rc.4)

- ✅ Windows artifacts signed with a **Certum** certificate on a self-hosted runner: `Hodor.exe` and the installer carry the "Open Source Developer Davide Maggi" signature, with checksums and attestations (first done for `1.0.0-rc.4`)
- ✅ Every release publishes both: the unsigned artifacts always, the signed ones when the signing runner is online (see "Decisions")

## ✅ 1.0.1 · Merge, export, production guard

- ✅ A Merge page: pick the contexts to bring over and the kubeconfig that receives them, with a preview of what happens to each (app and `hodor config:merge`)
- ✅ Export a kubeconfig from the clusters you pick (app and `hodor config:export`)
- ✅ Production clusters ask before a template runs on them or kubectl points at them (app and CLI)
- ✅ Fixed: reordering forwards by drag & drop, the production switch, the update toggle

## 🔜 1.1.0 "Aegon" · Windows package managers

- ✅ Every stable release goes to winget (`DavideMaggi.Hodor`) and Chocolatey (`hodor`) on its own, once the signed installer is on the release. Each package is installed for real on Windows before it's submitted (tested end to end without submitting)
- 🔜 The first submissions accepted by winget-pkgs and the Chocolatey moderators
- ✅ Linux: the app icon shows in KDE, GNOME and friends
- ✅ Every minor version has its own codename

## 📋 1.2 · More package managers

- Homebrew; check its current rules for unsigned/un-notarized casks first. Then Linux repositories
- Start/stop single forwards from the CLI

## 💭 Later, maybe

- Auto-update
- Cloud-provider sugar (EKS / AKS / GKE login helpers)

---

## Decisions

**Kubernetes versions.** Hodor talks to clusters through the official JavaScript SDK. The APIs it uses (core/v1, apps/v1, port-forward, `/version`) have been stable for years, so the SDK covers every version still in support. We'll only download a version-matched `kubectl` if we hit a real incompatibility, not preemptively.

**Code signing.** Builds always run on GitHub-hosted runners. Only the Windows signing step runs on the maintainer's self-hosted runner (Certum needs it): it downloads the unpacked app, signs it, a GitHub-hosted job builds the installer from it unchanged, the runner signs the installer, and the signed files are added to the release. A preflight job checks whether that runner is online; if it isn't, the signed variant is skipped and the release still goes out unsigned. The signing job runs only on pushes to `main`, never on pull requests, behind a protected environment, because a self-hosted runner on a public repo must never execute code from forks.

**Templates are cluster-agnostic.** They store namespaces, resource names and ports. The cluster is picked when you run them.

---

## Version names

[Semantic Versioning](https://semver.org/). Every minor gets a Game of Thrones character, and all the minors of a major start with the same letter: `1.x` → A, `2.x` → B, and so on. Patches get no name of their own.

| Version | Name      |
| ------- | --------- |
| 1.0     | **Aerys** |
| 1.1     | **Aegon** |
| 2.x     | B… (TBD)  |

---

Got ideas? [Open an issue](https://github.com/davidemaggi/hodor/issues). Hodor listens. Hodor mostly says "Hodor", but he listens.
