import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface Settings {
  language: string;
  theme: 'light' | 'dark';
  lastUsedCluster?: string;
  lastUsedContext?: string;
  autoStart: boolean;
  notifications: boolean;
  checkUpdates: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'dark',
  autoStart: false,
  notifications: true,
  checkUpdates: true,
};

/**
 * Manages application settings
 */
export class SettingsStorage {
  private settingsPath: string;
  private settings: Settings;

  constructor(customPath?: string) {
    this.settingsPath = customPath || path.join(os.homedir(), '.hodor', 'settings.json');
    this.settings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Initialize settings storage
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      await this.load();
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Load settings from disk
   */
  async load(): Promise<Settings> {
    try {
      const content = await fs.readFile(this.settingsPath, 'utf-8');
      this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
      return this.settings;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, use defaults
        this.settings = { ...DEFAULT_SETTINGS };
        await this.save();
        return this.settings;
      }
      throw error;
    }
  }

  /**
   * Save settings to disk
   */
  async save(): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      const content = JSON.stringify(this.settings, null, 2);
      await fs.writeFile(this.settingsPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save settings: ${error}`);
    }
  }

  /**
   * Get all settings
   */
  getAll(): Settings {
    return { ...this.settings };
  }

  /**
   * Get a specific setting
   */
  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.settings[key];
  }

  /**
   * Set a specific setting
   */
  async set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    this.settings[key] = value;
    await this.save();
  }

  /**
   * Update multiple settings
   */
  async update(updates: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.save();
  }

  /**
   * Reset settings to defaults
   */
  async reset(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.save();
  }

  /**
   * Ensure settings directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    const dir = path.dirname(this.settingsPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create settings directory: ${error}`);
    }
  }

  /**
   * Get settings file path
   */
  getSettingsPath(): string {
    return this.settingsPath;
  }
}
