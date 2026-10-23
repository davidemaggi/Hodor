<div align="center">

<img src="assets/brand/hodor-icon.svg" width="128" height="128" alt="Hodor icon: a door, held open" />

# Hodor

**Holds the door to your Kubernetes clusters.**

Port-forwards you can save, share, and run on any cluster, without seven terminal tabs of `kubectl port-forward`.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/davidemaggi/Hodor?include_prereleases&label=release)](https://github.com/davidemaggi/Hodor/releases)
[![CI](https://github.com/davidemaggi/Hodor/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/davidemaggi/Hodor/actions/workflows/ci.yml)

</div>

---

> 🧪 **1.0 "Aerys" is in release candidate.** Grab the latest release candidate from [Releases](https://github.com/davidemaggi/Hodor/releases), try it on your clusters, and [tell me what breaks](https://github.com/davidemaggi/Hodor/issues). What's next is in the [roadmap](ROADMAP.md).

## Why

You know the drill. API on 8080, Postgres on 5432, Redis on 6379, three terminals, one of them died twenty minutes ago and you only notice now. Then you need the DB password: `kubectl get secret`, `base64 -d`, copy, paste, swear.

Then you do the same thing on staging. Same services, different cluster, start over.

Hodor fixes that:

- **Templates.** Bundle the forwards you always need, give them a name and some tags, run them with one command.
- **Cluster-agnostic.** Templates store namespaces, resource names and ports. No servers, no contexts, no credentials. You pick the cluster when you run them, so the same template works on dev, staging and prod.
- **Every kubeconfig.** Hodor reads everything in `~/.kube`, tells you which clusters are up, and highlights kubectl's default ★.
- **Plays nice with kubectl.** Switch kubectl's default context and namespace, merge that kubeconfig you just downloaded, or ask Hodor for the plain `kubectl` commands (bash or PowerShell) when you need them somewhere else.

## Install

Download the file for your system from [Releases](https://github.com/davidemaggi/Hodor/releases). One install gives you both the desktop app and the `hodor` command.

| System                        | File                                     | `hodor` on your PATH                         |
| ----------------------------- | ---------------------------------------- | -------------------------------------------- |
| macOS (Apple silicon / Intel) | `Hodor-…-mac-arm64.dmg` / `-mac-x64.dmg` | the app offers it on first launch            |
| Windows x64                   | `Hodor-…-win-x64.exe` (the installer)    | added by the installer (open a new terminal) |
| Debian, Ubuntu                | the `.deb` for your architecture         | `/usr/bin/hodor`                             |
| Fedora, RHEL, openSUSE        | the `.rpm` for your architecture         | `/usr/bin/hodor`                             |
| Any Linux                     | `.AppImage` or `.tar.gz`                 | see below                                    |

Changed your mind about the PATH? **Settings → Command line** shows where `hodor` points and can (re)install it.

### "Hodor can't be opened" (macOS)

The 1.0 builds aren't signed with an Apple Developer ID yet, so Gatekeeper complains the first time. Hodor is open source and every file comes with a checksum and a build attestation ([check them](#check-your-download)). To open it anyway:

1. Drag Hodor to Applications and open it once. macOS says it can't verify it: click **Done**.
2. Open **System Settings → Privacy & Security**, scroll down to the message about Hodor and click **Open Anyway**, then confirm.

Prefer the terminal? `xattr -dr com.apple.quarantine /Applications/Hodor.app` does the same.

### "Windows protected your PC"

Releases may come with a **signed** Windows installer, `Hodor-…-win-x64-signed.exe`: take that one when it's there. The plain installer next to it isn't code-signed, so SmartScreen warns about it: click **More info → Run anyway**. Either way the installer is per user and doesn't ask for admin rights.

### AppImage and tar.gz

The AppImage runs anywhere: `chmod +x Hodor-*.AppImage` and start it. It can't put `hodor` on your PATH, since the file can move; use the deb, rpm or tar.gz if you want the command.

The tar.gz unpacks to a folder: start `hodor-app` inside it, then **Settings → Command line → Install** links `~/.local/bin/hodor` for you.

### Check your download

Every release has a `SHA256SUMS` file and a [GitHub build attestation](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations) for each file, proving it was built by this repository's release workflow:

```bash
sha256sum -c SHA256SUMS --ignore-missing          # macOS: shasum -a 256 -c SHA256SUMS --ignore-missing
gh attestation verify Hodor-1.0.0-rc.2-mac-arm64.dmg --repo davidemaggi/Hodor
```

## The desktop app

- **Clusters:** every context from every kubeconfig in `~/.kube`, who's up, ★ kubectl's default, ↺ the last one you used. Open one to browse namespaces, services and pods with their ports.
- **Templates:** click ports on a cluster to build a template; edit, tag, search, drag into order, import and export.
- **Running:** start and stop single forwards, templates or everything; live state, connections and logs; the values of linked secrets and config maps, masked until you ask.
- **Tray:** close the window and the forwards keep running. Copy addresses and values from the tray.
- **kubectl:** switch its default context and namespace, merge kubeconfigs (dropped on the window or picked), and get the plain `kubectl port-forward` commands.
- English or Italian, Snow or Night, `⌘K` / `Ctrl+K` for the command palette.

## The `hodor` command

Type `hodor` on its own and it shows a menu of everything it can do. Leave out a name and it asks: `hodor template:run` lists your templates, then your clusters. Names and options are still there for scripts and muscle memory:

```bash
hodor clusters                    # every context in ~/.kube, who's up, ★ kubectl default
hodor ctx                         # change kubectl's default context (needs kubectl)
hodor ns                          # change kubectl's default namespace (needs kubectl)
hodor config:merge ~/Downloads/staging.yaml   # merge into your kubeconfig (backed up first)

hodor template:create             # interactive wizard
hodor template:list --tags dev    # list, filter, search
hodor template:run dev-stack      # pick a cluster, hold the doors
hodor template:run dev-stack -c staging --logs
hodor template:stop --all         # from any terminal, the app's templates too
hodor template:edit dev-stack     # change anything; restarts it if running
hodor template:command dev-stack -p windows   # the kubectl equivalent, PowerShell flavour
hodor template:export dev-stack -o dev-stack.json
hodor template:import dev-stack.json
```

What a run looks like:

```
✔ HODOR! dev-stack is up on staging
  ● api              127.0.0.1:18080 → shop/service/api:80
  ● db               127.0.0.1:15432 → shop/service/postgres:5432

Ctrl+C to stop · add --logs to watch what happens
```

The app and the command share templates and settings (`~/.hodor`), and each sees what the other is running. `hodor` speaks the app's language; `HODOR_LANG=it hodor …` overrides it.

## Coming next

Signed Windows builds in 1.0.1, then Homebrew, winget and Chocolatey, and controlling single forwards from the command line. It's all in the [roadmap](ROADMAP.md).

## Build it yourself

You need Node.js 22.12+ and pnpm 8 (`corepack enable` picks the right one).

```bash
git clone https://github.com/davidemaggi/Hodor.git
cd Hodor
pnpm install
pnpm build
pnpm test

node packages/cli/bin/hodor --help
pnpm --filter @hodor/gui dev      # the desktop app, with hot reload
pnpm dist                         # installers for your OS in packages/gui/dist
```

## Safety stuff

- Forwards listen on `127.0.0.1` only. Your coworkers on the same Wi-Fi don't get your database.
- Every change Hodor makes to a kubeconfig is backed up to `~/.hodor/backups` first, written atomically and readable only by you.
- Hodor stores no secrets. Values of linked secrets and config maps are read from the cluster when you ask, one at a time, and never written anywhere; copied values are wiped from the clipboard after 30 seconds.
- Templates never contain cluster details or credentials, so sharing them is safe.
- No telemetry. The only thing Hodor asks the internet is GitHub's list of releases, to tell you about a new version, and you can turn that off in Settings.

Found a security issue? Please email [me@davidemaggi.dev](mailto:me@davidemaggi.dev) instead of opening a public issue.

## Contributing

Yes please. Read [CONTRIBUTING.md](CONTRIBUTING.md), branch off `develop`, keep the tests green.

## Versions

[SemVer](https://semver.org/), with a Game of Thrones character for every major release: `1.x` is **Aerys**, `2.x` will start with B, and so on. Patch releases don't get a name, they're just patches.

## License

[Apache 2.0](LICENSE).

---

<div align="center">

_Hold the door._ 🚪

</div>
