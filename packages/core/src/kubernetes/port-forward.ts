import * as k8s from '@kubernetes/client-node';
import * as net from 'net';
import { EventEmitter } from 'events';
import { LogCapture } from './log-capture';

export interface PortForwardOptions {
  namespace: string;
  podName?: string;
  serviceName?: string;
  deploymentName?: string;
  localPort: number;
  /** For services this is the service port; it is translated to the pod's targetPort. */
  remotePort: number;
  /** Re-resolve the target pod when a connection fails (pod restarted/rescheduled). */
  autoRestart?: boolean;
  /** Local address to bind. Defaults to 127.0.0.1 so forwards are never exposed on the LAN. */
  bindAddress?: string;
}

export interface PortForwardStatus {
  id: string;
  status: 'running' | 'stopped' | 'error';
  localPort: number;
  remotePort: number;
  podName?: string;
  activeConnections: number;
  error?: string;
}

interface ResolvedTarget {
  podName: string;
  podPort: number;
}

interface ActiveForward {
  server: net.Server;
  sockets: Set<net.Socket>;
  options: PortForwardOptions;
  target?: ResolvedTarget;
  lastError?: string;
}

/**
 * Manages Kubernetes port-forwarding operations.
 *
 * Each forward opens a local TCP listener; every incoming connection gets its own
 * stream to the target pod through the Kubernetes API (same model as kubectl).
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
   * Start a port-forward. Resolves once the local port is listening.
   */
  async startPortForward(id: string, options: PortForwardOptions): Promise<void> {
    if (this.activeForwards.has(id)) {
      throw new Error(`Port forward with id '${id}' is already running`);
    }

    if (!options.podName && !options.serviceName && !options.deploymentName) {
      throw new Error('Must specify either podName, serviceName, or deploymentName');
    }

    try {
      // Resolve upfront so configuration errors surface immediately
      const target = await this.resolveTarget(options);

      const server = net.createServer((socket) => this.handleConnection(id, socket));
      const forward: ActiveForward = { server, sockets: new Set(), options, target };

      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.localPort, options.bindAddress || '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });

      server.on('error', (error) => {
        forward.lastError = error.message;
        this.logCapture.log(id, 'error', `Listener error: ${error.message}`);
        this.emit('error', id, error);
      });

      this.activeForwards.set(id, forward);
      this.logCapture.log(
        id,
        'info',
        `Forwarding 127.0.0.1:${options.localPort} -> ${target.podName}:${target.podPort}`
      );
      this.emit('started', id);
    } catch (error: any) {
      const message =
        error?.code === 'EADDRINUSE' ? `Local port ${options.localPort} is already in use` : String(error?.message || error);
      this.logCapture.log(id, 'error', `Failed to start port-forward: ${message}`);
      this.emit('error', id, new Error(message));
      throw new Error(message);
    }
  }

  /**
   * Handle a single local TCP connection by opening a stream to the pod
   */
  private async handleConnection(id: string, socket: net.Socket): Promise<void> {
    const forward = this.activeForwards.get(id);
    if (!forward) {
      socket.destroy();
      return;
    }

    forward.sockets.add(socket);
    socket.on('close', () => forward.sockets.delete(socket));
    socket.on('error', (error) => {
      this.logCapture.log(id, 'debug', `Local socket error: ${error.message}`);
    });

    try {
      if (!forward.target) {
        forward.target = await this.resolveTarget(forward.options);
        this.logCapture.log(id, 'info', `Target resolved to pod ${forward.target.podName}`);
      }

      const { podName, podPort } = forward.target;
      const pf = new k8s.PortForward(this.kc);
      const ws = await pf.portForward(forward.options.namespace, podName, [podPort], socket, null, socket);

      // Without retryCount the SDK returns the WebSocket itself
      if (typeof ws !== 'function') {
        ws.on('error', (error: Error) => this.handleStreamFailure(id, socket, error));
        ws.on('close', () => socket.destroy());
        socket.on('close', () => ws.close());
      }

      this.logCapture.log(id, 'debug', 'Connection opened');
      forward.lastError = undefined;
    } catch (error: any) {
      this.handleStreamFailure(id, socket, error);
    }
  }

  private handleStreamFailure(id: string, socket: net.Socket, error: any): void {
    const forward = this.activeForwards.get(id);
    const message = String(error?.message || error);

    socket.destroy();
    if (!forward) return;

    forward.lastError = message;
    this.logCapture.log(id, 'error', `Connection failed: ${message}`);
    this.emit('error', id, new Error(message));

    // Drop the cached pod so the next connection picks a healthy one
    if (forward.options.autoRestart !== false && !forward.options.podName) {
      forward.target = undefined;
      this.logCapture.log(id, 'warn', 'Target pod will be re-resolved on next connection');
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

    this.activeForwards.delete(id);

    for (const socket of forward.sockets) {
      socket.destroy();
    }

    await new Promise<void>((resolve) => forward.server.close(() => resolve()));

    this.logCapture.log(id, 'info', 'Port-forward stopped');
    this.emit('stopped', id);
  }

  /**
   * Stop all active port-forwards
   */
  async stopAllPortForwards(): Promise<void> {
    const ids = Array.from(this.activeForwards.keys());
    await Promise.allSettled(ids.map((id) => this.stopPortForward(id)));
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
      status: forward.lastError ? 'error' : 'running',
      localPort: forward.options.localPort,
      remotePort: forward.options.remotePort,
      podName: forward.target?.podName,
      activeConnections: forward.sockets.size,
      error: forward.lastError,
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
   * Resolve the pod and container port to forward to
   */
  private async resolveTarget(options: PortForwardOptions): Promise<ResolvedTarget> {
    const api = this.kc.makeApiClient(k8s.CoreV1Api);
    const { namespace } = options;

    if (options.podName) {
      return { podName: options.podName, podPort: options.remotePort };
    }

    if (options.deploymentName) {
      const appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
      const { body: deployment } = await appsApi.readNamespacedDeployment(options.deploymentName, namespace);
      const labels = deployment.spec?.selector?.matchLabels;
      if (!labels) {
        throw new Error(`Deployment '${options.deploymentName}' has no matchLabels selector`);
      }
      const pod = await this.findRunningPod(api, namespace, labels, `deployment '${options.deploymentName}'`);
      return { podName: pod.metadata!.name!, podPort: options.remotePort };
    }

    const serviceName = options.serviceName!;
    const { body: service } = await api.readNamespacedService(serviceName, namespace);
    if (!service.spec?.selector) {
      throw new Error(`Service '${serviceName}' has no selector`);
    }

    const pod = await this.findRunningPod(api, namespace, service.spec.selector, `service '${serviceName}'`);
    return { podName: pod.metadata!.name!, podPort: this.resolveServiceTargetPort(service, pod, options.remotePort) };
  }

  /**
   * Translate a service port into the container port, like kubectl does
   */
  private resolveServiceTargetPort(service: k8s.V1Service, pod: k8s.V1Pod, servicePort: number): number {
    const portSpec = service.spec?.ports?.find((p) => p.port === servicePort);
    if (!portSpec || portSpec.targetPort === undefined) {
      return servicePort;
    }

    if (typeof portSpec.targetPort === 'number') {
      return portSpec.targetPort;
    }

    const asNumber = Number(portSpec.targetPort);
    if (Number.isInteger(asNumber)) {
      return asNumber;
    }

    // Named target port: look it up in the pod's containers
    for (const container of pod.spec?.containers || []) {
      const named = container.ports?.find((p) => p.name === portSpec.targetPort);
      if (named) {
        return named.containerPort;
      }
    }

    throw new Error(`Named port '${portSpec.targetPort}' not found in pod ${pod.metadata?.name}`);
  }

  private async findRunningPod(
    api: k8s.CoreV1Api,
    namespace: string,
    labels: Record<string, string>,
    owner: string
  ): Promise<k8s.V1Pod> {
    const selector = Object.entries(labels)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    const { body } = await api.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, selector);
    const pod = body.items.find((p) => p.status?.phase === 'Running' && !p.metadata?.deletionTimestamp);

    if (!pod?.metadata?.name) {
      throw new Error(`No running pods found for ${owner}`);
    }

    return pod;
  }
}
