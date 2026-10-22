# Contributing to Hodor

First off, thanks for taking the time to contribute! 🎉

Hodor is a tool built by developers, for developers. Whether you're fixing a bug, adding a feature, or improving documentation, your contribution is welcome.

---

## 🤔 How Can I Contribute?

### Reporting Bugs 🐛

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Environment details:**
  - Hodor version
  - Operating system and version
  - Kubernetes version
  - Node.js version (if relevant)
- **Logs** (if applicable)
- **Screenshots** (for UI issues)

Use the bug report template when creating issues.

### Suggesting Features 💡

Feature suggestions are welcome! Before suggesting:

- Check the [ROADMAP.md](ROADMAP.md) to see if it's already planned
- Search existing feature requests
- Consider if it fits Hodor's core purpose

Include in your suggestion:

- **Clear use case** — what problem does it solve?
- **Proposed solution** — how would it work?
- **Alternatives** — what other approaches did you consider?
- **Additional context** — mockups, examples, etc.

### Contributing Code 🔧

#### First-Time Contributors

Look for issues tagged with:

- `good first issue` — perfect for newcomers
- `help wanted` — we'd love assistance on these

#### Development Setup

1. **Fork the repository**

2. **Clone your fork:**

   ```bash
   git clone https://github.com/YOUR-USERNAME/hodor.git
   cd hodor
   ```

3. **Add upstream remote:**

   ```bash
   git remote add upstream https://github.com/ORIGINAL-OWNER/hodor.git
   ```

4. **Install dependencies:**

   ```bash
   pnpm install
   ```

5. **Create a branch:**
   ```bash
   git checkout develop
   git checkout -b feature/your-feature-name
   ```

#### Making Changes

1. **Follow the conventions** in [AGENTS.md](AGENTS.md)
2. **Write tests** for new functionality
3. **Update documentation** if needed
4. **Run tests locally:**
   ```bash
   pnpm test
   pnpm lint
   ```
5. **Commit with conventional commits:**
   ```bash
   git commit -m "feat(core): add new feature"
   ```

#### Submitting a Pull Request

1. **Push to your fork:**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** to the `develop` branch (never `main`)

3. **Fill out the PR template** with:
   - Description of changes
   - Related issue number
   - Type of change (bug fix, feature, etc.)
   - Testing done
   - Screenshots (if UI changes)

4. **Wait for review** — maintainers will review and may request changes

5. **Address feedback** and push updates

6. **Celebrate!** 🎉 Your contribution will be merged

---

## 📝 Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over types for object shapes
- Use descriptive variable names
- Document complex logic with comments

### React Components

- Functional components with hooks
- Props interfaces for all components
- Named exports preferred
- Keep components focused and small

### Testing

- Write unit tests for business logic
- Integration tests for interactions
- E2E tests for critical user flows
- Aim for >80% coverage in core package

See [AGENTS.md](AGENTS.md) for detailed conventions.

---

## 🔄 Git Workflow

### Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation
- `refactor/description` — Code refactoring
- `test/description` — Test additions/fixes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Formatting, missing semicolons, etc.
- `refactor` — Code restructuring
- `perf` — Performance improvement
- `test` — Adding tests
- `chore` — Maintenance tasks
- `ci` — CI/CD changes

**Scopes:**

- `core` — Core package
- `gui` — GUI application
- `cli` — CLI application
- `docs` — Documentation
- `build` — Build system
- `deps` — Dependencies

**Examples:**

```
feat(gui): add cluster selection page
fix(core): resolve kubeconfig parsing error
docs: update installation instructions
test(cli): add tests for template commands
```

---

## 🧪 Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @hodor/core test

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from './your-module';

describe('YourModule', () => {
  it('should do something specific', () => {
    const result = yourFunction();
    expect(result).toBe(expectedValue);
  });
});
```

---

## 📚 Documentation

### Code Documentation

- JSDoc comments for public APIs
- Inline comments for complex logic
- README.md in each package

### User Documentation

- Update README.md if adding user-facing features
- Update ROADMAP.md if completing milestones
- Consider adding examples

---

## 🎨 UI/UX Contributions

For UI work:

1. **Follow design system** — Light/Dark themes, color palette
2. **Use accessibility best practices** — WCAG 2.1 Level AA
3. **Consider internationalization** — Use i18n keys
4. **Test both themes** — Light and dark
5. **Include screenshots** in your PR

We use the `/taste` and `/impeccable` AI skills for UI development — see [AGENTS.md](AGENTS.md).

---

## 🔒 Security

### Reporting Security Issues

**Do NOT open public issues for security vulnerabilities.**

Email security issues to: [davide.maggi@live.com](mailto:davide.maggi@live.com)

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll respond within 48 hours.

### Security Best Practices

- Never commit secrets or credentials
- Use secure storage for sensitive data
- Validate all user inputs
- Follow principle of least privilege
- Keep dependencies updated

---

## 📦 Release Process

Releases are handled by maintainers:

1. Create `release/X.Y.Z` branch from `develop`
2. Update version numbers and changelog
3. Run full test suite
4. Merge to `main` with tag
5. GitHub Actions builds and publishes
6. Merge back to `develop`

Contributors don't need to worry about this — focus on your feature/fix!

---

## 💬 Communication

### Where to Ask Questions

- **GitHub Discussions** — General questions, ideas
- **GitHub Issues** — Bug reports, feature requests
- **Pull Request comments** — Code-specific questions

### Code of Conduct

Be respectful and inclusive:

- Use welcoming language
- Respect differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community

We're all here to build something useful together. Be excellent to each other! 🤘

---

## 🏆 Recognition

Contributors are recognized in:

- CHANGELOG.md for their contributions
- GitHub's contributor graph
- Release notes (for significant contributions)

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

---

## ❓ Questions?

Feel free to ask! Open a discussion or reach out to the maintainers.

**Happy coding!** 🚀

---

_This guide is inspired by open source contribution best practices and tailored for Hodor's development workflow._
