import { test, expect } from './fixtures';

test('starts with an isolated renderer and opens every section', async ({ page }) => {
  await expect(page).toHaveTitle('Hodor');

  // Context isolation: no Node in the page, only the typed bridge
  const isolation = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    bridge: Object.keys((window as unknown as { hodor: object }).hodor).sort(),
  }));
  expect(isolation).toEqual({
    require: 'undefined',
    process: 'undefined',
    bridge: ['app', 'clusters', 'kubeconfig', 'kubectl', 'running', 'settings', 'templates'],
  });

  for (const [shortcut, heading] of [
    ['2', 'Templates'],
    ['3', 'Running'],
    ['4', 'Settings'],
    ['1', 'Clusters'],
  ]) {
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+${shortcut}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('switches to Italian from Settings', async ({ page }) => {
  await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+4`);
  await page.getByLabel('Language').selectOption('it');
  await expect(page.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
});

test('shows the first-run states with no kubeconfig', async ({ page }) => {
  test.skip(!!process.env.HODOR_E2E_KUBECONFIG, 'needs an empty ~/.kube');
  await expect(page.getByText('No kubeconfig in ~/.kube yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Templates' }).first().click();
  await expect(
    page.getByText("No templates yet. Three steps and you're holding doors.")
  ).toBeVisible();
});
