import { test, expect } from './fixtures';
import type { ElectronApplication } from '@playwright/test';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

const kubeconfig = (context: string, server: string, token: string) => `apiVersion: v1
kind: Config
clusters:
- name: main
  cluster: {server: '${server}'}
users:
- name: me
  user: {token: ${token}}
contexts:
- name: ${context}
  context: {cluster: main, user: me, namespace: ${context}}
current-context: ${context}
`;

test.use({
  seed: {
    kubeconfig: kubeconfig('shop', 'https://127.0.0.1:1', 'shop-token'),
    kubeFiles: { 'work.yaml': kubeconfig('work', 'https://127.0.0.1:2', 'work-token') },
  },
});

/** The native save dialog can't be clicked: answer it from the main process */
const saveTo = (app: ElectronApplication, file: string) =>
  app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as never;
  }, file);

test('exports the selected clusters as one kubeconfig', async ({ app, page, home }) => {
  const out = join(home, 'out', 'two.yaml');
  await saveTo(app, out);

  await page.getByLabel('Select shop').check();
  await page.getByLabel('Select work').check();
  await page.getByRole('button', { name: 'Export kubeconfig (2)' }).click();
  await expect(page.getByRole('status')).toContainText('Saved 2 contexts');
  await expect(page.getByRole('status')).toContainText('me → me-2');

  const config = YAML.parse(readFileSync(out, 'utf-8'));
  expect(config.contexts.map((c: { name: string }) => c.name).sort()).toEqual(['shop', 'work']);
  // Both files call their cluster "main" and their user "me", with different content
  expect(config.clusters.map((c: { name: string }) => c.name).sort()).toEqual(['main', 'main-2']);
  expect(config.users.map((u: { user: { token: string } }) => u.user.token).sort()).toEqual([
    'shop-token',
    'work-token',
  ]);
  if (process.platform !== 'win32') expect(statSync(out).mode & 0o777).toBe(0o600);
});

test("won't save over one of your kubeconfigs", async ({ app, page, home }) => {
  await saveTo(app, join(home, '.kube', 'work.yaml'));
  await page.getByLabel('Select shop').check();
  await page.getByRole('button', { name: 'Export kubeconfig (1)' }).click();
  await expect(page.getByRole('alert')).toContainText('is one of your kubeconfigs');
  expect(readFileSync(join(home, '.kube', 'work.yaml'), 'utf-8')).toContain('work-token');
});
