import {
  test as base,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, rmSync, writeFileSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { join, resolve } from 'path';

/**
 * Launches the built app (out/) with a throwaway HOME, so tests never touch real kubeconfigs or ~/.hodor.
 * When HODOR_E2E_KUBECONFIG is set (CI with kind), that kubeconfig is copied in.
 */
/** Template ids are hex (the app's IPC refuses anything else): seed i → 0000000000000000…i */
export const seedId = (i: number) => i.toString(16).padStart(16, '0');

/** A template to start with: name and forwards (namespace/service/ports) */
export interface SeedTemplate {
  name: string;
  forwards: Array<{ name: string; resourceName: string; localPort: number; remotePort: number }>;
}

export const test = base.extend<{
  /**
   * Templates written to ~/.hodor/templates.json before the app starts. Wrapped in an object:
   * test.use() reads a bare [a, b] array as [value, fixture options].
   */
  seed: {
    templates?: SeedTemplate[];
    /** ~/.kube/config */
    kubeconfig?: string;
    /** More files in ~/.kube, by name */
    kubeFiles?: Record<string, string>;
  };
  home: string;
  app: ElectronApplication;
  page: Page;
}>({
  seed: [{ templates: [] }, { option: true }],
  home: async ({ seed: { templates = [], kubeconfig, kubeFiles = {} } }, use) => {
    const home = mkdtempSync(join(tmpdir(), 'hodor-e2e-'));
    mkdirSync(join(home, '.kube'));
    if (kubeconfig) writeFileSync(join(home, '.kube', 'config'), kubeconfig);
    for (const [name, content] of Object.entries(kubeFiles)) {
      writeFileSync(join(home, '.kube', name), content);
    }
    if (templates.length) {
      mkdirSync(join(home, '.hodor'));
      const now = new Date().toISOString();
      writeFileSync(
        join(home, '.hodor', 'templates.json'),
        JSON.stringify({
          version: '1.0',
          templates: templates.map((t, i) => ({
            id: seedId(i),
            name: t.name,
            tags: [],
            createdAt: now,
            updatedAt: now,
            forwards: t.forwards.map((f) => ({
              ...f,
              namespace: 'default',
              resourceType: 'service',
            })),
          })),
        })
      );
    }
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
