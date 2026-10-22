# Contributing to Hodor

Thanks for stopping by! Bug reports, ideas, docs and code are all welcome.

## Bugs and ideas

- **Bug?** Open an issue with the bug template: what you did, what you expected, what happened, Hodor/OS/Kubernetes versions, and the output of `hodor template:run <name> --logs` if a forward misbehaves.
- **Idea?** Check the [roadmap](ROADMAP.md) first, then open an issue with the feature template. Tell us the problem before the solution.
- **Security issue?** Don't open a public issue. Email [davide.maggi@live.com](mailto:davide.maggi@live.com).

## Code

```bash
git clone https://github.com/<you>/hodor.git
cd hodor
git checkout develop
git checkout -b feature/my-thing
pnpm install
pnpm build && pnpm test
```

Then:

1. Follow the conventions in [AGENTS.md](AGENTS.md). They apply to humans too.
2. Add tests for what you change (`packages/core/tests`). Never use your real `~/.kube` in tests.
3. If you touch Kubernetes behaviour, run the integration tests against a local cluster: `HODOR_IT=1 pnpm --filter @hodor/core test`.
4. `pnpm lint && pnpm format:check` before pushing.
5. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(cli): …`, `fix(core): …`, `docs: …`.
6. Open the PR against **`develop`**, never `main`. Say what you tested, and what you couldn't.

## Releases

Maintainers merge `develop` into `main` when a release is ready; GitHub Actions builds and publishes from `main`. You don't need to bump versions in your PR.

## Be nice

Be kind, assume good intent, keep feedback about the code. Hodor would.

## License

By contributing you agree your work is licensed under [Apache 2.0](LICENSE).
