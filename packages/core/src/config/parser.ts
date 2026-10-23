import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';

export interface KubeConfigCluster {
  name: string;
  cluster: {
    server: string;
    'certificate-authority'?: string;
    'certificate-authority-data'?: string;
    'insecure-skip-tls-verify'?: boolean;
  };
}

export interface KubeConfigUser {
  name: string;
  user: Record<string, unknown>;
}

export interface KubeConfigContext {
  name: string;
  context: {
    cluster: string;
    user: string;
    namespace?: string;
  };
}

export interface KubeConfigFile {
  apiVersion: string;
  kind: string;
  clusters: KubeConfigCluster[];
  users: KubeConfigUser[];
  contexts: KubeConfigContext[];
  'current-context'?: string;
  [key: string]: unknown;
}

export interface DiscoveredKubeConfig {
  path: string;
  config: KubeConfigFile;
}

/** Directories and files inside ~/.kube that are never kubeconfigs */
const IGNORED_ENTRIES = new Set(['cache', 'http-cache', 'kubens', 'kubectx']);

/**
 * Parses and manages kubeconfig files
 */
export class KubeConfigParser {
  /**
   * Parse a kubeconfig file
   */
  async parseFile(filePath: string): Promise<KubeConfigFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    try {
      return this.parseContent(content);
    } catch (error: any) {
      throw new Error(`Failed to parse kubeconfig file '${filePath}': ${error.message}`);
    }
  }

  /**
   * Parse kubeconfig content. Missing lists are normalised to empty arrays.
   */
  parseContent(content: string): KubeConfigFile {
    const config = YAML.parse(content) as KubeConfigFile | null;

    if (!config || typeof config !== 'object' || config.kind !== 'Config') {
      throw new Error('Not a kubeconfig (kind must be "Config")');
    }

    config.clusters = config.clusters || [];
    config.users = config.users || [];
    config.contexts = config.contexts || [];

    return config;
  }

  /**
   * Find every valid kubeconfig in a directory (default: ~/.kube).
   * Files that are not kubeconfigs are skipped silently.
   */
  async discover(kubeDir: string = this.getKubeDir()): Promise<DiscoveredKubeConfig[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(kubeDir);
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }

    const found: DiscoveredKubeConfig[] = [];

    for (const entry of entries.sort()) {
      if (entry.startsWith('.') || IGNORED_ENTRIES.has(entry) || /\.(lock|tmp|bak)$/.test(entry)) {
        continue;
      }

      const filePath = path.join(kubeDir, entry);
      try {
        const stat = await fs.stat(filePath);
        // Kubeconfigs are small; anything big is not one
        if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;

        found.push({ path: filePath, config: await this.parseFile(filePath) });
      } catch {
        // Not a kubeconfig, ignore
      }
    }

    // The kubectl default file goes first even if it lives outside ~/.kube
    const defaultPath = this.getDefaultConfigPath();
    if (!found.some((f) => f.path === defaultPath) && path.dirname(defaultPath) !== kubeDir) {
      try {
        found.unshift({ path: defaultPath, config: await this.parseFile(defaultPath) });
      } catch {
        // Missing or invalid default config
      }
    }

    return found;
  }

  /**
   * @deprecated use discover()
   */
  async loadAllConfigs(kubeDir?: string): Promise<Map<string, KubeConfigFile>> {
    const found = await this.discover(kubeDir);
    return new Map(found.map((f) => [f.path, f.config]));
  }

  getKubeDir(): string {
    return path.join(os.homedir(), '.kube');
  }

  /**
   * The file kubectl writes to: first entry of KUBECONFIG, or ~/.kube/config
   */
  getDefaultConfigPath(): string {
    const envPath = process.env.KUBECONFIG;
    if (envPath) {
      const first = envPath.split(path.delimiter).find((p) => p.trim().length > 0);
      if (first) return first;
    }
    return path.join(this.getKubeDir(), 'config');
  }

  /**
   * Check if a kubeconfig file exists
   */
  async configExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write kubeconfig to file atomically, readable only by the owner
   */
  async writeConfig(filePath: string, config: KubeConfigFile | string): Promise<void> {
    const content = typeof config === 'string' ? config : YAML.stringify(config);
    await writeFileAtomic(filePath, content);
  }

  /**
   * Validate kubeconfig structure
   */
  validateConfig(config: KubeConfigFile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.apiVersion) {
      errors.push('Missing apiVersion');
    }

    if (config.kind !== 'Config') {
      errors.push('Invalid or missing kind (must be "Config")');
    }

    for (const [index, cluster] of (config.clusters || []).entries()) {
      if (!cluster.name) errors.push(`Cluster at index ${index} missing name`);
      if (!cluster.cluster?.server)
        errors.push(`Cluster '${cluster.name || index}' missing server`);
    }

    for (const [index, user] of (config.users || []).entries()) {
      if (!user.name) errors.push(`User at index ${index} missing name`);
    }

    for (const [index, context] of (config.contexts || []).entries()) {
      if (!context.name) errors.push(`Context at index ${index} missing name`);
      if (!context.context?.cluster) {
        errors.push(`Context '${context.name || index}' missing cluster reference`);
      }
      if (!context.context?.user) {
        errors.push(`Context '${context.name || index}' missing user reference`);
      }
    }

    const current = config['current-context'];
    if (current && !(config.contexts || []).some((ctx) => ctx.name === current)) {
      errors.push(`current-context '${current}' not found in contexts`);
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Write a file via temp file + rename so a crash never leaves a half-written kubeconfig
 */
export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, content, { encoding: 'utf-8', mode: 0o600 });
  try {
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }
}
