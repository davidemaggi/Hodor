import { KubeConfigFile, KubeConfigParser } from './parser';

export interface MergeResult {
  config: KubeConfigFile;
  /** Entries skipped because an entry with the same name was already present */
  skipped: Array<{ kind: 'cluster' | 'user' | 'context'; name: string; source: number }>;
}

/**
 * Merges multiple kubeconfig files into one. The first config wins on name conflicts,
 * matching kubectl's KUBECONFIG merge rules.
 */
export class KubeConfigMerger {
  private parser: KubeConfigParser;

  constructor() {
    this.parser = new KubeConfigParser();
  }

  /**
   * Merge configs and report what was skipped
   */
  mergeWithReport(configs: KubeConfigFile[]): MergeResult {
    if (configs.length === 0) {
      throw new Error('No configs to merge');
    }

    const merged: KubeConfigFile = {
      apiVersion: 'v1',
      kind: 'Config',
      preferences: configs[0].preferences ?? {},
      clusters: [],
      users: [],
      contexts: [],
    };
    const skipped: MergeResult['skipped'] = [];

    const add = <T extends { name: string }>(
      kind: 'cluster' | 'user' | 'context',
      target: T[],
      items: T[] | undefined,
      source: number
    ) => {
      for (const item of items || []) {
        if (target.some((existing) => existing.name === item.name)) {
          skipped.push({ kind, name: item.name, source });
        } else {
          target.push(item);
        }
      }
    };

    configs.forEach((config, source) => {
      add('cluster', merged.clusters, config.clusters, source);
      add('user', merged.users, config.users, source);
      add('context', merged.contexts, config.contexts, source);
    });

    const current = configs.map((c) => c['current-context']).find((c) => !!c);
    if (current) {
      merged['current-context'] = current;
    }

    return { config: merged, skipped };
  }

  /**
   * Merge multiple kubeconfigs
   */
  merge(configs: KubeConfigFile[]): KubeConfigFile {
    return this.mergeWithReport(configs).config;
  }

  /**
   * Merge kubeconfig files by paths
   */
  async mergeFiles(filePaths: string[]): Promise<MergeResult> {
    const configs: KubeConfigFile[] = [];
    for (const filePath of filePaths) {
      configs.push(await this.parser.parseFile(filePath));
    }
    return this.mergeWithReport(configs);
  }

  /**
   * Merge a new config into an existing one
   */
  mergeInto(target: KubeConfigFile, source: KubeConfigFile): MergeResult {
    return this.mergeWithReport([target, source]);
  }
}
