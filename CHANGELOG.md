# Changelog

All notable changes to Hodor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🎯 Targeting 1.0.0 - Aerys (Q1 2024)

---

## [0.5.0-dev] - 2023-10-22

### 🎉 Added - Milestone 0.5.0: CLI Template Management

**Template Creation:**

- `hodor template:create` - Interactive wizard for creating templates
  - Step-by-step template configuration
  - Add multiple port-forwards
  - Link secrets and configmaps to forwards
  - Tag support for organization
  - Name validation and duplicate checking
  - Resource type selection (pod, service, deployment)
  - Port validation

**Template Listing:**

- `hodor template:list` - List all templates
  - Formatted table with name, description, forward count, tags
  - Filter by tags with `--tags` option
  - Search by name/description with `--search` option
  - Shows last updated date
  - Summary with total count and available tags

**Template Execution:**

- `hodor template:run <name>` - Run a template
  - Interactive cluster selection
  - Real-time forward status display
  - Error handling with status indicators
  - Auto-restart support from core engine
  - Graceful shutdown on Ctrl+C
  - Shows all forwards with their status (running/error/stopped)
  - Port mapping display (local → resource:remote)

**Template Deletion:**

- `hodor template:delete <name>` - Delete a template
  - Confirmation prompt (skippable with `--force`)
  - Safe deletion with feedback

**Template Import/Export:**

- `hodor template:export <name>` - Export template to JSON
  - Single template export
  - Multiple templates export with `--multiple` flag
  - Custom output path with `--output` option
  - Default filenames generated from template name

- `hodor template:import <file>` - Import template from JSON
  - Import single or multiple templates
  - Automatic ID regeneration
  - Shows imported template details

**Command Aliases:**

- `template:new` → `template:create`
- `template:ls` → `template:list`
- `template:rm` → `template:delete`

**Interactive Experience:**

- Colorful status indicators (● for active, ○ for inactive, ✖ for error)
- Real-time spinners during operations
- Clear success/error messages
- Helpful hints for next steps

**Integration:**

- Full integration with core TemplateManager
- Uses TemplateExecutor for running templates
- Kubernetes client integration for cluster selection
- Port-forward manager with auto-restart

### 🏗️ Architecture

- Modular template commands in separate files
- Consistent error handling across commands
- Type-safe command handlers
- Clean separation of concerns

### 📋 Next Milestone (0.6.0)

- GUI foundation with Electron + React
- Theme system (light/dark)
- Basic layout and navigation

---

## [0.4.0-dev] - 2023-10-22

### 🎉 Added - Milestone 0.4.0: CLI Foundation

**CLI Framework:**

- Commander.js integration for command structure
- Version display with `-v, --version` flag
- Help system with command descriptions
- ES Module support for modern JavaScript

**Interactive Commands:**

- `hodor clusters` - List all available Kubernetes clusters
  - Formatted table output with cluster details
  - Shows active/inactive status
  - Server URLs and namespace information
  - Summary with counts

- `hodor ctx [context]` - Switch Kubernetes context
  - Interactive context selection when no argument provided
  - Shows current context with green indicator (●)
  - Displays cluster info after switching
  - Namespace information included

- `hodor ns [namespace]` - Switch Kubernetes namespace
  - Interactive namespace selection from cluster
  - Fetches live namespace list from cluster
  - Fallback to manual input if cluster unreachable
  - Shows current namespace with indicator

- `hodor config:merge <files...>` - Merge multiple kubeconfig files
  - Merge multiple kubeconfig files into one
  - Optional output file with `-o` flag
  - Shows merge summary (clusters, users, contexts)
  - Validates all input files exist

**CLI UI Components:**

- Colorful output using Chalk
  - Success messages in green
  - Errors in red
  - Info in cyan
  - Warnings in yellow
  - Dim text for secondary information

- Loading spinners with Ora
  - Context-aware messages
  - Success/fail indicators

- Interactive prompts with Inquirer.js
  - List selection for contexts/namespaces
  - Current item indicators
  - Keyboard navigation

- Formatted tables with cli-table3
  - Clean cluster listing
  - Column width management
  - Header styling

**Architecture:**

- ES Modules throughout CLI package
- Dynamic imports for commands (faster startup)
- Clean separation of commands
- Reusable patterns for future commands

**Developer Experience:**

- Type-safe command handlers
- Error handling with clear messages
- Exit codes for scripting support

### 📋 Next Milestone (0.5.0)

- Template management commands
- Template creation wizard
- Template execution and listing
- Import/Export functionality

---

## [0.3.0-dev] - 2023-10-22

### 🎉 Added - Milestone 0.3.0: Port-Forward Engine Enhancement

**Log Capture System:**

- `LogCapture` class for capturing and managing port-forward logs
- Support for different log levels (info, warn, error, debug)
- Log filtering by level, forward ID, and search query
- Get recent logs, error counts, warning counts
- Export logs as JSON
- Maximum log entries per forward (configurable, default 1000)

**Auto-Restart & Error Handling:**

- Auto-restart functionality for port-forwards
- Configurable max restart attempts (default: 3)
- Exponential backoff for restart delays (1s, 2s, 4s... max 30s)
- Graceful error handling with detailed logging
- Connection close detection and recovery
- Restart timer management with proper cleanup

**Enhanced Port-Forward Manager:**

- Integration with LogCapture for all operations
- New events: `restarting`, `restarted`, `restart-failed`, `closed`
- Status tracking includes restart attempts and restarting state
- Methods to get logs and clear logs per forward
- Enhanced error messages with context

**Template Executor Improvements:**

- Integration with LogCapture for template execution logging
- Auto-restart enabled by default for template forwards (3 attempts)
- Forward all restart events from PortForwardManager
- Get logs for entire template or specific forwards
- Clear logs functionality for templates
- Access to LogCapture instance

**Utility Functions:**

- `CommandGenerator` for generating kubectl commands
  - Generate commands for Linux, macOS, and Windows (PowerShell)
  - Generate shell scripts (Bash for Linux/macOS, PowerShell for Windows)
  - Generate Makefile targets
  - Generate Docker Compose files
- `Logger` utility class for consistent logging across packages
- `Validators` for port numbers, resource names, namespaces, tags, URLs
- Helper functions: sanitizeFilename, isEmpty, validateUrl

**Type Enhancements:**

- Added `autoRestart` and `maxRestartAttempts` to `PortForwardOptions`
- Added `restarting` status to `PortForwardStatus`
- Added `restartAttempts` to `PortForwardStatus`
- `ActiveForward` interface for internal tracking

### 🏗️ Architecture Improvements

- Event-driven restart mechanism with exponential backoff
- Comprehensive logging throughout port-forward lifecycle
- Clean separation between log capture and port-forward logic
- Enhanced error recovery with automatic retry logic

### 📋 Next Milestone (0.4.0)

- CLI foundation with Commander.js
- Interactive prompts with Inquirer.js
- Colorful terminal output with Chalk

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

_This changelog is maintained following the [Keep a Changelog](https://keepachangelog.com/) format._
