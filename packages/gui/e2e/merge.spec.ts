import { test, expect } from './fixtures';
import type { ElectronApplication } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

const kubeconfig = (contexts: Array<[name: string, server: string]>, comment = '') => `${comment}
apiVersion: v1
kind: Config
clusters:
${contexts.map(([n, s]) => `- name: ${n}\n  cluster: {server: '${s}'}`).join('\n')}
users:
- name: me
  user: {token: t}
contexts:
${contexts.map(([n]) => `- name: ${n}\n  context: {cluster: ${n}, user: me}`).join('\n')}
current-context: ${contexts[0][0]}
`;

test.use({
  seed: {
    kubeconfig: kubeconfig([['shop', 'https://127.0.0.1:1']], '# keep me'),
    kubeFiles: {
      'work.yaml': kubeconfig([
        ['work', 'https://127.0.0.1:2'],
        ['shop', 'https://127.0.0.1:3'],
        ['unpicked', 'https://127.0.0.1:4'],
      ]),
    },
  },
});

const contextsIn = (file: string) =>
  YAML.parse(readFileSync(file, 'utf-8')).contexts.map((c: { name: string }) => c.name);

test('takes the ticked contexts from one of your kubeconfigs into another', async ({
  page,
  home,
}) => {
  await page.getByRole('link', { name: 'Merge kubeconfig' }).click();
  await expect(page.getByRole('heading', { name: 'Merge kubeconfigs', level: 1 })).toBeVisible();

  await page
    .getByRole('listitem')
    .filter({ hasText: 'work.yaml' })
    .getByRole('button', { name: 'Take contexts from it' })
    .click();
  await page.getByLabel('Bring unpicked over').uncheck();

  const rows = page.locator('.merge-source tbody tr');
  await expect(rows.filter({ hasText: 'work' }).first()).toContainText('New');
  await expect(rows.filter({ hasText: 'shop' })).toContainText('As shop-2');
  await expect(rows.filter({ hasText: 'unpicked' })).not.toContainText('New');

  await page.getByRole('button', { name: 'Merge 2 contexts' }).click();
  await expect(page.getByRole('status')).toContainText('work, shop-2');

  const config = join(home, '.kube', 'config');
  expect(contextsIn(config)).toEqual(['shop', 'work', 'shop-2']);
  expect(readFileSync(config, 'utf-8')).toContain('# keep me');
  expect(readdirSync(join(home, '.hodor', 'backups'))).toHaveLength(1);
  // Merging again changes nothing
  await expect(rows.filter({ hasText: 'shop' })).toContainText('Already there');
  await expect(page.getByRole('button', { name: /Merge 0 contexts/ })).toBeDisabled();
});

/** The native open dialog can't be clicked: answer it from the main process */
const openFiles = (app: ElectronApplication, files: string[]) =>
  app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths })) as never;
  }, files);

test('adds a downloaded file and merges into the kubeconfig you choose', async ({
  app,
  page,
  home,
}) => {
  mkdirSync(join(home, 'Downloads'));
  const downloaded = join(home, 'Downloads', 'qa.yaml');
  writeFileSync(downloaded, kubeconfig([['qa', 'https://127.0.0.1:5']]));
  await openFiles(app, [downloaded]);

  await page.getByRole('link', { name: 'Merge kubeconfig' }).click();
  await page.getByRole('button', { name: 'Add files' }).click();
  await expect(page.locator('.merge-source h2')).toContainText('qa.yaml');

  await page.getByRole('radio', { name: /work\.yaml/ }).check();
  await page.getByRole('button', { name: 'Merge 1 context' }).click();
  await expect(page.getByRole('status')).toContainText('qa');
  expect(contextsIn(join(home, '.kube', 'work.yaml'))).toContain('qa');
  expect(contextsIn(join(home, '.kube', 'config'))).toEqual(['shop']);
});
