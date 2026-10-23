import { test, expect } from './fixtures';
import * as http from 'http';

/**
 * Full flow against a real cluster: build a template from the picker, run it, use the tunnel, stop it.
 * Runs only when HODOR_E2E_KUBECONFIG points at a cluster with kube-system/kube-dns (kind in CI).
 */
test.skip(!process.env.HODOR_E2E_KUBECONFIG, 'needs HODOR_E2E_KUBECONFIG');

const get = (port: number) =>
  new Promise<number>((resolve, reject) =>
    http
      .get({ host: '127.0.0.1', port, path: '/metrics', timeout: 5000 }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
      .on('error', reject)
  );

test('creates, runs and stops a template on the cluster', async ({ page }) => {
  await page.goto(page.url().replace(/#.*$/, '#/templates/new'));
  await page.getByLabel('Name', { exact: true }).fill('dns-e2e');

  const picker = page.locator('.picker');
  await picker.getByLabel('Namespace').selectOption('kube-system');
  await picker.getByRole('button', { name: /kube-dns:9153/ }).click();
  await expect(page.locator('.port-input')).toHaveValue('19153');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/#\/templates$/);

  await page
    .getByRole('row', { name: /dns-e2e/ })
    .getByRole('button', { name: 'Run' })
    .click();
  await page.locator('dialog[open]').getByRole('button', { name: /^Run/ }).click();
  await expect(page).toHaveURL(/#\/running$/);
  await expect(page.locator('.door .port')).toHaveText(':19153');

  await expect.poll(() => get(19153).catch(() => 0), { timeout: 20_000 }).toBe(200);

  await page.getByRole('button', { name: 'Stop', exact: true }).first().click();
  await expect(page.getByText('Nothing is holding a door right now')).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(() =>
      get(19153).then(
        () => 'open',
        () => 'closed'
      )
    )
    .toBe('closed');
});
