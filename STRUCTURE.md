# Hodor Project Structure

This document outlines the complete project structure for Hodor.

## Directory Structure

```
hodor/
├── .github/                      # GitHub configuration
│   ├── workflows/                # GitHub Actions CI/CD
│   │   ├── ci.yml               # Continuous Integration
│   │   ├── release.yml          # Release automation
│   │   └── pr-checks.yml        # Pull request checks
│   ├── ISSUE_TEMPLATE/          # Issue templates
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── packages/                     # Monorepo packages
│   ├── core/                    # @hodor/core
│   │   ├── src/
│   │   │   ├── kubernetes/      # Kubernetes client & operations
│   │   │   │   ├── client.ts
│   │   │   │   ├── port-forward.ts
│   │   │   │   ├── resources.ts
│   │   │   │   └── version-manager.ts
│   │   │   ├── config/          # Kubeconfig management
│   │   │   │   ├── parser.ts
│   │   │   │   ├── merger.ts
│   │   │   │   ├── context-manager.ts
│   │   │   │   └── loader.ts
│   │   │   ├── storage/         # Data persistence
│   │   │   │   ├── secure-storage.ts
│   │   │   │   ├── settings-storage.ts
│   │   │   │   └── template-storage.ts
│   │   │   ├── templates/       # Template management
│   │   │   │   ├── template.ts
│   │   │   │   ├── manager.ts
│   │   │   │   ├── executor.ts
│   │   │   │   ├── exporter.ts
│   │   │   │   └── validator.ts
│   │   │   ├── secrets/         # Secrets & ConfigMaps
│   │   │   │   ├── secret-manager.ts
│   │   │   │   └── configmap-manager.ts
│   │   │   ├── i18n/            # Internationalization
│   │   │   │   ├── index.ts
│   │   │   │   └── locales/
│   │   │   │       ├── en/
│   │   │   │       │   ├── common.json
│   │   │   │       │   ├── clusters.json
│   │   │   │       │   └── templates.json
│   │   │   │       └── it/
│   │   │   │           ├── common.json
│   │   │   │           ├── clusters.json
│   │   │   │           └── templates.json
│   │   │   ├── types/           # TypeScript types
│   │   │   │   ├── cluster.ts
│   │   │   │   ├── template.ts
│   │   │   │   ├── port-forward.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/           # Utilities
│   │   │   │   ├── logger.ts
│   │   │   │   ├── validators.ts
│   │   │   │   └── command-generator.ts
│   │   │   └── index.ts
│   │   ├── tests/               # Unit & integration tests
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   ├── gui/                     # @hodor/gui - Electron app
│   │   ├── src/
│   │   │   ├── main/            # Electron main process
│   │   │   │   ├── index.ts
│   │   │   │   ├── window-manager.ts
│   │   │   │   ├── ipc-handlers.ts
│   │   │   │   ├── menu.ts
│   │   │   │   └── auto-updater.ts
│   │   │   ├── preload/         # Preload scripts
│   │   │   │   └── index.ts
│   │   │   └── renderer/        # React application
│   │   │       ├── src/
│   │   │       │   ├── components/   # Reusable components
│   │   │       │   │   ├── common/
│   │   │       │   │   │   ├── Button.tsx
│   │   │       │   │   │   ├── Input.tsx
│   │   │       │   │   ├── clusters/
│   │   │       │   │   ├── templates/
│   │   │       │   │   └── port-forwards/
│   │   │       │   ├── pages/        # Page components
│   │   │       │   │   ├── Clusters/
│   │   │       │   │   │   ├── ClusterList.tsx
│   │   │       │   │   │   └── ClusterDetail.tsx
│   │   │       │   │   ├── Templates/
│   │   │       │   │   │   ├── TemplateList.tsx
│   │   │       │   │   │   ├── TemplateEditor.tsx
│   │   │       │   │   │   └── TemplateExecution.tsx
│   │   │       │   │   ├── Settings/
│   │   │       │   │   │   └── Settings.tsx
│   │   │       │   │   └── index.tsx
│   │   │       │   ├── hooks/        # Custom React hooks
│   │   │       │   │   ├── useCluster.ts
│   │   │       │   │   ├── useTemplate.ts
│   │   │       │   │   ├── usePortForward.ts
│   │   │       │   │   └── useTheme.ts
│   │   │       │   ├── contexts/     # React contexts
│   │   │       │   │   ├── ThemeContext.tsx
│   │   │       │   │   ├── ClusterContext.tsx
│   │   │       │   │   └── TemplateContext.tsx
│   │   │       │   ├── styles/       # Global styles
│   │   │       │   │   ├── theme.ts
│   │   │       │   │   ├── global.css
│   │   │       │   │   └── variables.css
│   │   │       │   ├── utils/        # Frontend utilities
│   │   │       │   │   └── ipc.ts
│   │   │       │   ├── App.tsx
│   │   │       │   └── index.tsx
│   │   │       ├── public/
│   │   │       │   ├── index.html
│   │   │       │   └── assets/
│   │   │       └── vite.config.ts
│   │   ├── resources/           # App resources
│   │   │   ├── icon.icns        # macOS icon
│   │   │   ├── icon.ico         # Windows icon
│   │   │   └── icon.png         # Linux icon
│   │   ├── tests/
│   │   ├── electron-builder.yml # Electron builder config
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── cli/                     # @hodor/cli - Command-line interface
│       ├── src/
│       │   ├── commands/        # CLI commands
│       │   │   ├── clusters.ts
│       │   │   ├── ctx.ts       # Context switching
│       │   │   ├── ns.ts        # Namespace switching
│       │   │   ├── config.ts    # Config management
│       │   │   └── template/
│       │   │       ├── create.ts
│       │   │       ├── list.ts
│       │   │       ├── run.ts
│       │   │       ├── stop.ts
│       │   │       ├── edit.ts
│       │   │       ├── delete.ts
│       │   │       ├── export.ts
│       │   │       └── import.ts
│       │   ├── prompts/         # Interactive prompts
│       │   │   ├── cluster-select.ts
│       │   │   ├── namespace-select.ts
│       │   │   ├── template-builder.ts
│       │   │   └── confirm.ts
│       │   ├── ui/              # CLI UI components
│       │   │   ├── table.ts
│       │   │   ├── spinner.ts
│       │   │   ├── progress.ts
│       │   │   └── banner.ts
│       │   ├── utils/           # CLI utilities
│       │   │   ├── formatter.ts
│       │   │   ├── colors.ts
│       │   │   └── logger.ts
│       │   ├── index.ts
│       │   └── hodor.ts         # Main CLI entry
│       ├── bin/
│       │   └── hodor            # Executable script
│       ├── tests/
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
├── docs/                        # Documentation
│   ├── getting-started.md
│   ├── user-guide/
│   │   ├── gui-overview.md
│   │   ├── cli-reference.md
│   │   ├── templates.md
│   │   └── kubeconfig.md
│   ├── development/
│   │   ├── architecture.md
│   │   ├── testing.md
│   │   └── debugging.md
│   └── api/
│       └── core-api.md
│
├── scripts/                     # Build and automation scripts
│   ├── version-bump.js
│   ├── version-check.js
│   ├── changelog-generate.js
│   ├── build-all.js
│   └── sign-artifacts.js
│
├── tests/                       # E2E tests (cross-package)
│   ├── e2e/
│   │   ├── gui/
│   │   │   └── playwright.config.ts
│   │   └── cli/
│   └── fixtures/
│
├── .github/                     # GitHub configuration
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json                # Base TypeScript config
├── LICENSE
├── README.md
├── ROADMAP.md
├── AGENTS.md
├── VERSION.md
├── CHANGELOG.md
└── CONTRIBUTING.md
```

## Package Dependencies

### @hodor/core
Core business logic, shared by both GUI and CLI.

**Dependencies:**
- `@kubernetes/client-node` - Kubernetes client
- `keytar` - Secure credential storage
- `i18next` - Internationalization
- `zod` - Schema validation

### @hodor/gui
Electron application with React frontend.

**Dependencies:**
- `electron` - Desktop application framework
- `react` - UI library
- `react-router-dom` - Routing
- `@hodor/core` - Core logic
- `electron-store` - Settings persistence
- `@tanstack/react-query` - Data fetching

**Dev Dependencies:**
- `vite` - Build tool
- `electron-builder` - Packaging

### @hodor/cli
Command-line interface.

**Dependencies:**
- `commander` - CLI framework
- `inquirer` - Interactive prompts
- `chalk` - Terminal colors
- `ora` - Spinners
- `cli-table3` - Tables
- `@hodor/core` - Core logic

---

## Build Output

```
hodor/
├── packages/
│   ├── core/dist/           # Compiled core package
│   ├── gui/
│   │   ├── dist/            # Built renderer
│   │   └── out/             # Electron packages
│   │       ├── Hodor-1.0.0.dmg
│   │       ├── Hodor-Setup-1.0.0.exe
│   │       ├── Hodor-1.0.0.AppImage
│   │       └── ...
│   └── cli/dist/            # Compiled CLI
│
└── release/                 # Final release artifacts
    ├── hodor-cli-1.0.0.tar.gz
    ├── hodor-gui-1.0.0-mac.dmg
    ├── hodor-gui-1.0.0-win.exe
    └── ...
```

---

*This structure will be created incrementally as we implement each milestone.*
