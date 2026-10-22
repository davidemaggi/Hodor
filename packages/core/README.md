# @hodor/core

Core business logic and Kubernetes operations for Hodor.

## Overview

This package contains the shared logic used by both the GUI and CLI applications:

- **Kubernetes Client** — Wrapper around `@kubernetes/client-node` with kubectl fallback
- **Kubeconfig Management** — Parse, merge, and manage multiple kubeconfig files
- **Port-Forward Engine** — Start, stop, and monitor port-forwards
- **Template Management** — CRUD operations for port-forward templates
- **Secure Storage** — Store sensitive data securely
- **Internationalization** — i18n support for multiple languages

## Installation

```bash
pnpm add @hodor/core
```

## Usage

```typescript
import { KubernetesClient } from '@hodor/core/kubernetes';
import { TemplateManager } from '@hodor/core/templates';

// Initialize Kubernetes client
const client = new KubernetesClient();

// List clusters
const clusters = await client.getClusters();

// Create template manager
const templateManager = new TemplateManager();

// Create a new template
const template = await templateManager.create({
  name: 'my-dev-stack',
  description: 'Development environment',
  forwards: [
    {
      name: 'api',
      namespace: 'default',
      resource: 'service/api',
      localPort: 8080,
      remotePort: 8080,
    },
    {
      name: 'db',
      namespace: 'default',
      resource: 'service/postgres',
      localPort: 5432,
      remotePort: 5432,
    },
  ],
  tags: ['dev', 'backend'],
});
```

## Project Structure

```
src/
├── kubernetes/      # K8s client and operations
├── config/          # Kubeconfig management
├── storage/         # Secure storage layer
├── templates/       # Template management
├── secrets/         # Secrets & ConfigMaps
├── i18n/            # Internationalization
├── types/           # TypeScript types
└── utils/           # Utilities
```

## Development

```bash
# Watch mode
pnpm dev

# Build
pnpm build

# Test
pnpm test

# Test with coverage
pnpm test:coverage
```

## License

Apache 2.0
