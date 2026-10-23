import * as path from 'path';
import { Cluster, ClusterHealth } from '../types';
import { KubeConfigParser } from '../config/parser';
import { KubernetesClient, withTimeout } from './client';

const ID_SEPARATOR = '::';

export function clusterId(sourceFile: string, contextName: string): string {
  return `${path.resolve(sourceFile)}${ID_SEPARATOR}${contextName}`;
}

/**
 * Finds every context across all kubeconfigs in ~/.kube
 */
export class ClusterDiscovery {
  private parser = new KubeConfigParser();

  constructor(private kubeDir?: string) {}

  async list(): Promise<Cluster[]> {
    const configs = await this.parser.discover(this.kubeDir);
    const defaultPath = path.resolve(this.parser.getDefaultConfigPath());
    const clusters: Cluster[] = [];

    for (const { path: file, config } of configs) {
      const isDefaultFile = path.resolve(file) === defaultPath;

      for (const ctx of config.contexts) {
        const cluster = config.clusters.find((c) => c.name === ctx.context?.cluster);
        if (!cluster) continue;

        clusters.push({
          id: clusterId(file, ctx.name),
          name: ctx.name,
          cluster: cluster.name,
          server: cluster.cluster.server,
          user: ctx.context.user,
          sourceFile: file,
          namespace: ctx.context.namespace,
          isDefault: isDefaultFile && config['current-context'] === ctx.name,
        });
      }
    }

    return clusters;
  }

  /**
   * Find a cluster by id, or by context name when unambiguous
   */
  async find(idOrName: string): Promise<Cluster | undefined> {
    const clusters = await this.list();
    const byId = clusters.find((c) => c.id === idOrName);
    if (byId) return byId;

    const byName = clusters.filter((c) => c.name === idOrName);
    if (byName.length > 1) {
      throw new Error(
        `Context '${idOrName}' exists in several kubeconfigs: ${byName.map((c) => c.sourceFile).join(', ')}`
      );
    }
    return byName[0];
  }

  /**
   * Check whether a cluster answers within the timeout
   */
  async checkHealth(cluster: Cluster, timeoutMs = 4000): Promise<ClusterHealth> {
    try {
      const client = await KubernetesClient.forContext(cluster.sourceFile, cluster.name);
      const version = await withTimeout(client.getServerVersion(), timeoutMs);
      return { reachable: true, version: version.gitVersion };
    } catch (error: any) {
      return { reachable: false, error: String(error?.message || error) };
    }
  }

  connect(cluster: Cluster): Promise<KubernetesClient> {
    return KubernetesClient.forContext(cluster.sourceFile, cluster.name);
  }
}
