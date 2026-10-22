# 🤖 Hodor - AI Agent Conventions

This document defines conventions and guidelines for AI-assisted development on the Hodor project. It ensures consistency when using Claude Code and other AI tools.

---

## 🎨 UI/UX Design Process

### Using Taste for Interface Creation

When creating new UI components or pages:

1. **Initial Design:** Use the `taste` skill to generate modern, accessible React components
2. **Context:** Provide Taste with:
   - The feature/page purpose
   - Required functionality
   - Brand guidelines (snow white / midnight black theme)
   - Target user (developers)
3. **Output:** Taste will generate complete React components with TypeScript

**Example invocation:**
```bash
/taste Create a cluster selection page that shows available Kubernetes clusters with their status
```

### Using Impeccable for Review & Refinement

After creating UI components:

1. **Initialize Impeccable:** Run `/impeccable init` if not already initialized in the session
2. **Review:** Use `impeccable` to review the generated components for:
   - Accessibility (WCAG compliance)
   - Performance issues
   - Code quality
   - Best practices
   - Security concerns
3. **Iterate:** Apply Impeccable's suggestions and re-review if needed

**Example invocation:**
```bash
/impeccable Review the cluster selection component for accessibility and performance
```

---

## 🏗️ Project Structure Conventions

### Monorepo Organization

```
hodor/
├── packages/
│   ├── core/              # @hodor/core - Shared business logic
│   │   ├── src/
│   │   │   ├── kubernetes/    # K8s client and operations
│   │   │   ├── storage/       # Secure storage layer
│   │   │   ├── templates/     # Template management
│   │   │   ├── config/        # Configuration management
│   │   │   └── types/         # Shared TypeScript types
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── gui/               # @hodor/gui - Electron application
│   │   ├── src/
│   │   │   ├── main/          # Electron main process
│   │   │   ├── renderer/      # React application
│   │   │   │   ├── components/
│   │   │   │   ├── pages/
│   │   │   │   ├── hooks/
│   │   │   │   ├── contexts/
│   │   │   │   └── styles/
│   │   │   └── preload/       # Preload scripts
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── cli/               # @hodor/cli - Command-line interface
│       ├── src/
│       │   ├── commands/      # CLI command implementations
│       │   ├── prompts/       # Interactive prompts
│       │   └── utils/         # CLI utilities
│       ├── tests/
│       └── package.json
│
├── docs/                  # Documentation
├── scripts/               # Build and automation scripts
├── .github/               # GitHub workflows and templates
└── tests/                 # E2E tests (cross-package)
```

---

## 💻 Code Conventions

### TypeScript Standards

- **Strict mode:** Always enabled
- **Naming:**
  - PascalCase for types, interfaces, classes, React components
  - camelCase for variables, functions, methods
  - SCREAMING_SNAKE_CASE for constants
  - kebab-case for file names
- **Imports:** Use absolute imports with path aliases
  ```typescript
  import { KubernetesClient } from '@hodor/core/kubernetes';
  ```

### React Component Patterns

- **Functional components** with hooks (no class components)
- **TypeScript** props interfaces for all components
- **Named exports** preferred over default exports
- **File structure:**
  ```typescript
  // component-name.tsx
  import React from 'react';
  
  interface ComponentNameProps {
    // props definition
  }
  
  export const ComponentName: React.FC<ComponentNameProps> = ({ props }) => {
    // implementation
  };
  ```

### Testing Standards

- **Unit tests:** Vitest for all packages
- **Integration tests:** Test package interactions
- **E2E tests:** Playwright for GUI, custom runner for CLI
- **Coverage target:** >80% for core package
- **Test file naming:** `*.test.ts` or `*.spec.ts`

---

## 🌍 Internationalization (i18n)

### Translation Keys

- **Format:** `namespace.section.key`
- **Example:** `clusters.list.title`, `templates.create.button`
- **Namespaces:**
  - `common` - Shared UI elements
  - `clusters` - Cluster management
  - `templates` - Template management
  - `settings` - Application settings
  - `errors` - Error messages
  - `cli` - CLI-specific strings

### Translation Files

```
packages/core/src/i18n/
├── locales/
│   ├── en/
│   │   ├── common.json
│   │   ├── clusters.json
│   │   └── templates.json
│   └── it/
│       ├── common.json
│       ├── clusters.json
│       └── templates.json
└── index.ts
```

---

## 🎨 Theming Conventions

### Color Palette

**Light Theme (Snow)**
```typescript
{
  primary: '#2c3e50',      // Dark slate
  secondary: '#3498db',    // Sky blue
  background: '#ffffff',   // Pure white
  surface: '#f8f9fa',      // Light gray
  text: '#2c3e50',         // Dark slate
  textSecondary: '#7f8c8d', // Gray
  border: '#e1e8ed',       // Light border
  success: '#27ae60',      // Green
  warning: '#f39c12',      // Orange
  error: '#e74c3c',        // Red
  info: '#3498db',         // Blue
}
```

**Dark Theme (Night)**
```typescript
{
  primary: '#ecf0f1',      // Light gray
  secondary: '#3498db',    // Sky blue
  background: '#1a1a1a',   // Near black
  surface: '#2c2c2c',      // Dark gray
  text: '#ecf0f1',         // Light gray
  textSecondary: '#95a5a6', // Medium gray
  border: '#3a3a3a',       // Dark border
  success: '#2ecc71',      // Bright green
  warning: '#f39c12',      // Orange
  error: '#e74c3c',        // Red
  info: '#3498db',         // Blue
}
```

---

## 🔒 Security Best Practices

### Secrets and Sensitive Data

1. **Never log secrets** - Use `[REDACTED]` placeholders in logs
2. **Secure storage only** - Use keytar or encrypted electron-store
3. **Memory safety** - Clear sensitive data from memory after use
4. **No secrets in templates** - Templates contain only resource names
5. **Audit logging** - Log access to sensitive operations (not the data itself)

### Kubernetes Credentials

- Store kubeconfig securely
- Never transmit credentials over unencrypted channels
- Validate cluster certificates
- Use least-privilege access patterns

---

## 📝 Documentation Standards

### Code Documentation

- **JSDoc comments** for all public APIs
- **Inline comments** for complex logic
- **README.md** in each package
- **Examples** in documentation

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/modifications
- `chore`: Build process or tooling changes
- `ci`: CI/CD changes

**Examples:**
```
feat(core): add kubeconfig merge functionality

Implement merge logic to combine multiple kubeconfig files
while preserving contexts and clusters.

Closes #123
```

```
fix(gui): resolve cluster selection race condition

The cluster list was not properly waiting for async
initialization, causing undefined errors.
```

---

## 🔄 Git Workflow

### Branch Strategy

- **`main`** - Production-ready code, tagged releases only
- **`develop`** - Integration branch for features
- **`feature/*`** - Feature branches (e.g., `feature/template-export`)
- **`fix/*`** - Bug fix branches
- **`release/*`** - Release preparation branches

### Pull Request Process

1. Create feature branch from `develop`
2. Implement feature with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Create PR to `develop` (never directly to `main`)
6. Code review required
7. Squash and merge

### Release Process

1. Create `release/X.Y.Z` branch from `develop`
2. Update version numbers
3. Update CHANGELOG.md
4. Test release builds
5. Merge to `main` and tag
6. GitHub Actions builds and publishes
7. Merge back to `develop`

---

## 🚀 Build and Release

### Version Management

- Follow **Semantic Versioning**
- Update version in:
  - Root `package.json`
  - All package `package.json` files
  - `CHANGELOG.md`
  - `ROADMAP.md` if milestone reached

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] Git tag created
- [ ] Release notes written
- [ ] Builds signed (Windows via Azure)
- [ ] Release published

---

## 🤖 AI-Specific Guidelines

### When to Use AI Skills

**Use `/taste` for:**
- Creating new UI pages
- Designing component layouts
- Building forms and interactive elements
- Generating accessible markup

**Use `/impeccable` for:**
- Reviewing completed components
- Accessibility audits
- Performance optimization suggestions
- Security reviews

**Use AI coding assistance for:**
- Implementing business logic
- Writing tests
- Refactoring code
- Debugging issues

### What NOT to Generate with AI

- Kubernetes credentials or secrets
- Production configuration files
- Private keys or certificates
- User-specific data

### Review All AI-Generated Code

- Verify security implications
- Check for performance issues
- Ensure accessibility compliance
- Test thoroughly

---

## 📚 Learning Resources

### Project Dependencies

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Kubernetes Client Node](https://github.com/kubernetes-client/javascript)
- [Commander.js](https://github.com/tj/commander.js)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- [i18next](https://www.i18next.com/)

### Best Practices

- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [React Best Practices](https://react.dev/learn/thinking-in-react)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Kubernetes API Concepts](https://kubernetes.io/docs/reference/using-api/api-concepts/)

---

## 🔧 Development Tools

### Required Tools

- Node.js 18+ (LTS)
- pnpm 8+
- Git
- VS Code (recommended) or your preferred IDE

### Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Jest Runner
- GitLens
- i18n Ally

### Environment Setup

```bash
# Install dependencies
pnpm install

# Run development servers (all packages)
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Lint and format
pnpm lint
pnpm format
```

---

*This document is maintained by the project maintainers and should be updated as conventions evolve.*

*Last Updated: 2023-10-22*
