# Changelog

All notable changes to Hodor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🎯 Targeting 1.0.0 - Aerys (Q1 2024)

---

## [0.2.0-dev] - 2023-10-22

### 🎉 Added - Milestone 0.2.0: Core Package Implementation

**Kubernetes Client & Operations:**
- `KubernetesClient` wrapper around @kubernetes/client-node
- Cluster listing and management
- Context switching functionality
- Pod, Service, and Namespace listing
- Secret and ConfigMap retrieval
- Server version detection and connectivity checks

**Port-Forward Engine:**
- `PortForwardManager` for managing port-forwards
- Support for Pod, Service, and Deployment forwarding
- Event-driven architecture (started, stopped, error events)
- Multiple concurrent port-forwards
- Automatic pod discovery from services/deployments

**Kubeconfig Management:**
- `KubeConfigParser` for parsing and validating kubeconfig files
- Load all configs from ~/.kube directory
- Config validation with detailed error reporting
- Write kubeconfig files

**Context Management:**
- `ContextManager` for kubectl context operations
- Switch contexts programmatically
- Set namespace for contexts
- List all available contexts
- Get cluster information
- Config backup functionality

**Kubeconfig Merging:**
- `KubeConfigMerger` for combining multiple kubeconfigs
- Merge by file paths or in-memory configs
- Deduplication of clusters, users, and contexts
- Conflict detection and warnings

**Secure Storage:**
- `SecureStorage` using system keychain (keytar)
- Fallback encryption for systems without keytar
- AES-256-GCM encryption
- Store/retrieve/delete secrets securely

**Settings Management:**
- `SettingsStorage` for application settings
- Persistent settings (theme, language, last used cluster)
- Default settings with override capability
- Settings validation

**Template Storage:**
- `TemplateStorage` for port-forward templates
- CRUD operations on templates
- Search and filter by name/tags
- Tag management
- Import/Export single or multiple templates
- JSON-based persistence in ~/.hodor directory

**Template Management:**
- `TemplateManager` high-level template API
- Add/remove/update port-forwards in templates
- Reorder forwards
- Tag operations (add/remove)
- Duplicate templates
- Name conflict detection

**Template Validation:**
- `TemplateValidator` for validating templates
- Port-forward configuration validation
- Port conflict detection
- Execution readiness checks
- Detailed error and warning messages

**Template Execution:**
- `TemplateExecutor` for running templates
- Execute templates on selected clusters
- Start/stop individual forwards or entire templates
- Status tracking (running, stopped, partial, error)
- Event-driven architecture
- Graceful error handling

### 📦 Dependencies Added
- `@kubernetes/client-node` ^0.20.0 - Kubernetes client
- `js-yaml` ^4.1.0 - YAML parsing for kubeconfigs
- `keytar` ^7.9.0 - Secure credential storage
- `i18next` ^23.7.6 - Internationalization
- `zod` ^3.22.4 - Schema validation

### 🏗️ Architecture
- Complete core package implementation
- Clean separation of concerns
- Event-driven port-forward management
- Extensible storage layer
- Type-safe TypeScript throughout

### 📋 Next Milestone (0.3.0)
- Port-forward log capture
- Auto-restart on failure
- Template variables support

---

## [0.1.0-dev] - 2023-10-22

### 🎉 Added
- Initial project structure with monorepo setup (pnpm workspaces)
- Development branch workflow (`develop` branch)
- Core documentation:
  - README.md with project overview and features
  - ROADMAP.md with detailed development plan
  - AGENTS.md with AI-assisted development conventions
  - VERSION.md with versioning scheme
  - CONTRIBUTING.md with contribution guidelines
  - CHANGELOG.md (this file)
- Optimized .gitignore for Electron + TypeScript development
- Apache 2.0 License
- Semantic versioning with Game of Thrones codenames

### 🏗️ Project Foundation
- Monorepo structure with three packages:
  - `@hodor/core` - Shared business logic
  - `@hodor/gui` - Electron + React application
  - `@hodor/cli` - Command-line interface
- Version naming scheme (1.x.x = Aerys, 2.x.x = Barristan, etc.)
- Development workflow and Git branching strategy
- CI/CD preparation (GitHub Actions structure)

### 📋 Planned for Next Release (0.2.0)
- Kubernetes client wrapper implementation
- Kubeconfig management
- Storage layer with secure credential handling

---

## Version History

- **0.1.0-dev** (2023-10-22) - Initial project setup

---

## Legend

- 🎉 **Added** — New features
- ✨ **Changed** — Changes in existing functionality
- 🗑️ **Deprecated** — Soon-to-be removed features
- ❌ **Removed** — Removed features
- 🐛 **Fixed** — Bug fixes
- 🔒 **Security** — Security improvements

---

*This changelog is maintained following the [Keep a Changelog](https://keepachangelog.com/) format.*
