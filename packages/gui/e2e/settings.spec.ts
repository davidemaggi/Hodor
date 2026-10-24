import { test, expect } from './fixtures';

/** Settings that the renderer changes must stick (the IPC schema used to refuse them silently) */
test.use({
  seed: {
    kubeconfig: `apiVersion: v1
kind: Config
clusters:
- name: a
  cluster: {server: 'https://127.0.0.1:1'}
users:
- name: u
  user: {token: x}
contexts:
- name: shop-prod
  context: {cluster: a, user: u}
current-context: shop-prod
`,
  },
});

test('a cluster can be marked as production', async ({ page }) => {
  await page
    .getByRole('link', { name: /shop-prod/ })
    .first()
    .click();
  const toggle = page.getByLabel('Production cluster');
  await expect(toggle).not.toBeChecked();
  // The switch follows the saved setting, so it flips once the main process answers
  await toggle.click();
  await expect(toggle).toBeChecked();
  expect(await page.evaluate(() => window.hodor!.settings.get())).toMatchObject({
    productionClusters: [expect.stringMatching(/::shop-prod$/)],
  });

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Clusters' })
    .click();
  await expect(page.locator('.tag.prod').first()).toBeVisible();
});

test('the update check can be turned off', async ({ page }) => {
  await page.getByRole('link', { name: 'Settings' }).click();
  const toggle = page.getByLabel(/new version is out/i);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => window.hodor!.settings.get())).toMatchObject({
    checkUpdates: false,
  });
});
