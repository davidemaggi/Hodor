import * as k8s from '@kubernetes/client-node';
import { Cluster, Context, KubeConfig as HodorKubeConfig } from '../types';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

/**
 * Kubernetes client wrapper
 * Handles SDK integration with kubectl binary fallback
 */
export class KubernetesClient {
  private kc: k8s.KubeConfig;
  private kubeConfigPath: string;

  constructor(kubeConfigPath?: string) {
    this.kubeConfigPath = kubeConfigPath || path.join(os.homedir(), '.kube', 'config');
    this.kc = new k8s.KubeConfig();
  }

  /**
   * Initialize the client by loading kubeconfig
   */
  async initialize(): Promise<void> {
    try {
      // Try loading from default location or specified path
      if (await this.fileExists(this.kubeConfigPath)) {
        this.kc.loadFromFile(this.kubeConfigPath);
      } else {
        // Try loading from default location
        this.kc.loadFromDefault();
      }
    } catch (error) {
      throw new Error(`Failed to load kubeconfig: ${error}`);
    }
  }

  /**
   * Get all clusters from kubeconfig
   */
  async getClusters(): Promise<Cluster[]> {
    const clusters: Cluster[] = [];
    const currentContext = this.kc.getCurrentContext();

    for (const cluster of this.kc.getClusters()) {
      const context = this.kc.getContexts().find((ctx) => ctx.cluster === cluster.name);

      clusters.push({
        name: cluster.name,
        server: cluster.server,
        context: context?.name || '',
        namespace: context?.namespace,
        isActive: context?.name === currentContext,
        isDefault: context?.name === currentContext,
      });
    }

    return clusters;
  }

  /**
   * Get all contexts from kubeconfig
   */
  getContexts(): Context[] {
    return this.kc.getContexts().map((ctx) => ({
      name: ctx.name,
      cluster: ctx.cluster,
      user: ctx.user,
      namespace: ctx.namespace,
    }));
  }

  /**
   * Get current context name
   */
  getCurrentContext(): string {
    return this.kc.getCurrentContext();
  }

  /**
   * Switch to a different context
   */
  async setCurrentContext(contextName: string): Promise<void> {
    const contexts = this.kc.getContexts();
    const context = contexts.find((ctx) => ctx.name === contextName);

    if (!context) {
      throw new Error(`Context '${contextName}' not found`);
    }

    this.kc.setCurrentContext(contextName);
  }

  /**
   * Get API client for core resources
   */
  getCoreV1Api(): k8s.CoreV1Api {
    return this.kc.makeApiClient(k8s.CoreV1Api);
  }

  /**
   * Get API client for apps resources
   */
  getAppsV1Api(): k8s.AppsV1Api {
    return this.kc.makeApiClient(k8s.AppsV1Api);
  }

  /**
   * Get the underlying KubeConfig object
   */
  getKubeConfig(): k8s.KubeConfig {
    return this.kc;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all pods in a namespace
   */
  async listPods(namespace: string): Promise<k8s.V1Pod[]> {
    const api = this.getCoreV1Api();
    try {
      const response = await api.listNamespacedPod(namespace);
      return response.body.items;
    } catch (error) {
      throw new Error(`Failed to list pods in namespace '${namespace}': ${error}`);
    }
  }

  /**
   * List all services in a namespace
   */
  async listServices(namespace: string): Promise<k8s.V1Service[]> {
    const api = this.getCoreV1Api();
    try {
      const response = await api.listNamespacedService(namespace);
      return response.body.items;
    } catch (error) {
      throw new Error(`Failed to list services in namespace '${namespace}': ${error}`);
    }
  }

  /**
   * List all namespaces
   */
  async listNamespaces(): Promise<k8s.V1Namespace[]> {
    const api = this.getCoreV1Api();
    try {
      const response = await api.listNamespace();
      return response.body.items;
    } catch (error) {
      throw new Error(`Failed to list namespaces: ${error}`);
    }
  }

  /**
   * Get a secret by name
   */
  async getSecret(name: string, namespace: string): Promise<k8s.V1Secret | null> {
    const api = this.getCoreV1Api();
    try {
      const response = await api.readNamespacedSecret(name, namespace);
      return response.body;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      throw new Error(`Failed to get secret '${name}' in namespace '${namespace}': ${error}`);
    }
  }

  /**
   * Get a configmap by name
   */
  async getConfigMap(name: string, namespace: string): Promise<k8s.V1ConfigMap | null> {
    const api = this.getCoreV1Api();
    try {
      const response = await api.readNamespacedConfigMap(name, namespace);
      return response.body;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      throw new Error(
        `Failed to get configmap '${name}' in namespace '${namespace}': ${error}`
      );
    }
  }

  /**
   * Check cluster connectivity
   */
  async checkConnection(): Promise<boolean> {
    try {
      const api = this.getCoreV1Api();
      await api.listNamespace();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Kubernetes server version
   */
  async getServerVersion(): Promise<{ major: string; minor: string; gitVersion: string }> {
    const api = this.kc.makeApiClient(k8s.VersionApi);
    try {
      const response = await api.getCode();
      return {
        major: response.body.major || '',
        minor: response.body.minor || '',
        gitVersion: response.body.gitVersion || '',
      };
    } catch (error) {
      throw new Error(`Failed to get server version: ${error}`);
    }
  }
}
