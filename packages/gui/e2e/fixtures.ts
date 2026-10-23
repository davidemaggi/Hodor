import {
  test as base,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { join, resolve } from 'path';

/**
 * Launches the built app (out/) with a throwaway HOME, so tests never touch real kubeconfigs or ~/.hodor.
 * When HODOR_E2E_KUBECONFIG is set (CI with kind), that kubeconfig is copied in.
 */
export const test = base.extend<{ home: string; app: ElectronApplication; page: Page }>({
  // eslint-disable-next-line no-empty-pattern
  home: async ({}, use) => {
    const home = mkdtempSync(join(tmpdir(), 'hodor-e2e-'));
    mkdirSync(join(home, '.kube'));
    const source = process.env.HODOR_E2E_KUBECONFIG;
    if (source && existsSync(source)) copyFileSync(source, join(home, '.kube', 'config'));
    await use(home);
    rmSync(home, { recursive: true, force: true });
  },
  app: async ({ home }, use) => {
    const env = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      HODOR_USER_DATA: join(home, 'electron-data'),
    } as Record<string, string>;
    delete env.ELECTRON_RUN_AS_NODE;
    const app = await electron.launch({
      args: [resolve(__dirname, '..'), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
      env,
    });
    await use(app);
    await app.close();
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForSelector('.sheet');
    await use(page);
  },
});

export { expect } from '@playwright/test';
export const realHome = homedir();
