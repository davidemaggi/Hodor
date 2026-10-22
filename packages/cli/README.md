# @hodor/cli

Command-line interface for Hodor.

## Overview

Interactive and colorful CLI for managing Kubernetes port-forwards with templates.

## Installation

```bash
# Via package managers (coming soon)
brew install hodor
winget install hodor
choco install hodor

# Or install globally
pnpm install -g @hodor/cli
```

## Usage

```bash
# Launch interactive mode
hodor

# List clusters
hodor clusters

# Switch context
hodor ctx

# Switch namespace
hodor ns

# Merge kubeconfig files
hodor config merge ~/.kube/config-dev ~/.kube/config-prod

# Create template
hodor template create

# List templates
hodor template list

# Run template
hodor template run my-template

# Stop template
hodor template stop my-template

# Export template
hodor template export my-template -o template.json

# Import template
hodor template import template.json
```

## Features

- 🎨 Colorful and interactive prompts
- 🔍 Fuzzy search for clusters and templates
- 📊 Beautiful tables and progress indicators
- 🏷️ Tag-based template organization
- 📋 Command generation (Linux, macOS, Windows)

## Development

```bash
# Watch mode
pnpm dev

# Build
pnpm build

# Test CLI locally
node bin/hodor
```

## License

Apache 2.0
