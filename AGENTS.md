# AGENTS.md · How AI agents work on Hodor

Rules for any AI agent (Claude Code, Copilot, …) touching this repo. Humans are welcome to read along.

## Ground rules

1. **Done means verified.** Never tick a box in `ROADMAP.md` or write a `CHANGELOG.md` entry for something that hasn't been built _and_ run. `pnpm build` and `pnpm test` must pass; behaviour that talks to Kubernetes must have been exercised against a real cluster (see "Testing").
2. **Say what you didn't check.** If something couldn't be tested (interactive prompts, another OS, no cluster), write it down in the PR or the hand-off message.
3. **Keep the docs true.** `README.md`, `ROADMAP.md` and `CHANGELOG.md` describe what exists today. No invented dates, no features "coming soon" presented as available.

## Git workflow

- All development happens on **`develop`** (feature branches off `develop` are fine for bigger work).
- `main` only receives merges from `develop` for a release. **Release builds run only on merge to `main`.**
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(cli): …`, `fix(core): …`, `docs: …`, `test: …`, `chore: …`, `ci: …`.
- Never commit to `main` directly, never force-push shared branches.

## Releases and signing

- Release workflows trigger **only on merge (push) to `main`**. Builds run on GitHub-hosted runners.
- Every release ships unsigned artifacts with SHA256 checksums and GitHub build-provenance attestations.
- From 1.0.1, Windows artifacts are also signed with Certum on a self-hosted runner (label `hodor-signing`). A preflight job checks the runner is online; if not, the signed upload is **skipped, not failed**.
- The signing job never runs on `pull_request` events, uses a protected environment with required approval, and only handles artifacts produced by the GitHub-hosted build. It must not check out or build code itself.
- Never put signing credentials in the repo or in workflow logs.
- How a release happens (`.github/workflows/release.yml`): a push to `main` reads the version from `package.json`. If the tag `v<version>` already exists the run stops there, so merging without a bump publishes nothing. Otherwise it builds every OS, writes `SHA256SUMS`, attests every file and publishes the GitHub release; a version with `-` (e.g. `1.0.0-rc.1`) is a pre-release.
- The release notes are the `## [<version>]` section of `CHANGELOG.md`, and the run fails without one. Preview title and notes with `pnpm --filter @hodor/core build && pnpm release:meta`.
- `workflow_dispatch` builds the artifacts without publishing (a dry run, from any branch); publishing by hand works from `main` only.

## Versioning

- [SemVer](https://semver.org/). Release candidates are `X.Y.Z-rc.N`.
- Bump the version in the root `package.json`, every `packages/*/package.json` and `VERSION` in `packages/core/src/index.ts` together.
- Each major has a Game of Thrones codename, one letter per major (`1.x` = **Aerys**, `2.x` = B…). Minors share the major's name, patches have none. The maintainer picks the names.

## Repo layout

```
packages/
  gui/    @hodor/gui   Electron app: src/main (window, IPC), src/preload (bridge), src/shared (API contract), src/renderer
  core/   @hodor/core  business logic, no UI. CommonJS build, used by CLI and the Electron main process
    src/config      kubeconfig parsing, discovery, merging, context/namespace switching
    src/kubernetes  SDK client, cluster discovery + health, port-forward engine, log capture
    src/templates   template manager, validator, executor
    src/storage     template/settings JSON storage, OS keychain
    src/runtime     RunRegistry: coordinates Hodor processes (running templates)
    src/utils       kubectl command generator, kubectl detection, validators
    tests/unit, tests/integration
  cli/    @hodor/cli   `hodor` command. ESM (NodeNext): relative imports need the `.js` extension
```

User data lives in `~/.hodor/` (templates, settings, run registry, kubeconfig backups). Never in `~/.kube/` except the kubeconfig files themselves.

## Code conventions

- TypeScript strict. `pnpm build` must have zero errors.
- kebab-case file names, PascalCase types/classes/components, camelCase everything else.
- JSDoc on public APIs, comments only where the _why_ isn't obvious.
- React (from 0.6): function components, named exports, a props interface per component.
- Format with Prettier (`pnpm format`), lint with ESLint (`pnpm lint`). Vendored skills are excluded via `.prettierignore`.

## Testing

- **Unit tests** (Vitest) for every core module: `pnpm test`. Use temp dirs (`tests/helpers/tmp.ts`), never the real `~/.kube` or `~/.hodor`.
- **Integration tests** are opt-in so CI doesn't need a cluster:
  - `HODOR_IT=1 pnpm --filter @hodor/core test` runs port-forward against kubectl's default context (needs `kube-system/kube-dns`)
  - `HODOR_KEYCHAIN_IT=1 …` touches the real OS keychain under a throwaway service name
- **Manual CLI checks**: run with `HOME` pointing at a temp dir containing a _copy_ of the kubeconfig, so `ctx`/`ns`/`merge` never touch the real one.
- **GUI checks**:
  - `pnpm --filter @hodor/gui preview:web` serves the renderer in a browser with sample data (`fixtures.ts`). Query flags: `?theme=light|dark`, `?empty=1` (first run), `?idle=1` (nothing running), `?cli=1` (run started from the terminal), `?merge=1`, `?palette=1`, `?cmd=1`, `?start=1`, `?panel=logs|values`. Fixtures never reach a real build; check with `grep -r northwind packages/gui/out`.
  - The real app: `pnpm --filter @hodor/gui build`, then run Electron with `--remote-debugging-port` and a sandboxed `HOME` to drive it over the DevTools protocol.
  - If Electron starts as plain Node ("Cannot read properties of undefined (reading 'enableSandbox')"), the shell has `ELECTRON_RUN_AS_NODE=1` (set by VS Code/Electron-based terminals). Run with `env -u ELECTRON_RUN_AS_NODE`.
- Native gestures (tray menu clicks, the window's close button, file dialogs) can't be driven over CDP and macOS blocks synthetic keystrokes: keep their decisions in small pure functions with unit tests (e.g. `close-policy.ts`) and say they weren't clicked.
- **E2E** (Playwright, `packages/gui/e2e`, run with `pnpm e2e` after `pnpm build`):
  - `e2e/fixtures.ts` starts the built app with a throwaway `HOME`/`USERPROFILE` and `HODOR_USER_DATA` (moves Electron's data folder and with it the single-instance lock, so a Hodor already open doesn't swallow the test).
  - `smoke.spec.ts` runs everywhere. `cluster.spec.ts` needs `HODOR_E2E_KUBECONFIG` (a kubeconfig whose default context has `kube-system/kube-dns`); the fixture copies it into the throwaway HOME.
  - Locally, a throwaway cluster: download `kind` into a temp dir, `kind create cluster --kubeconfig <tmp>/kubeconfig`, point `HODOR_E2E_KUBECONFIG` (and `KUBECONFIG` + `HODOR_IT=1` for the core) at it, delete the cluster afterwards.
  - On Linux run under `xvfb-run -a`; the fixture adds `--no-sandbox` there.
- **CI** (`.github/workflows/ci.yml`): lint and format; build, unit tests, the CLI bundle and the smoke E2E on Linux, macOS and Windows; the core integration test and the cluster E2E on kind for every supported Kubernetes version. Adding a Kubernetes version means adding its kind image (pinned by digest) to the matrix.

## Packaging

- `pnpm dist` builds installers for the current OS into `packages/gui/dist` (electron-builder, config in `packages/gui/electron-builder.yml`, inputs in `packages/gui/build/`).
- The Electron main process is bundled with its dependencies, so no `node_modules` ship and every dependency of `@hodor/gui` is a devDependency. A native module must be listed as `external` in `electron.vite.config.mts` and shipped on purpose.
- The CLI ships inside the app: `pnpm --filter @hodor/cli bundle` makes one file, `packages/cli/bundle/hodor.mjs`, run by `resources/bin/hodor` (sh) and `hodor.cmd` with the app's own Electron in Node mode (`ELECTRON_RUN_AS_NODE=1`). No Node.js needed on the user's machine.
- On the PATH: the NSIS installer adds `resources\bin` to the user PATH (`build/installer.nsh`); deb/rpm link `/usr/bin/hodor` (`build/linux/*.sh`, which must keep electron-builder's own steps); macOS and the tar.gz link it from the app (`src/main/cli-install.ts`). The Linux app binary is `hodor-app`, because `hodor` is the CLI.
- macOS builds are ad-hoc signed (`identity: "-"`), which Apple silicon requires; there's no Developer ID yet.
- Check a Linux package for real in a container, e.g. `docker run --platform linux/amd64 -v $PWD/packages/gui/dist:/d ubuntu:24.04` and `apt-get install /d/<file>.deb`, then run `hodor --version`.

## Security rules

- Templates contain **only** namespaces, resource names, ports, tags and linked secret/configmap _names_. Never servers, contexts, users or credentials. There's a test for it; keep it passing.
- Port-forwards bind to `127.0.0.1` unless the user explicitly asks otherwise.
- Kubeconfig writes go through `writeFileAtomic` (mode `0600`) and `ContextManager`, which backs up first.
- Sensitive values go to the OS keychain (`SecureStorage`). No plain-file fallback. (1.0 stores none, so the keychain module isn't shipped.)
- Secret/configmap values are never logged or written to disk. Show them, copy them, forget them.
- Electron (0.6+): `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, a narrow typed IPC surface.

## UI work (from 0.6)

The GUI is designed with **Taste** and reviewed with **Impeccable**.

- **Taste** (`design-taste-frontend`, installed in `.claude/skills/`) for creating screens. Brief it with: purpose of the screen, the data shown, the user (developers), and the brand direction: _snow_ (light) and _night_ (dark), cold and clean, a playful voice.
- **Impeccable** for review and polish. It needs `init` once per project before the first review. ⚠️ It's currently installed only in `.github/skills/` (GitHub Copilot). Claude Code needs it in `.claude/skills/` too.
- Both themes and every string through i18n (English default) from day one.
- The dealt direction and notes live in `.taste-skill/` (`direction.json`, `notes.md`): style **framed-sheet**, seed 100285193, face = snow-tinted frame, signature = the local port as the headline figure. Reprint with `node .claude/skills/design-taste-frontend/scripts/draw.mjs --show`. Screenshots in `.taste-skill/inspect/` are not committed.
- Gate before committing UI: `lint.mjs --app packages/gui/src/renderer` and `inspect.mjs --app <preview url> --widths 1440,960` with 0 FAIL in both themes, then look at the screenshots.

## Copy & tone

Docs, CLI messages and UI copy are in **English**, casual, from a developer to developers. Jokes welcome (it's called Hodor, after all), but never at the expense of clarity: error messages say what went wrong and what to do next.
