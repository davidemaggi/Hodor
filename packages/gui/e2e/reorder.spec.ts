import { test, expect, seedId } from './fixtures';

/** Drag & drop reordering, with the mouse as a user does it (it used to do nothing for forwards) */
test.use({
  seed: {
    templates: [
      {
        name: 'alpha',
        forwards: [
          { name: 'api', resourceName: 'api', localPort: 18080, remotePort: 80 },
          { name: 'db', resourceName: 'postgres', localPort: 15432, remotePort: 5432 },
          { name: 'cache', resourceName: 'redis', localPort: 16379, remotePort: 6379 },
        ],
      },
      {
        name: 'beta',
        forwards: [{ name: 'web', resourceName: 'web', localPort: 18081, remotePort: 80 }],
      },
    ],
  },
});

test('forwards can be dragged into a new order in the editor', async ({ page }) => {
  await page.goto(page.url().replace(/#.*$/, `#/templates/${seedId(0)}`));
  const names = page.locator('.forward-row .name-input');
  const order = () => names.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  await expect.poll(order).toEqual(['api', 'db', 'cache']);

  // Drag "cache" by its handle onto the first row
  await page
    .locator('.forward-row')
    .nth(2)
    .locator('.drag-handle')
    .dragTo(page.locator('.forward-row').nth(0));
  await expect.poll(order).toEqual(['cache', 'api', 'db']);
});

test('templates can be dragged into a new order in the list', async ({ page }) => {
  await page.goto(page.url().replace(/#.*$/, '#/templates'));
  const groups = page.locator('.template-group');
  await expect(groups.first()).toContainText('alpha');

  await groups.nth(1).locator('.drag-handle').dragTo(groups.nth(0));
  await expect(groups.first()).toContainText('beta');
});
