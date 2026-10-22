# 🗺️ Hodor Roadmap

Where Hodor is, and where it's going. No made-up dates: things ship when they work.

**Now:** `0.5.1-dev` · **Next stop:** `1.0.0 "Aerys"`

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

- 📋 Start/stop a _single_ forward of a running template from the CLI (the engine supports it, the CLI has no controls yet) → 0.9
- 📋 Kubernetes version compatibility strategy → 1.0 (see "Decisions")

---

## 🔜 0.6 · GUI foundation

- Electron + React + TypeScript app shell, secure defaults (context isolation, no node integration in the renderer, strict CSP)
- Core runs in the main process, renderer talks to it over a typed IPC bridge
- Snow (light) and Night (dark) themes, follows the OS by default
- i18n wiring (English default)
- Design with **Taste**, review with **Impeccable** (see [AGENTS.md](AGENTS.md))

## 📋 0.7 · Clusters page

- All contexts from all kubeconfigs, live status, ★ kubectl default, last used preselected on restart
- Change kubectl default context / namespace (hidden when kubectl is missing)
- Merge kubeconfigs (drop a file, preview, confirm)
- Pick a cluster → browse pods and services with their exposed ports

## 📋 0.8 · Templates page

- Build templates by picking pods/services and ports from the selected cluster
- Name, optional description, tags
- Search, tag filters
- Drag & drop to reorder templates and forwards (needs an explicit order in storage)
- Generate kubectl commands for a template or a single forward, per OS, copy to clipboard
- Import / export

## 📋 0.9 · Running templates, secrets & config maps

- Run a template on a cluster chosen at launch
- Start/stop a single forward, a template, or everything (GUI and CLI)
- Live logs per forward
- Link secrets / config maps to a forward; view values and copy them to the clipboard while it runs (values never written to disk or logs)
- Edit a running template → "restart now?"

---

## 📋 1.0.0 "Aerys" · First stable release

- Everything above, polished
- Italian translation next to English, CLI strings translated too
- Installers built by GitHub Actions **only on merge to `main`**: `.dmg` and `.zip` (macOS), NSIS `.exe` and `.zip` (Windows), `.AppImage`, `.deb`, `.rpm`, `.tar.gz` (Linux)
- Windows artifacts signed with **Azure Artifact Signing**
- The installer puts the `hodor` CLI on the `PATH`
- E2E tests (Playwright for the GUI) as the last gate before release

## 📋 1.1 · Package managers

- Homebrew, winget, Chocolatey (and friends)

## 💭 Later, maybe

- Tray icon with running templates
- Auto-update
- Cloud-provider sugar (EKS / AKS / GKE login helpers)

---

## Decisions

**Kubernetes versions.** Hodor talks to clusters through the official JavaScript SDK. The APIs it uses (core/v1, apps/v1, port-forward, `/version`) have been stable for years, so the SDK covers every version still in support. We'll only download a version-matched `kubectl` if we hit a real incompatibility, not preemptively.

**Templates are cluster-agnostic.** They store namespaces, resource names and ports. The cluster is picked when you run them.

---

## Version names

[Semantic Versioning](https://semver.org/). Every major gets a Game of Thrones character, one letter per major: `1.x` → A, `2.x` → B, and so on. Minors share the major's name, patches get no name at all.

| Version | Name      |
| ------- | --------- |
| 1.x     | **Aerys** |
| 2.x     | B… (TBD)  |

---

Got ideas? [Open an issue](https://github.com/davidemaggi/hodor/issues). Hodor listens. Hodor mostly says "Hodor", but he listens.
