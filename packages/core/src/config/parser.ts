import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

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
  user: {
    'client-certificate'?: string;
    'client-certificate-data'?: string;
    'client-key'?: string;
    'client-key-data'?: string;
    token?: string;
    username?: string;
    password?: string;
    'auth-provider'?: any;
    exec?: any;
  };
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
}

/**
 * Parses and manages kubeconfig files
 */
export class KubeConfigParser {
  /**
   * Parse a kubeconfig file
   */
  async parseFile(filePath: string): Promise<KubeConfigFile> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      throw new Error(`Failed to parse kubeconfig file '${filePath}': ${error}`);
    }
  }

  /**
   * Parse kubeconfig content
   */
  parseContent(content: string): KubeConfigFile {
    try {
      const config = yaml.load(content) as KubeConfigFile;

      // Validate basic structure
      if (!config.clusters || !config.users || !config.contexts) {
        throw new Error('Invalid kubeconfig structure: missing required fields');
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to parse kubeconfig content: ${error}`);
    }
  }

  /**
   * Load all kubeconfig files from .kube directory
   */
  async loadAllConfigs(): Promise<Map<string, KubeConfigFile>> {
    const kubeDir = path.join(os.homedir(), '.kube');
    const configs = new Map<string, KubeConfigFile>();

    try {
      const files = await fs.readdir(kubeDir);

      for (const file of files) {
        // Skip non-config files
        if (file.startsWith('.') || file.endsWith('.lock') || file.endsWith('.tmp')) {
          continue;
        }

        const filePath = path.join(kubeDir, file);

        try {
          const stat = await fs.stat(filePath);

          // Only process regular files
          if (!stat.isFile()) {
            continue;
          }

          const config = await this.parseFile(filePath);
          configs.set(file, config);
        } catch (error) {
          // Skip files that can't be parsed
          console.warn(`Skipping file '${file}': ${error}`);
        }
      }

      return configs;
    } catch (error) {
      throw new Error(`Failed to load kubeconfig files: ${error}`);
    }
  }

  /**
   * Get the default kubeconfig path
   */
  getDefaultConfigPath(): string {
    const envPath = process.env.KUBECONFIG;
    if (envPath) {
      // KUBECONFIG can contain multiple paths separated by ':'
      return envPath.split(':')[0];
    }
    return path.join(os.homedir(), '.kube', 'config');
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
   * Write kubeconfig to file
   */
  async writeConfig(filePath: string, config: KubeConfigFile): Promise<void> {
    try {
      const content = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write kubeconfig to '${filePath}': ${error}`);
    }
  }

  /**
   * Validate kubeconfig structure
   */
  validateConfig(config: KubeConfigFile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.apiVersion) {
      errors.push('Missing apiVersion');
    }

    if (!config.kind || config.kind !== 'Config') {
      errors.push('Invalid or missing kind (must be "Config")');
    }

    if (!Array.isArray(config.clusters)) {
      errors.push('clusters must be an array');
    }

    if (!Array.isArray(config.users)) {
      errors.push('users must be an array');
    }

    if (!Array.isArray(config.contexts)) {
      errors.push('contexts must be an array');
    }

    // Validate clusters
    config.clusters?.forEach((cluster, index) => {
      if (!cluster.name) {
        errors.push(`Cluster at index ${index} missing name`);
      }
      if (!cluster.cluster?.server) {
        errors.push(`Cluster '${cluster.name || index}' missing server`);
      }
    });

    // Validate users
    config.users?.forEach((user, index) => {
      if (!user.name) {
        errors.push(`User at index ${index} missing name`);
      }
    });

    // Validate contexts
    config.contexts?.forEach((context, index) => {
      if (!context.name) {
        errors.push(`Context at index ${index} missing name`);
      }
      if (!context.context?.cluster) {
        errors.push(`Context '${context.name || index}' missing cluster reference`);
      }
      if (!context.context?.user) {
        errors.push(`Context '${context.name || index}' missing user reference`);
      }
    });

    // Validate current-context reference
    if (config['current-context']) {
      const contextExists = config.contexts?.some(
        (ctx) => ctx.name === config['current-context']
      );
      if (!contextExists) {
        errors.push(`current-context '${config['current-context']}' not found in contexts`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
