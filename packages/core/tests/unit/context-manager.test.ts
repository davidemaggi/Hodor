import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ContextManager } from '../../src/config/context-manager';
import { tmpDir, kubeconfig } from '../helpers/tmp';

async function setup(maxBackups = 10) {
  const dir = await tmpDir();
  const configPath = path.join(dir, 'config');
  const backupDir = path.join(dir, 'backups');
  await fs.writeFile(
    configPath,
    kubeconfig({ contexts: [{ name: 'dev' }, { name: 'prod', namespace: 'web' }] })
  );
  return {
    configPath,
    backupDir,
    manager: new ContextManager({ configPath, backupDir, maxBackups }),
  };
}

describe('ContextManager', () => {
  it('switches context, keeps comments and backs up the original', async () => {
    const { configPath, backupDir, manager } = await setup();
    const original = await fs.readFile(configPath, 'utf-8');

    await manager.switchContext('prod');

    const updated = await fs.readFile(configPath, 'utf-8');
    expect(await manager.getCurrentContext()).toBe('prod');
    expect(updated).toContain('# my precious kubeconfig comment');

    const backups = await fs.readdir(backupDir);
    expect(backups).toHaveLength(1);
    expect(await fs.readFile(path.join(backupDir, backups[0]), 'utf-8')).toBe(original);
  });

  it('rejects unknown contexts without touching the file', async () => {
    const { configPath, backupDir, manager } = await setup();
    const before = await fs.readFile(configPath, 'utf-8');
    await expect(manager.switchContext('nope')).rejects.toThrow(/not found/);
    expect(await fs.readFile(configPath, 'utf-8')).toBe(before);
    await expect(fs.readdir(backupDir)).rejects.toThrow();
  });

  it('sets the namespace of the current or given context', async () => {
    const { manager } = await setup();
    await manager.setNamespace('payments');
    expect(await manager.getContextNamespace('dev')).toBe('payments');
    await manager.setNamespace('api', 'prod');
    expect(await manager.getContextNamespace('prod')).toBe('api');
  });

  it('keeps only the configured number of backups', async () => {
    const { backupDir, manager } = await setup(2);
    for (const ns of ['a', 'b', 'c', 'd']) {
      await manager.setNamespace(ns);
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(await fs.readdir(backupDir)).toHaveLength(2);
  });

  it('reports cluster info', async () => {
    const { manager } = await setup();
    expect(await manager.getClusterInfo('prod')).toEqual({
      name: 'prod',
      server: 'https://prod.example:6443',
    });
    expect(await manager.getClusterInfo('ghost')).toBeNull();
  });
});

describe('ContextManager.mergeFiles', () => {
  it('appends new entries, keeps comments and existing entries, and backs up', async () => {
    const { configPath, backupDir, manager } = await setup();
    const download = path.join(path.dirname(configPath), 'download.yaml');
    await fs.writeFile(
      download,
      kubeconfig({ contexts: [{ name: 'prod', namespace: 'evil' }, { name: 'qa' }] })
    );

    const result = await manager.mergeFiles([download]);

    const text = await fs.readFile(configPath, 'utf-8');
    expect(result.added).toEqual(['qa']);
    expect(text).toContain('# my precious kubeconfig comment');
    expect(await manager.getContextNamespace('prod')).toBe('web'); // existing entry wins
    expect((await manager.listContexts()).map((c) => c.name)).toEqual(['dev', 'prod', 'qa']);
    expect(await manager.getCurrentContext()).toBe('dev');
    expect(await fs.readdir(backupDir)).toHaveLength(1);
    expect(result.backup).toMatch(/\.bak$/);
  });

  it('creates the kubeconfig when there is none yet', async () => {
    const dir = await tmpDir();
    const configPath = path.join(dir, 'config');
    const download = path.join(dir, 'download.yaml');
    await fs.writeFile(download, kubeconfig({ contexts: [{ name: 'qa' }] }));
    const manager = new ContextManager({ configPath, backupDir: path.join(dir, 'b') });

    expect(await manager.mergeFiles([download])).toEqual({ backup: null, added: ['qa'] });
    expect(await manager.getCurrentContext()).toBe('qa');
  });
});
