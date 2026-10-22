import { Template, TemplateExecution, PortForward } from '../types';
import { PortForwardManager, PortForwardOptions } from '../kubernetes/port-forward';
import { KubernetesClient } from '../kubernetes/client';
import { LogCapture } from '../kubernetes/log-capture';
import { EventEmitter } from 'events';

/**
 * Executes templates and manages their lifecycle
 */
export class TemplateExecutor extends EventEmitter {
  private client: KubernetesClient;
  private pfManager: PortForwardManager;
  private executions: Map<string, TemplateExecution> = new Map();
  private logCapture: LogCapture;

  constructor(client: KubernetesClient, logCapture?: LogCapture) {
    super();
    this.client = client;
    this.logCapture = logCapture || new LogCapture();
    this.pfManager = new PortForwardManager(client.getKubeConfig(), this.logCapture);

    // Forward port-forward events
    this.pfManager.on('started', (id) => this.emit('forward-started', id));
    this.pfManager.on('stopped', (id) => this.emit('forward-stopped', id));
    this.pfManager.on('error', (id, error) => this.emit('forward-error', id, error));
    this.pfManager.on('restarting', (id, attempt, max) =>
      this.emit('forward-restarting', id, attempt, max)
    );
    this.pfManager.on('restarted', (id) => this.emit('forward-restarted', id));
    this.pfManager.on('restart-failed', (id) => this.emit('forward-restart-failed', id));
  }

  /**
   * Execute a template
   */
  async execute(template: Template, clusterId: string): Promise<TemplateExecution> {
    if (this.executions.has(template.id)) {
      throw new Error(`Template '${template.name}' is already running`);
    }

    const execution: TemplateExecution = {
      templateId: template.id,
      clusterId,
      forwards: [],
      status: 'stopped',
      startedAt: new Date(),
    };

    this.executions.set(template.id, execution);

    try {
      // Start all port-forwards
      for (const forwardConfig of template.forwards) {
        const forwardId = `${template.id}-${forwardConfig.name}`;

        const options: PortForwardOptions = {
          namespace: forwardConfig.namespace,
          localPort: forwardConfig.localPort,
          remotePort: forwardConfig.remotePort,
          autoRestart: true,
          maxRestartAttempts: 3,
        };

        // Determine the resource type
        if (forwardConfig.resourceType === 'pod') {
          options.podName = forwardConfig.resourceName;
        } else if (forwardConfig.resourceType === 'service') {
          options.serviceName = forwardConfig.resourceName;
        } else if (forwardConfig.resourceType === 'deployment') {
          options.deploymentName = forwardConfig.resourceName;
        }

        try {
          await this.pfManager.startPortForward(forwardId, options);

          const forward: PortForward = {
            id: forwardId,
            name: forwardConfig.name,
            namespace: forwardConfig.namespace,
            resourceType: forwardConfig.resourceType,
            resourceName: forwardConfig.resourceName,
            localPort: forwardConfig.localPort,
            remotePort: forwardConfig.remotePort,
            status: 'running',
          };

          execution.forwards.push(forward);
        } catch (error) {
          const forward: PortForward = {
            id: forwardId,
            name: forwardConfig.name,
            namespace: forwardConfig.namespace,
            resourceType: forwardConfig.resourceType,
            resourceName: forwardConfig.resourceName,
            localPort: forwardConfig.localPort,
            remotePort: forwardConfig.remotePort,
            status: 'error',
            error: String(error),
          };

          execution.forwards.push(forward);
        }
      }

      // Determine overall status
      const hasRunning = execution.forwards.some((f) => f.status === 'running');
      const hasError = execution.forwards.some((f) => f.status === 'error');

      if (hasRunning && hasError) {
        execution.status = 'partial';
      } else if (hasRunning) {
        execution.status = 'running';
      } else {
        execution.status = 'stopped';
      }

      this.emit('template-started', template.id);

      return execution;
    } catch (error) {
      this.executions.delete(template.id);
      throw error;
    }
  }

  /**
   * Stop a template execution
   */
  async stop(templateId: string): Promise<void> {
    const execution = this.executions.get(templateId);
    if (!execution) {
      throw new Error(`No execution found for template '${templateId}'`);
    }

    // Stop all forwards
    for (const forward of execution.forwards) {
      if (forward.status === 'running') {
        try {
          await this.pfManager.stopPortForward(forward.id);
        } catch (error) {
          console.error(`Failed to stop forward '${forward.name}':`, error);
        }
      }
    }

    this.executions.delete(templateId);
    this.emit('template-stopped', templateId);
  }

  /**
   * Stop a single forward within a template
   */
  async stopForward(templateId: string, forwardName: string): Promise<void> {
    const execution = this.executions.get(templateId);
    if (!execution) {
      throw new Error(`No execution found for template '${templateId}'`);
    }

    const forward = execution.forwards.find((f) => f.name === forwardName);
    if (!forward) {
      throw new Error(`Forward '${forwardName}' not found in template`);
    }

    if (forward.status === 'running') {
      await this.pfManager.stopPortForward(forward.id);
      forward.status = 'stopped';
    }

    // Update execution status
    this.updateExecutionStatus(execution);
  }

  /**
   * Start a single forward within a template
   */
  async startForward(templateId: string, forwardName: string): Promise<void> {
    const execution = this.executions.get(templateId);
    if (!execution) {
      throw new Error(`No execution found for template '${templateId}'`);
    }

    const forward = execution.forwards.find((f) => f.name === forwardName);
    if (!forward) {
      throw new Error(`Forward '${forwardName}' not found in template`);
    }

    if (forward.status !== 'running') {
      const options: PortForwardOptions = {
        namespace: forward.namespace,
        localPort: forward.localPort,
        remotePort: forward.remotePort,
      };

      if (forward.resourceType === 'pod') {
        options.podName = forward.resourceName;
      } else if (forward.resourceType === 'service') {
        options.serviceName = forward.resourceName;
      } else if (forward.resourceType === 'deployment') {
        options.deploymentName = forward.resourceName;
      }

      try {
        await this.pfManager.startPortForward(forward.id, options);
        forward.status = 'running';
        forward.error = undefined;
      } catch (error) {
        forward.status = 'error';
        forward.error = String(error);
        throw error;
      }
    }

    // Update execution status
    this.updateExecutionStatus(execution);
  }

  /**
   * Stop all template executions
   */
  async stopAll(): Promise<void> {
    const templateIds = Array.from(this.executions.keys());

    for (const templateId of templateIds) {
      try {
        await this.stop(templateId);
      } catch (error) {
        console.error(`Failed to stop template '${templateId}':`, error);
      }
    }
  }

  /**
   * Get execution status
   */
  getExecution(templateId: string): TemplateExecution | undefined {
    return this.executions.get(templateId);
  }

  /**
   * Get all active executions
   */
  getAllExecutions(): TemplateExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Check if a template is running
   */
  isRunning(templateId: string): boolean {
    const execution = this.executions.get(templateId);
    return execution?.status === 'running' || execution?.status === 'partial';
  }

  /**
   * Get logs for a template or specific forward
   */
  getLogs(templateId: string, forwardName?: string) {
    if (forwardName) {
      const execution = this.executions.get(templateId);
      if (execution) {
        const forward = execution.forwards.find((f) => f.name === forwardName);
        if (forward) {
          return this.logCapture.getLogs(forward.id);
        }
      }
      return [];
    }

    // Get all logs for all forwards in the template
    const execution = this.executions.get(templateId);
    if (!execution) return [];

    const allLogs: any[] = [];
    for (const forward of execution.forwards) {
      allLogs.push(...this.logCapture.getLogs(forward.id));
    }

    return allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Clear logs for a template
   */
  clearLogs(templateId: string): void {
    const execution = this.executions.get(templateId);
    if (!execution) return;

    for (const forward of execution.forwards) {
      this.logCapture.clearLogs(forward.id);
    }
  }

  /**
   * Get the log capture instance
   */
  getLogCapture(): LogCapture {
    return this.logCapture;
  }

  /**
   * Update execution status based on forward statuses
   */
  private updateExecutionStatus(execution: TemplateExecution): void {
    const hasRunning = execution.forwards.some((f) => f.status === 'running');
    const hasError = execution.forwards.some((f) => f.status === 'error');
    const allStopped = execution.forwards.every((f) => f.status === 'stopped');

    if (allStopped) {
      execution.status = 'stopped';
    } else if (hasRunning && hasError) {
      execution.status = 'partial';
    } else if (hasRunning) {
      execution.status = 'running';
    } else {
      execution.status = 'stopped';
    }
  }
}
