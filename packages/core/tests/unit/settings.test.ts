import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { SettingsStorage } from '../../src/storage/settings-storage';
import { tmpDir } from '../helpers/tmp';

describe('SettingsStorage', () => {
  it('defaults to the system theme and English', async () => {
    const settings = new SettingsStorage(path.join(await tmpDir(), 'settings.json'));
    await settings.initialize();
    expect(settings.getAll()).toEqual({ language: 'en', theme: 'system' });
  });

  it('persists changes and keeps unknown files from breaking startup', async () => {
    const file = path.join(await tmpDir(), 'settings.json');
    const settings = new SettingsStorage(file);
    await settings.initialize();
    await settings.update({ theme: 'dark', lastUsedCluster: '/k::dev' });

    const reloaded = new SettingsStorage(file);
    await reloaded.initialize();
    expect(reloaded.get('theme')).toBe('dark');
    expect(reloaded.get('lastUsedCluster')).toBe('/k::dev');

    await fs.writeFile(file, '{ not json');
    const broken = new SettingsStorage(file);
    await broken.initialize();
    expect(broken.get('theme')).toBe('system');
  });
});
