import * as k8s from '@kubernetes/client-node';
import { EventEmitter } from 'events';
import { LogCapture } from './log-capture';

export interface PortForwardOptions {
  namespace: string;
  podName?: string;
  serviceName?: string;
  deploymentName?: string;
  localPort: number;
  remotePort: number;
  autoRestart?: boolean;
  maxRestartAttempts?: number;
}

export interface PortForwardStatus {
  id: string;
  status: 'running' | 'stopped' | 'error' | 'restarting';
  localPort: number;
  remotePort: number;
  error?: string;
  restartAttempts?: number;
}

interface ActiveForward {
  server: any;
  forward: k8s.PortForward;
  options: PortForwardOptions;
  restartAttempts: number;
  restartTimer?: NodeJS.Timeout;
}

/**
 * Manages Kubernetes port-forwarding operations
 */
export class PortForwardManager extends EventEmitter {
  private kc: k8s.KubeConfig;
  private activeForwards: Map<string, ActiveForward> = new Map();
  private logCapture: LogCapture;

  constructor(kubeConfig: k8s.KubeConfig, logCapture?: LogCapture) {
    super();
    this.kc = kubeConfig;
    this.logCapture = logCapture || new LogCapture();
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
        restartAttempts: 0,
      });

      this.logCapture.log(id, 'info', `Port-forward started: ${options.localPort} -> ${options.remotePort}`);
      this.emit('started', id);

      // Setup error handling for auto-restart
      if (server && options.autoRestart) {
        server.on('error', (error: Error) => {
          this.handleForwardError(id, error);
        });

        server.on('close', () => {
          this.handleForwardClose(id);
        });
      }
    } catch (error) {
      this.logCapture.log(id, 'error', `Failed to start port-forward: ${error}`);
      this.emit('error', id, error);
      throw error;
    }
  }

  /**
   * Handle port-forward error
   */
  private async handleForwardError(id: string, error: Error): Promise<void> {
    const forward = this.activeForwards.get(id);
    if (!forward) return;

    this.logCapture.log(id, 'error', `Port-forward error: ${error.message}`);
    this.emit('error', id, error);

    // Attempt restart if enabled
    if (forward.options.autoRestart) {
      await this.attemptRestart(id);
    }
  }

  /**
   * Handle port-forward close
   */
  private async handleForwardClose(id: string): Promise<void> {
    const forward = this.activeForwards.get(id);
    if (!forward) return;

    this.logCapture.log(id, 'warn', 'Port-forward connection closed');
    this.emit('closed', id);

    // Attempt restart if enabled and not manually stopped
    if (forward.options.autoRestart) {
      await this.attemptRestart(id);
    }
  }

  /**
   * Attempt to restart a port-forward
   */
  private async attemptRestart(id: string): Promise<void> {
    const forward = this.activeForwards.get(id);
    if (!forward) return;

    const maxAttempts = forward.options.maxRestartAttempts || 3;

    if (forward.restartAttempts >= maxAttempts) {
      this.logCapture.log(
        id,
        'error',
        `Max restart attempts (${maxAttempts}) reached, giving up`
      );
      this.emit('restart-failed', id);
      return;
    }

    forward.restartAttempts++;
    const delay = Math.min(1000 * Math.pow(2, forward.restartAttempts - 1), 30000); // Exponential backoff, max 30s

    this.logCapture.log(
      id,
      'info',
      `Attempting restart ${forward.restartAttempts}/${maxAttempts} in ${delay}ms`
    );
    this.emit('restarting', id, forward.restartAttempts, maxAttempts);

    forward.restartTimer = setTimeout(async () => {
      try {
        // Clean up old forward
        if (forward.server && forward.server.close) {
          forward.server.close();
        }

        // Start new forward
        const newForward = new k8s.PortForward(this.kc);
        let podName = forward.options.podName;

        if (!podName) {
          if (forward.options.serviceName) {
            podName = await this.getPodFromService(
              forward.options.namespace,
              forward.options.serviceName
            );
          } else if (forward.options.deploymentName) {
            podName = await this.getPodFromDeployment(
              forward.options.namespace,
              forward.options.deploymentName
            );
          }
        }

        if (!podName) {
          throw new Error('Unable to determine pod name for restart');
        }

        const server = await newForward.portForward(
          forward.options.namespace,
          podName,
          [forward.options.remotePort],
          undefined,
          undefined,
          forward.options.localPort
        );

        // Update the forward
        forward.server = server;
        forward.forward = newForward;

        // Setup error handlers again
        if (server && forward.options.autoRestart) {
          server.on('error', (error: Error) => {
            this.handleForwardError(id, error);
          });

          server.on('close', () => {
            this.handleForwardClose(id);
          });
        }

        this.logCapture.log(id, 'info', 'Port-forward restarted successfully');
        this.emit('restarted', id);
      } catch (error) {
        this.logCapture.log(id, 'error', `Restart failed: ${error}`);
        // Try again if attempts remain
        await this.attemptRestart(id);
      }
    }, delay);
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
      // Clear any pending restart timer
      if (forward.restartTimer) {
        clearTimeout(forward.restartTimer);
      }

      // Close the server
      if (forward.server && forward.server.close) {
        forward.server.close();
      }

      this.activeForwards.delete(id);
      this.logCapture.log(id, 'info', 'Port-forward stopped');
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

    let status: PortForwardStatus['status'] = 'running';

    if (forward.restartTimer) {
      status = 'restarting';
    }

    return {
      id,
      status,
      localPort: forward.options.localPort,
      remotePort: forward.options.remotePort,
      restartAttempts: forward.restartAttempts,
    };
  }

  /**
   * Get logs for a port-forward
   */
  getLogs(id: string) {
    return this.logCapture.getLogs(id);
  }

  /**
   * Get the log capture instance
   */
  getLogCapture(): LogCapture {
    return this.logCapture;
  }

  /**
   * Clear logs for a port-forward
   */
  clearLogs(id: string): void {
    this.logCapture.clearLogs(id);
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
