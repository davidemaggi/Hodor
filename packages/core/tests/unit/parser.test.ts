import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { KubeConfigParser } from '../../src/config/parser';
import { tmpDir, kubeconfig } from '../helpers/tmp';

describe('KubeConfigParser', () => {
  const parser = new KubeConfigParser();
  const originalEnv = process.env.KUBECONFIG;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = originalEnv;
  });

  it('parses a kubeconfig and normalises missing lists', () => {
    const config = parser.parseContent('apiVersion: v1\nkind: Config\n');
    expect(config.clusters).toEqual([]);
    expect(config.contexts).toEqual([]);
  });

  it('rejects YAML that is not a kubeconfig', () => {
    expect(() => parser.parseContent('apiVersion: v1\nkind: Pod\n')).toThrow(/kubeconfig/);
    expect(() => parser.parseContent('just a string')).toThrow();
  });

  it('discovers only kubeconfigs in the directory', async () => {
    const dir = await tmpDir();
    process.env.KUBECONFIG = path.join(dir, 'config');
    await fs.writeFile(path.join(dir, 'config'), kubeconfig({ contexts: [{ name: 'a' }] }));
    await fs.writeFile(path.join(dir, 'prod.yaml'), kubeconfig({ contexts: [{ name: 'p' }] }));
    await fs.writeFile(path.join(dir, 'notes.txt'), 'hello');
    await fs.writeFile(path.join(dir, 'config.lock'), '');
    await fs.mkdir(path.join(dir, 'cache'));

    const found = await parser.discover(dir);
    expect(found.map((f) => path.basename(f.path))).toEqual(['config', 'prod.yaml']);
  });

  it('returns nothing when the directory does not exist', async () => {
    expect(await parser.discover('/definitely/not/here')).toEqual([]);
  });

  it('uses the first KUBECONFIG entry with the platform delimiter', () => {
    process.env.KUBECONFIG = ['/first', '/second'].join(path.delimiter);
    expect(parser.getDefaultConfigPath()).toBe('/first');
  });

  it('writes atomically with owner-only permissions', async () => {
    const file = path.join(await tmpDir(), 'out');
    await parser.writeConfig(file, parser.parseContent(kubeconfig({ contexts: [{ name: 'a' }] })));
    const stat = await fs.stat(file);
    if (process.platform !== 'win32') expect(stat.mode & 0o777).toBe(0o600);
    expect((await fs.readdir(path.dirname(file))).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('validates references', () => {
    const config = parser.parseContent(kubeconfig({ contexts: [{ name: 'a' }] }));
    config['current-context'] = 'ghost';
    const result = parser.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toMatch(/ghost/);
  });
});
