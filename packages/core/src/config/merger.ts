import { KubeConfigFile, KubeConfigParser } from './parser';

/**
 * Merges multiple kubeconfig files into one
 */
export class KubeConfigMerger {
  private parser: KubeConfigParser;

  constructor() {
    this.parser = new KubeConfigParser();
  }

  /**
   * Merge multiple kubeconfig files
   */
  merge(configs: KubeConfigFile[]): KubeConfigFile {
    if (configs.length === 0) {
      throw new Error('No configs to merge');
    }

    if (configs.length === 1) {
      return configs[0];
    }

    const merged: KubeConfigFile = {
      apiVersion: 'v1',
      kind: 'Config',
      clusters: [],
      users: [],
      contexts: [],
      'current-context': configs[0]['current-context'],
    };

    const clusterNames = new Set<string>();
    const userNames = new Set<string>();
    const contextNames = new Set<string>();

    for (const config of configs) {
      // Merge clusters
      for (const cluster of config.clusters || []) {
        if (!clusterNames.has(cluster.name)) {
          merged.clusters.push(cluster);
          clusterNames.add(cluster.name);
        } else {
          console.warn(`Duplicate cluster name '${cluster.name}' found, skipping`);
        }
      }

      // Merge users
      for (const user of config.users || []) {
        if (!userNames.has(user.name)) {
          merged.users.push(user);
          userNames.add(user.name);
        } else {
          console.warn(`Duplicate user name '${user.name}' found, skipping`);
        }
      }

      // Merge contexts
      for (const context of config.contexts || []) {
        if (!contextNames.has(context.name)) {
          merged.contexts.push(context);
          contextNames.add(context.name);
        } else {
          console.warn(`Duplicate context name '${context.name}' found, skipping`);
        }
      }

      // Keep the first non-empty current-context
      if (!merged['current-context'] && config['current-context']) {
        merged['current-context'] = config['current-context'];
      }
    }

    return merged;
  }

  /**
   * Merge kubeconfig files by paths
   */
  async mergeFiles(filePaths: string[]): Promise<KubeConfigFile> {
    const configs: KubeConfigFile[] = [];

    for (const filePath of filePaths) {
      try {
        const config = await this.parser.parseFile(filePath);
        configs.push(config);
      } catch (error) {
        throw new Error(`Failed to load config from '${filePath}': ${error}`);
      }
    }

    return this.merge(configs);
  }

  /**
   * Merge a new config into an existing one
   */
  mergeInto(target: KubeConfigFile, source: KubeConfigFile): KubeConfigFile {
    return this.merge([target, source]);
  }

  /**
   * Remove duplicates from a config
   */
  deduplicate(config: KubeConfigFile): KubeConfigFile {
    const deduped: KubeConfigFile = {
      ...config,
      clusters: [],
      users: [],
      contexts: [],
    };

    const clusterNames = new Set<string>();
    const userNames = new Set<string>();
    const contextNames = new Set<string>();

    // Deduplicate clusters
    for (const cluster of config.clusters || []) {
      if (!clusterNames.has(cluster.name)) {
        deduped.clusters.push(cluster);
        clusterNames.add(cluster.name);
      }
    }

    // Deduplicate users
    for (const user of config.users || []) {
      if (!userNames.has(user.name)) {
        deduped.users.push(user);
        userNames.add(user.name);
      }
    }

    // Deduplicate contexts
    for (const context of config.contexts || []) {
      if (!contextNames.has(context.name)) {
        deduped.contexts.push(context);
        contextNames.add(context.name);
      }
    }

    return deduped;
  }
}
