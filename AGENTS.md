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

## Versioning

- [SemVer](https://semver.org/). Pre-1.0 work is `0.x.y-dev`.
- Bump the version in the root `package.json`, every `packages/*/package.json` and `VERSION` in `packages/core/src/index.ts` together.
- Each major has a Game of Thrones codename, one letter per major (`1.x` = **Aerys**, `2.x` = B…). Minors share the major's name, patches have none. The maintainer picks the names.

## Repo layout

```
packages/
  core/   @hodor/core  business logic, no UI. CommonJS build, used by CLI and the Electron main process
    src/config      kubeconfig parsing, discovery, merging, context/namespace switching
    src/kubernetes  SDK client, cluster discovery + health, port-forward engine, log capture
    src/templates   template manager, validator, executor
    src/storage     template/settings JSON storage, OS keychain
    src/runtime     RunRegistry: coordinates Hodor processes (running templates)
    src/utils       kubectl command generator, kubectl detection, validators
    tests/unit, tests/integration
  cli/    @hodor/cli   `hodor` command. ESM (NodeNext): relative imports need the `.js` extension
  gui/    @hodor/gui   Electron + React app (starts in milestone 0.6)
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
- **E2E** (Playwright for the GUI) comes last, before the 1.0 release.

## Security rules

- Templates contain **only** namespaces, resource names, ports, tags and linked secret/configmap _names_. Never servers, contexts, users or credentials. There's a test for it; keep it passing.
- Port-forwards bind to `127.0.0.1` unless the user explicitly asks otherwise.
- Kubeconfig writes go through `writeFileAtomic` (mode `0600`) and `ContextManager`, which backs up first.
- Sensitive values go to the OS keychain (`SecureStorage`). No plain-file fallback.
- Secret/configmap values are never logged or written to disk. Show them, copy them, forget them.
- Electron (0.6+): `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, a narrow typed IPC surface.

## UI work (from 0.6)

The GUI is designed with **Taste** and reviewed with **Impeccable**.

- **Taste** (`design-taste-frontend`, installed in `.claude/skills/`) for creating screens. Brief it with: purpose of the screen, the data shown, the user (developers), and the brand direction: _snow_ (light) and _night_ (dark), cold and clean, a playful voice.
- **Impeccable** for review and polish. It needs `init` once per project before the first review. ⚠️ It's currently installed only in `.github/skills/` (GitHub Copilot). Claude Code needs it in `.claude/skills/` too.
- Both themes and every string through i18n (English default) from day one.

## Copy & tone

Docs, CLI messages and UI copy are in **English**, casual, from a developer to developers. Jokes welcome (it's called Hodor, after all), but never at the expense of clarity: error messages say what went wrong and what to do next.
