# 🗺️ Hodor Roadmap

Where Hodor is, and where it's going. No made-up dates: things ship when they work.

**Now:** `0.7.0-dev` · **Next stop:** `1.0.0 "Aerys"`

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

## 🔜 0.8 · Templates page

- Keyboard shortcuts: `/` to filter, ⌘K command palette, ⌘1-4 for the sections

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

**Tray**

- Closing the window while forwards are running hides Hodor to the tray (menu bar on macOS) and keeps every forward alive; with nothing running, closing quits as usual
- The tray menu lists running templates and their forwards: copy the local address, copy the values of the forward's linked secrets and config maps, stop a forward or a template, stop everything
- Copied secret values are wiped from the clipboard after 30 seconds (only if the clipboard still holds them)
- "Quit Hodor" from the tray asks before stopping running forwards
- Linux: tray needs an AppIndicator-capable desktop; where there's none, closing the window asks instead of hiding

---

## 📋 1.0.0 "Aerys" · First stable release

- Everything above, polished
- Italian translation next to English, CLI strings translated too
- Installers built by GitHub Actions **only on merge to `main`**: `.dmg` and `.zip` (macOS), NSIS `.exe` and `.zip` (Windows), `.AppImage`, `.deb`, `.rpm`, `.tar.gz` (Linux)
- **Unsigned**, but verifiable: SHA256 checksums and GitHub build-provenance attestations for every artifact (`gh attestation verify <file> --repo davidemaggi/Hodor`)
- The installer puts the `hodor` CLI on the `PATH`
- E2E tests (Playwright for the GUI) as the last gate before release

## 📋 1.0.1 · Signed Windows builds

- Windows artifacts signed with a **Certum** certificate on a self-hosted runner
- From then on every release publishes both: the unsigned artifacts always, the signed ones when the signing runner is online (see "Decisions")

## 📋 1.1 · Package managers

- Homebrew, winget, Chocolatey (and friends)

## 💭 Later, maybe

- Auto-update
- Cloud-provider sugar (EKS / AKS / GKE login helpers)

---

## Decisions

**Kubernetes versions.** Hodor talks to clusters through the official JavaScript SDK. The APIs it uses (core/v1, apps/v1, port-forward, `/version`) have been stable for years, so the SDK covers every version still in support. We'll only download a version-matched `kubectl` if we hit a real incompatibility, not preemptively.

**Code signing.** Builds always run on GitHub-hosted runners. Only the Windows signing step runs on the maintainer's self-hosted runner (Certum needs it): it downloads the unsigned artifacts, signs them, uploads them as extra release assets. A preflight job checks whether that runner is online; if it isn't, the signed variant is skipped and the release still goes out unsigned. The signing job runs only on pushes to `main`, never on pull requests, behind a protected environment, because a self-hosted runner on a public repo must never execute code from forks.

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
