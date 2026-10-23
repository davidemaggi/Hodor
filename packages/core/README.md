# @hodor/core

The engine behind Hodor: kubeconfig discovery and editing, cluster health checks, the port-forward engine, templates, storage. No UI here; the CLI and the desktop app both sit on top of it.

```ts
import { ClusterDiscovery, TemplateManager, TemplateStorage, TemplateExecutor } from '@hodor/core';

const discovery = new ClusterDiscovery();
const cluster = (await discovery.list()).find((c) => c.isDefault)!;

const storage = new TemplateStorage();
await storage.initialize();
const templates = new TemplateManager(storage);

const template = await templates.create({
  name: 'dev-stack',
  tags: ['dev'],
  forwards: [
    {
      name: 'api',
      namespace: 'shop',
      resourceType: 'service',
      resourceName: 'api',
      localPort: 18080,
      remotePort: 80,
    },
  ],
});

const executor = new TemplateExecutor(await discovery.connect(cluster));
await executor.execute(template, cluster.id);
```

```bash
pnpm build
pnpm test                 # unit tests
HODOR_IT=1 pnpm test      # + port-forward against kubectl's default context
```
