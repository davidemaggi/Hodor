import * as k8s from '@kubernetes/client-node';
import { EventEmitter } from 'events';

export interface PortForwardOptions {
  namespace: string;
  podName?: string;
  serviceName?: string;
  deploymentName?: string;
  localPort: number;
  remotePort: number;
}

export interface PortForwardStatus {
  id: string;
  status: 'running' | 'stopped' | 'error';
  localPort: number;
  remotePort: number;
  error?: string;
}

/**
 * Manages Kubernetes port-forwarding operations
 */
export class PortForwardManager extends EventEmitter {
  private kc: k8s.KubeConfig;
  private activeForwards: Map<string, any> = new Map();

  constructor(kubeConfig: k8s.KubeConfig) {
    super();
    this.kc = kubeConfig;
  }

  /**
   * Start a port-forward to a pod
   */
  async startPortForward(id: string, options: PortForwardOptions): Promise<void> {
    if (this.activeForwards.has(id)) {
      throw new Error(`Port forward with id '${id}' is already running`);
    }

    try {
      const forward = new k8s.PortForward(this.kc);

      // Determine the target pod
      let podName = options.podName;

      if (!podName) {
        if (options.serviceName) {
          podName = await this.getPodFromService(options.namespace, options.serviceName);
        } else if (options.deploymentName) {
          podName = await this.getPodFromDeployment(options.namespace, options.deploymentName);
        } else {
          throw new Error('Must specify either podName, serviceName, or deploymentName');
        }
      }

      // Start the port forward
      const server = await forward.portForward(
        options.namespace,
        podName,
        [options.remotePort],
        undefined,
        undefined,
        options.localPort
      );

      this.activeForwards.set(id, {
        server,
        forward,
        options,
      });

      this.emit('started', id);
    } catch (error) {
      this.emit('error', id, error);
      throw error;
    }
  }

  /**
   * Stop a port-forward
   */
  async stopPortForward(id: string): Promise<void> {
    const forward = this.activeForwards.get(id);

    if (!forward) {
      throw new Error(`Port forward with id '${id}' not found`);
    }

    try {
      // Close the server
      if (forward.server && forward.server.close) {
        forward.server.close();
      }

      this.activeForwards.delete(id);
      this.emit('stopped', id);
    } catch (error) {
      this.emit('error', id, error);
      throw error;
    }
  }

  /**
   * Stop all active port-forwards
   */
  async stopAllPortForwards(): Promise<void> {
    const ids = Array.from(this.activeForwards.keys());

    for (const id of ids) {
      try {
        await this.stopPortForward(id);
      } catch (error) {
        console.error(`Failed to stop port forward '${id}':`, error);
      }
    }
  }

  /**
   * Get status of a port-forward
   */
  getStatus(id: string): PortForwardStatus | null {
    const forward = this.activeForwards.get(id);

    if (!forward) {
      return null;
    }

    return {
      id,
      status: 'running',
      localPort: forward.options.localPort,
      remotePort: forward.options.remotePort,
    };
  }

  /**
   * Get all active port-forwards
   */
  getActiveForwards(): string[] {
    return Array.from(this.activeForwards.keys());
  }

  /**
   * Check if a port-forward is active
   */
  isActive(id: string): boolean {
    return this.activeForwards.has(id);
  }

  /**
   * Get pod name from service
   */
  private async getPodFromService(namespace: string, serviceName: string): Promise<string> {
    const api = this.kc.makeApiClient(k8s.CoreV1Api);

    try {
      // Get the service
      const serviceResponse = await api.readNamespacedService(serviceName, namespace);
      const service = serviceResponse.body;

      if (!service.spec?.selector) {
        throw new Error(`Service '${serviceName}' has no selector`);
      }

      // Find pods matching the service selector
      const selector = Object.entries(service.spec.selector)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');

      const podsResponse = await api.listNamespacedPod(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        selector
      );

      if (!podsResponse.body.items.length) {
        throw new Error(`No pods found for service '${serviceName}'`);
      }

      // Return the first running pod
      const runningPod = podsResponse.body.items.find(
        (pod) => pod.status?.phase === 'Running'
      );

      if (!runningPod || !runningPod.metadata?.name) {
        throw new Error(`No running pods found for service '${serviceName}'`);
      }

      return runningPod.metadata.name;
    } catch (error) {
      throw new Error(`Failed to get pod from service '${serviceName}': ${error}`);
    }
  }

  /**
   * Get pod name from deployment
   */
  private async getPodFromDeployment(
    namespace: string,
    deploymentName: string
  ): Promise<string> {
    const appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    const coreApi = this.kc.makeApiClient(k8s.CoreV1Api);

    try {
      // Get the deployment
      const deploymentResponse = await appsApi.readNamespacedDeployment(
        deploymentName,
        namespace
      );
      const deployment = deploymentResponse.body;

      if (!deployment.spec?.selector?.matchLabels) {
        throw new Error(`Deployment '${deploymentName}' has no selector`);
      }

      // Find pods matching the deployment selector
      const selector = Object.entries(deployment.spec.selector.matchLabels)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');

      const podsResponse = await coreApi.listNamespacedPod(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        selector
      );

      if (!podsResponse.body.items.length) {
        throw new Error(`No pods found for deployment '${deploymentName}'`);
      }

      // Return the first running pod
      const runningPod = podsResponse.body.items.find(
        (pod) => pod.status?.phase === 'Running'
      );

      if (!runningPod || !runningPod.metadata?.name) {
        throw new Error(`No running pods found for deployment '${deploymentName}'`);
      }

      return runningPod.metadata.name;
    } catch (error) {
      throw new Error(`Failed to get pod from deployment '${deploymentName}': ${error}`);
    }
  }
}
