import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ClusterDiscovery, clusterId } from '../../src/kubernetes/discovery';
import { tmpDir, kubeconfig } from '../helpers/tmp';

describe('ClusterDiscovery', () => {
  const originalEnv = process.env.KUBECONFIG;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = originalEnv;
  });

  async function setup() {
    const dir = await tmpDir();
    process.env.KUBECONFIG = path.join(dir, 'config');
    await fs.writeFile(
      path.join(dir, 'config'),
      kubeconfig({ current: 'dev', contexts: [{ name: 'dev' }, { name: 'shared' }] })
    );
    await fs.writeFile(
      path.join(dir, 'other'),
      kubeconfig({ current: 'stage', contexts: [{ name: 'stage' }, { name: 'shared' }] })
    );
    return { dir, discovery: new ClusterDiscovery(dir) };
  }

  it('lists contexts from every kubeconfig and flags only the kubectl default', async () => {
    const { discovery } = await setup();
    const clusters = await discovery.list();
    expect(clusters.map((c) => `${path.basename(c.sourceFile)}:${c.name}`)).toEqual([
      'config:dev',
      'config:shared',
      'other:stage',
      'other:shared',
    ]);
    // "stage" is current in its own file, but kubectl only uses the default file
    expect(clusters.filter((c) => c.isDefault).map((c) => c.name)).toEqual(['dev']);
  });

  it('finds by id or unambiguous name', async () => {
    const { dir, discovery } = await setup();
    expect((await discovery.find('stage'))?.name).toBe('stage');
    expect((await discovery.find(clusterId(path.join(dir, 'other'), 'shared')))?.sourceFile).toBe(
      path.join(dir, 'other')
    );
    await expect(discovery.find('shared')).rejects.toThrow(/several kubeconfigs/);
    expect(await discovery.find('ghost')).toBeUndefined();
  });

  it('reports unreachable clusters without throwing', async () => {
    const { discovery } = await setup();
    const [dev] = await discovery.list();
    // .example never resolves
    const health = await discovery.checkHealth(dev, 2000);
    expect(health.reachable).toBe(false);
  });
});
