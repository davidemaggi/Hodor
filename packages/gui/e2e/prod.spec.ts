import { test, expect } from './fixtures';
import { readFileSync } from 'fs';
import { join } from 'path';

const KUBECONFIG = `apiVersion: v1
kind: Config
clusters:
- name: dev
  cluster: {server: 'https://127.0.0.1:1'}
- name: prod
  cluster: {server: 'https://127.0.0.1:2'}
users:
- name: me
  user: {token: x}
contexts:
- name: dev
  context: {cluster: dev, user: me}
- name: shop-prod
  context: {cluster: prod, user: me}
current-context: dev
`;

test.use({
  seed: {
    kubeconfig: KUBECONFIG,
    templates: [
      {
        name: 'api',
        forwards: [{ name: 'api', resourceName: 'api', localPort: 18080, remotePort: 80 }],
      },
    ],
  },
});

/** Mark shop-prod as production the way the switch does */
test.beforeEach(async ({ page, home }) => {
  const id = `${join(home, '.kube', 'config')}::shop-prod`;
  await page.evaluate(
    (cluster) => window.hodor!.settings.update({ productionClusters: [cluster] }),
    id
  );
});

// A template started for real keeps the app from quitting without asking (a native dialog no one
// can click here): stop everything before the fixture closes the app
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.hodor!.running.stopAll());
});

test('running a template on a production cluster asks first', async ({ page }) => {
  await page.goto(page.url().replace(/#.*$/, '#/templates'));
  await page.getByRole('row', { name: /api/ }).getByRole('button', { name: 'Run' }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.getByLabel('Cluster').selectOption({ label: 'shop-prod (prod)' });
  await dialog.getByRole('button', { name: 'Run on shop-prod' }).click();

  await expect(dialog.getByRole('heading', { name: 'Run on a production cluster?' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Back' })).toBeFocused();
  // Back: nothing started
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.getByRole('button', { name: 'Run on shop-prod' })).toBeVisible();
  expect(await page.evaluate(() => window.hodor!.running.list())).toEqual([]);

  // Yes: it starts (the fake cluster refuses, so the attempt ends in an error or a failed run)
  await dialog.getByRole('button', { name: 'Run on shop-prod' }).click();
  await dialog.getByRole('button', { name: 'Yes, run on shop-prod' }).click();
  await expect
    .poll(async () => (await dialog.count()) === 0 || (await dialog.getByRole('alert').count()) > 0)
    .toBe(true);
});

test("making a production cluster kubectl's default asks first", async ({ page, home }) => {
  await page.getByRole('link', { name: 'shop-prod' }).first().click();
  const button = page.getByRole('button', { name: "Make kubectl's default" });
  // The button only exists when kubectl is installed; the app checks that after loading
  const hasKubectl = await button.waitFor({ timeout: 5_000 }).then(
    () => true,
    () => false
  );
  test.skip(!hasKubectl, 'needs kubectl on this machine');
  await button.click();

  const dialog = page.locator('dialog[open]');
  await expect(dialog.getByRole('heading', { name: 'Point kubectl at shop-prod?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(readFileSync(join(home, '.kube', 'config'), 'utf-8')).toContain('current-context: dev');
});
