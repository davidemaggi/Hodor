# Changelog

All notable changes to Hodor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🎯 Targeting 1.0.0 - Aerys (Q1 2024)

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
