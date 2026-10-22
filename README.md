# 🚪 Hodor

> _"Hold the door!"_ — Hodor holds your Kubernetes port-forwards so you don't have to.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0--dev-orange.svg)](ROADMAP.md)
[![Code Name](<https://img.shields.io/badge/codename-Aerys%20(upcoming)-purple.svg>)](ROADMAP.md)

Hodor is a modern, cross-platform Kubernetes port-forward manager that makes working with multiple clusters, namespaces, and services a breeze. Whether you're a developer juggling microservices or a DevOps engineer managing production debugging, Hodor's got your back.

## 🎯 Why Hodor?

Let's be honest: managing multiple `kubectl port-forward` commands is a pain. You've got terminals everywhere, you lose track of what's forwarding where, and don't even get me started on copying connection strings from secrets.

Hodor fixes all of that:

- 🎨 **Beautiful GUI & Interactive CLI** — Work your way, with style
- 📦 **Port-Forward Templates** — Create, save, and share your forwarding configurations
- 🔐 **Secrets & ConfigMaps** — View and copy values right from the active forwards
- 🏷️ **Tagging & Search** — Organize templates with tags and find them instantly
- 🌍 **Multi-Cluster** — Work across all your clusters seamlessly
- 🌐 **Multi-Language** — English by default, more languages coming
- 🎭 **Light & Dark Themes** — Because developers have preferences
- 📤 **Import/Export** — Share templates with your team
- 🔄 **Live Reload** — Modify running templates and restart on the fly
- 📋 **Generate kubectl Commands** — Export your templates as plain kubectl commands

## 🚀 Quick Start

### Installation

```bash
# macOS (Homebrew)
brew install hodor

# Windows (Winget)
winget install hodor

# Windows (Chocolatey)
choco install hodor

# Or download the latest release
# https://github.com/yourusername/hodor/releases
```

### First Steps

**GUI Mode:**

```bash
hodor
```

**CLI Mode:**

```bash
# List available clusters
hodor clusters

# Switch context
hodor ctx

# Switch namespace
hodor ns

# Create a new template
hodor template create

# Run a template
hodor template run my-template

# List all templates
hodor template list
```

## ✨ Features

### 🎪 Port-Forward Templates

Create templates that bundle multiple port-forwards together. Perfect for microservice architectures where you need to forward multiple services at once.

```bash
# Example: Development environment with 3 services
hodor template create dev-stack
  → API Gateway: 8080:8080
  → Database: 5432:5432
  → Redis: 6379:6379
```

### 🔐 Secrets & ConfigMaps Integration

Attach secrets and configmaps to your forwards. When a template is running, Hodor gives you instant access to copy connection strings, passwords, and configuration values.

No more `kubectl get secret` → `base64 -d` dance!

### 🏷️ Tagging & Organization

Tag your templates with keywords like `dev`, `staging`, `database`, `monitoring`. Search and filter to find exactly what you need.

Drag and drop to reorder templates and individual forwards within them.

### 🌍 Multi-Cluster Management

- View all clusters from your `~/.kube/` configs
- See which clusters are active
- Switch default cluster and namespace
- Templates are cluster-agnostic — run them anywhere

### 📤 Import/Export

Share templates with your team or backup your configurations:

```bash
hodor template export my-template -o my-template.json
hodor template import my-template.json
```

### 🛠️ Kubeconfig Management

Merge multiple kubeconfig files easily:

```bash
# GUI: Import & Merge section
# CLI:
hodor config merge ~/.kube/config-prod ~/.kube/config-staging
```

## 🎨 Themes

Hodor supports both light and dark themes, because we know some of you are night owls and some of you actually enjoy daylight.

The color scheme is inspired by the North — think snow whites and midnight blacks, just like the character himself.

## 🗺️ Roadmap

See our [ROADMAP.md](ROADMAP.md) for detailed plans.

**Current Version:** `0.1.0-dev` (Pre-release)  
**Next Release:** `1.0.0 - Aerys` (Q1 2024)

### Coming Soon

- ✅ Core template management
- ✅ Multi-cluster support
- ✅ Secrets/ConfigMaps viewing
- ✅ GUI & CLI
- ✅ Light/Dark themes
- ✅ i18n support
- 🔄 Package manager distributions
- 🔄 Code signing for releases
- 🔄 E2E testing suite

## 🛠️ Development

Hodor is built with modern technologies:

- **Frontend:** Electron + React + TypeScript
- **CLI:** Commander.js + Inquirer.js + Chalk
- **K8s Client:** @kubernetes/client-node + kubectl fallback
- **Storage:** Keytar (secure) + electron-store
- **i18n:** i18next

### Project Structure

```
hodor/
├── packages/
│   ├── core/          # Shared business logic
│   ├── gui/           # Electron + React app
│   └── cli/           # CLI application
├── docs/              # Documentation
├── scripts/           # Build and release scripts
└── .github/           # CI/CD workflows
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/hodor.git
cd hodor

# Install dependencies
pnpm install

# Start development
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## 🤝 Contributing

Contributions are welcome! Whether it's:

- 🐛 Bug reports
- 💡 Feature requests
- 📖 Documentation improvements
- 🔧 Code contributions

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📝 Versioning

Hodor follows [Semantic Versioning](https://semver.org/):

- **Major.Minor.Patch** (e.g., `1.2.3`)
- Each major version has a codename from Game of Thrones characters
  - `1.x.x` → **Aerys** (A)
  - `2.x.x` → **Barristan** (B)
  - `3.x.x` → **Catelyn** (C)
  - ...and so on

Patch versions don't get individual codenames — only major releases do.

## 📜 License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Named after the loyal Hodor from Game of Thrones
- Inspired by the simplicity of `kubectx` and `kubens`
- Built with ❤️ by developers, for developers

---

**Hold the door to your clusters. Let Hodor handle the port-forwards.**

_Made with 🔥 by [Davide Maggi](https://github.com/yourusername)_
