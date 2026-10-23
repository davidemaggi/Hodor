<div align="center">

<img src="assets/brand/hodor-icon.svg" width="128" height="128" alt="Hodor icon: a door, held open" />

# Hodor

**Holds the door to your Kubernetes clusters.**

Port-forwards you can save, share, and run on any cluster, without seven terminal tabs of `kubectl port-forward`.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-0.5.1--dev-orange.svg)](ROADMAP.md)
[![Next](https://img.shields.io/badge/next-1.0%20Aerys-purple.svg)](ROADMAP.md)

</div>

---

> ⚠️ **Early days.** The CLI works; the desktop app does nearly everything the CLI does and more (clusters, kubectl context switching, kubeconfig merging, template editor, running templates with logs and secret values, tray). There's no release to download: you build it from source. See the [roadmap](ROADMAP.md).

## Why

You know the drill. API on 8080, Postgres on 5432, Redis on 6379, three terminals, one of them died twenty minutes ago and you only notice now. Then you need the DB password: `kubectl get secret`, `base64 -d`, copy, paste, swear.

Then you do the same thing on staging. Same services, different cluster, start over.

Hodor fixes that:

- **Templates.** Bundle the forwards you always need, give them a name and some tags, run them with one command.
- **Cluster-agnostic.** Templates store namespaces, resource names and ports. No servers, no contexts, no credentials. You pick the cluster when you run them, so the same template works on dev, staging and prod.
- **Every kubeconfig.** Hodor reads everything in `~/.kube`, tells you which clusters are up, and highlights kubectl's default ★.
- **Plays nice with kubectl.** Switch kubectl's default context and namespace, merge that kubeconfig you just downloaded, or ask Hodor for the plain `kubectl` commands (bash or PowerShell) when you need them somewhere else.

## What works today (CLI)

```bash
hodor clusters                    # every context in ~/.kube, who's up, ★ kubectl default
hodor ctx                         # change kubectl's default context (needs kubectl)
hodor ns                          # change kubectl's default namespace (needs kubectl)
hodor config:merge ~/Downloads/staging.yaml   # merge into your kubeconfig (backed up first)

hodor template:create             # interactive wizard
hodor template:list --tags dev    # list, filter, search
hodor template:run dev-stack      # pick a cluster, hold the doors
hodor template:run dev-stack -c staging --logs
hodor template:stop --all         # from any terminal
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

## Coming next

Italian (and translated CLI), installers that put `hodor` on your PATH, signed Windows builds, then Homebrew, winget and Chocolatey. It's all in the [roadmap](ROADMAP.md).

## Build it yourself

You need Node.js 18+ and pnpm 8+.

```bash
git clone https://github.com/davidemaggi/hodor.git
cd hodor
pnpm install
pnpm build
pnpm test

node packages/cli/bin/hodor --help
pnpm --filter @hodor/gui dev      # the desktop app, with hot reload
# or put it on your PATH:
cd packages/cli && pnpm link --global
```

## Safety stuff

- Forwards listen on `127.0.0.1` only. Your coworkers on the same Wi-Fi don't get your database.
- Every change Hodor makes to a kubeconfig is backed up to `~/.hodor/backups` first, written atomically and readable only by you.
- Sensitive data goes to your OS keychain. If there's no keychain, Hodor refuses rather than writing secrets to a file.
- Templates never contain cluster details, so sharing them is safe.

Found a security issue? Please email [davide.maggi@live.com](mailto:davide.maggi@live.com) instead of opening a public issue.

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
