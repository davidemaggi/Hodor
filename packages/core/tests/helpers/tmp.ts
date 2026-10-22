import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach } from 'vitest';

const dirs: string[] = [];

export async function tmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hodor-test-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

export function kubeconfig(opts: {
  current?: string;
  contexts: Array<{ name: string; cluster?: string; namespace?: string }>;
}): string {
  const clusters = [...new Set(opts.contexts.map((c) => c.cluster || c.name))];
  return [
    '# my precious kubeconfig comment',
    'apiVersion: v1',
    'kind: Config',
    `current-context: ${opts.current ?? opts.contexts[0].name}`,
    'clusters:',
    ...clusters.flatMap((c) => [
      `  - name: ${c}`,
      '    cluster:',
      `      server: https://${c}.example:6443`,
    ]),
    'users:',
    '  - name: me',
    '    user:',
    '      token: not-a-real-token',
    'contexts:',
    ...opts.contexts.flatMap((c) => [
      `  - name: ${c.name}`,
      '    context:',
      `      cluster: ${c.cluster || c.name}`,
      '      user: me',
      ...(c.namespace ? [`      namespace: ${c.namespace}`] : []),
    ]),
    '',
  ].join('\n');
}
