import * as k8s from '@kubernetes/client-node';
import { Context } from '../types';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

/**
 * An API error that keeps the HTTP status and the server's own message
 */
export class KubernetesApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'KubernetesApiError';
  }
}

function apiError(prefix: string, error: any): KubernetesApiError {
  const status = error?.response?.statusCode ?? error?.statusCode;
  const detail = error?.body?.message || error?.message || String(error);
  return new KubernetesApiError(`${prefix}: ${detail}`, status);
}

/**
 * Kubernetes client wrapper around @kubernetes/client-node
 */
export class KubernetesClient {
  private kc: k8s.KubeConfig;
  private kubeConfigPath: string;
  private contextName?: string;

  /**
   * @param kubeConfigPath kubeconfig file to load (default: ~/.kube/config)
   * @param contextName context to use instead of the file's current-context
   */
  constructor(kubeConfigPath?: string, contextName?: string) {
    this.kubeConfigPath = kubeConfigPath || path.join(os.homedir(), '.kube', 'config');
    this.contextName = contextName;
    this.kc = new k8s.KubeConfig();
  }

  /**
   * Create and initialize a client bound to a specific context
   */
  static async forContext(kubeConfigPath: string, contextName: string): Promise<KubernetesClient> {
    const client = new KubernetesClient(kubeConfigPath, contextName);
    await client.initialize();
    return client;
  }

  /**
   * Initialize the client by loading kubeconfig
   */
  async initialize(): Promise<void> {
    try {
      if (await this.fileExists(this.kubeConfigPath)) {
        this.kc.loadFromFile(this.kubeConfigPath);
      } else {
        this.kc.loadFromDefault();
      }
    } catch (error) {
      throw new Error(`Failed to load kubeconfig: ${error}`);
    }

    if (this.contextName) {
      this.kc.setCurrentContext(this.contextName);
    }
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
      throw apiError(`Failed to list pods in namespace '${namespace}'`, error);
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
      throw apiError(`Failed to list services in namespace '${namespace}'`, error);
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
      throw apiError('Failed to list namespaces', error);
    }
  }

  /**
   * Names of the secrets in a namespace. Values are dropped right here and never returned.
   */
  async listSecretNames(namespace: string): Promise<string[]> {
    try {
      const response = await this.getCoreV1Api().listNamespacedSecret(namespace);
      return response.body.items
        .filter((s) => s.type !== 'kubernetes.io/service-account-token')
        .map((s) => s.metadata?.name || '')
        .filter(Boolean)
        .sort();
    } catch (error) {
      throw apiError(`Failed to list secrets in namespace '${namespace}'`, error);
    }
  }

  /**
   * Names of the config maps in a namespace
   */
  async listConfigMapNames(namespace: string): Promise<string[]> {
    try {
      const response = await this.getCoreV1Api().listNamespacedConfigMap(namespace);
      return response.body.items
        .map((c) => c.metadata?.name || '')
        .filter((name) => name && name !== 'kube-root-ca.crt')
        .sort();
    } catch (error) {
      throw apiError(`Failed to list config maps in namespace '${namespace}'`, error);
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
      throw new Error(`Failed to get configmap '${name}' in namespace '${namespace}': ${error}`);
    }
  }

  /**
   * Check cluster connectivity
   */
  async checkConnection(timeoutMs = 5000): Promise<boolean> {
    try {
      // /version needs no RBAC permissions, unlike listing namespaces
      await withTimeout(this.getServerVersion(), timeoutMs);
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

/**
 * Reject if a promise does not settle in time
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
