import { describe, it, expect } from 'vitest';
import * as http from 'http';
import * as net from 'net';
import { ClusterDiscovery } from '../../src/kubernetes/discovery';
import { TemplateExecutor } from '../../src/templates/executor';
import type { Template } from '../../src/types';

/**
 * Runs against the kubectl default context. Opt in with HODOR_IT=1.
 * Needs a cluster with CoreDNS exposed through the kube-system/kube-dns service (most distributions).
 */
describe.skipIf(!process.env.HODOR_IT)('port-forward against a real cluster', () => {
  it('forwards a service through to its pod and frees the port on stop', async () => {
    const discovery = new ClusterDiscovery();
    const cluster = (await discovery.list()).find((c) => c.isDefault);
    expect(cluster, 'no default kubectl context').toBeDefined();

    const executor = new TemplateExecutor(await discovery.connect(cluster!));
    const template: Template = {
      id: 'it-dns',
      name: 'it-dns',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      forwards: [
        {
          name: 'metrics',
          namespace: 'kube-system',
          resourceType: 'service',
          resourceName: 'kube-dns',
          localPort: 19153,
          remotePort: 9153,
        },
      ],
    };

    const execution = await executor.execute(template, cluster!.id);
    expect(execution.status).toBe('running');

    const status = await new Promise<number>((resolve, reject) =>
      http
        .get('http://127.0.0.1:19153/metrics', (res) => {
          res.resume();
          resolve(res.statusCode!);
        })
        .on('error', reject)
    );
    expect(status).toBe(200);

    await executor.stop(template.id);
    const free = await new Promise<boolean>((resolve) => {
      const server = net.createServer().once('error', () => resolve(false));
      server.listen(19153, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    expect(free).toBe(true);
  }, 30000);
});
