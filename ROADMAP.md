# 🗺️ Hodor Roadmap

> **Current Status:** Pre-release Development  
> **Current Version:** `0.1.0-dev`  
> **Target Release:** `1.0.0 - Aerys` (Q1 2024)

This roadmap outlines the planned features and milestones for Hodor. We follow semantic versioning with Game of Thrones character codenames for major releases.

---

## 📅 Version History & Planning

### 🏗️ Phase 0: Foundation (Current - Pre-release)

**Version:** `0.1.0-dev` → `0.9.0-dev`  
**Status:** 🔄 In Progress  
**Timeline:** Now - Q4 2023

#### Milestone 0.1.0 - Project Setup ✅
- [x] Repository initialization
- [x] Project structure (monorepo with pnpm workspaces)
- [x] Basic tooling (TypeScript, ESLint, Prettier)
- [x] Development branch workflow
- [x] README and ROADMAP

#### Milestone 0.2.0 - Core Package ✅
- [x] Kubernetes client wrapper
  - [x] SDK integration (@kubernetes/client-node)
  - [x] kubectl binary fallback detection
  - [x] Version compatibility layer
- [x] Kubeconfig management
  - [x] Read all configs from ~/.kube
  - [x] Parse clusters, contexts, namespaces
  - [x] Merge kubeconfig files
- [x] Storage layer
  - [x] Secure storage implementation (keytar)
  - [x] Template persistence
  - [x] Settings persistence
  - [x] Last-used cluster memory

#### Milestone 0.3.0 - Port-Forward Engine ✅
- [x] Port-forward manager
  - [x] Start/stop individual forwards
  - [x] Multiple concurrent forwards
  - [x] Status monitoring
  - [x] Error handling and auto-restart
  - [x] Log capture
- [x] Template data model
  - [x] Template CRUD operations
  - [x] Tag system
  - [x] Import/export functionality
  - [x] Template validation

#### Milestone 0.4.0 - CLI Foundation
- [ ] CLI framework setup (Commander.js)
- [ ] Interactive prompts (Inquirer.js)
- [ ] Colorful output (Chalk)
- [ ] Basic commands:
  - [ ] `hodor clusters` - List clusters
  - [ ] `hodor ctx` - Switch context
  - [ ] `hodor ns` - Switch namespace
  - [ ] `hodor config merge` - Merge kubeconfigs

#### Milestone 0.5.0 - CLI Template Management
- [ ] Template commands:
  - [ ] `hodor template create` - Create template
  - [ ] `hodor template list` - List templates
  - [ ] `hodor template run` - Run template
  - [ ] `hodor template stop` - Stop template
  - [ ] `hodor template edit` - Edit template
  - [ ] `hodor template delete` - Delete template
  - [ ] `hodor template export` - Export template
  - [ ] `hodor template import` - Import template
- [ ] Template tag management
- [ ] Search and filtering

#### Milestone 0.6.0 - GUI Foundation (Electron + React)
- [ ] Electron setup
- [ ] React + TypeScript setup
- [ ] Routing structure
- [ ] Theme system (light/dark)
- [ ] Basic layout and navigation
- [ ] Component library setup

#### Milestone 0.7.0 - GUI Cluster Management
- [ ] Cluster list view
- [ ] Cluster detail view
- [ ] Context switching UI
- [ ] Namespace switching UI
- [ ] Active cluster indicator
- [ ] Kubeconfig merge UI

#### Milestone 0.8.0 - GUI Template Management
- [ ] Template list view with search/filter
- [ ] Template creation wizard
- [ ] Template editor
  - [ ] Add/remove port-forwards
  - [ ] Drag-and-drop reordering
  - [ ] Tag management
- [ ] Template execution view
  - [ ] Start/stop controls
  - [ ] Status indicators
  - [ ] Log viewer
- [ ] Import/Export UI

#### Milestone 0.9.0 - Secrets & ConfigMaps
- [ ] Fetch secrets for running forwards
- [ ] Fetch configmaps for running forwards
- [ ] Display values in GUI
- [ ] Copy-to-clipboard functionality
- [ ] CLI commands for viewing values
- [ ] Security best practices implementation

---

### 🎯 Phase 1: First Stable Release

**Version:** `1.0.0 - Aerys`  
**Status:** 📋 Planned  
**Timeline:** Q1 2024

#### Goals
- [ ] Feature-complete core functionality
- [ ] Stable API
- [ ] Full test coverage (unit + integration)
- [ ] Documentation complete
- [ ] Performance optimization
- [ ] Security audit

#### Features
- [ ] i18n implementation (English + Italian)
- [ ] kubectl command generation
  - [ ] Linux format
  - [ ] macOS format
  - [ ] Windows PowerShell format
- [ ] Advanced template features
  - [ ] Template variables
  - [ ] Template inheritance
- [ ] Enhanced logging and debugging
- [ ] Settings and preferences UI
- [ ] Auto-update mechanism

#### Testing & Quality
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests
- [ ] E2E tests (Playwright)
- [ ] Performance benchmarks
- [ ] Memory leak detection

#### Release Preparation
- [ ] GitHub Actions CI/CD pipeline
- [ ] Build automation for all platforms
- [ ] Code signing setup (Azure Artifact Sign for Windows)
- [ ] Release artifacts
  - [ ] .dmg (macOS)
  - [ ] .exe installer (Windows)
  - [ ] .deb / .rpm (Linux)
  - [ ] .tar.gz (universal)
  - [ ] .zip (universal)

---

### 🚀 Phase 2: Package Manager Distribution

**Version:** `1.1.0 - Aerys`  
**Status:** 📋 Planned  
**Timeline:** Q2 2024

#### Package Managers
- [ ] Homebrew (macOS/Linux)
- [ ] Winget (Windows)
- [ ] Chocolatey (Windows)
- [ ] Snap (Linux)
- [ ] AppImage (Linux)
- [ ] npm global install option

#### CI/CD Enhancements
- [ ] Automated package publishing
- [ ] Release notes generation
- [ ] Changelog automation
- [ ] Version bump automation

---

### 🌟 Phase 3: Advanced Features

**Version:** `1.2.0 - Aerys`  
**Status:** 💭 Ideation  
**Timeline:** Q2-Q3 2024

#### Potential Features (to be refined)
- [ ] Cloud provider integrations
  - [ ] AWS EKS quick access
  - [ ] Azure AKS quick access
  - [ ] GCP GKE quick access
- [ ] Team collaboration
  - [ ] Shared template repository
  - [ ] Team workspaces
- [ ] Advanced monitoring
  - [ ] Resource usage per forward
  - [ ] Connection statistics
  - [ ] Health checks
- [ ] Plugin system
  - [ ] Custom actions
  - [ ] Third-party integrations
- [ ] Template marketplace
  - [ ] Share templates publicly
  - [ ] Browse community templates

---

### 🔮 Phase 4: Enterprise Features

**Version:** `2.0.0 - Barristan`  
**Status:** 💭 Future  
**Timeline:** TBD

#### Potential Features (exploratory)
- [ ] RBAC integration
- [ ] Audit logging
- [ ] Centralized management server
- [ ] SSO integration
- [ ] Policy enforcement
- [ ] Compliance reporting

---

## 🏷️ Version Naming Convention

Hodor follows **Semantic Versioning** with a twist:

- **Format:** `MAJOR.MINOR.PATCH`
- **Codenames:** Each major version gets a Game of Thrones character name
  - `1.x.x` → **Aerys** (A)
  - `2.x.x` → **Barristan** (B)
  - `3.x.x` → **Catelyn** (C)
  - ... (continuing alphabetically with GoT characters)

**Rules:**
- Patch versions (`1.0.1`, `1.0.2`) don't get codenames
- Minor versions (`1.1.0`, `1.2.0`) share the major's codename
- Only major versions get new codenames

---

## 📊 Success Metrics

### Version 1.0 Success Criteria
- [ ] Zero critical bugs
- [ ] <100ms startup time (CLI)
- [ ] <2s startup time (GUI)
- [ ] <50MB memory usage (idle)
- [ ] Works with Kubernetes 1.20+
- [ ] 100+ GitHub stars
- [ ] Active community feedback

---

## 🤝 Contributing to the Roadmap

Have ideas? We'd love to hear them!

- 💡 Open an issue with the `enhancement` label
- 💬 Join discussions in GitHub Discussions
- 🗳️ Vote on features you'd like to see

---

## 📝 Change Log

### 0.1.0-dev (Current)
- Initial project setup
- Repository structure
- Development workflow established
- Documentation foundation

---

*Last Updated: 2023-10-22*  
*Maintained by: Davide Maggi*
