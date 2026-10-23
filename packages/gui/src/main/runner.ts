import { EventEmitter } from 'events';
import {
  ClusterDiscovery,
  RunRegistry,
  TemplateExecutor,
  TemplateStorage,
  type LogEntry,
  type Template,
} from '@hodor/core';

interface AppRun {
  template: Template;
  clusterId: string;
  clusterName: string;
  startedAt: string;
  executor: TemplateExecutor;
  dispose: () => void;
}

export interface ForwardState {
  status: 'running' | 'error' | 'stopped';
  connections: number;
  pod?: string;
  error?: string;
}

/**
 * Templates started from the desktop app. Their forwards live in this (main) process; the shared run
 * registry lets the CLI see them, and stop/restart them through marker files.
 */
export class AppRunner extends EventEmitter {
  private runs = new Map<string, AppRun>();
  private discovery = new ClusterDiscovery();

  constructor(private registry = new RunRegistry()) {
    super();
  }

  private async loadTemplate(templateId: string): Promise<Template> {
    const storage = new TemplateStorage();
    await storage.initialize();
    const template = storage.get(templateId);
    if (!template)
      throw new Error('Template not found. It may have been deleted from the terminal.');
    return template;
  }

  has(templateId: string): boolean {
    return this.runs.has(templateId);
  }

  ids(): string[] {
    return [...this.runs.keys()];
  }

  async start(templateId: string, clusterId: string): Promise<void> {
    if (this.runs.has(templateId) || (await this.registry.isRunning(templateId))) {
      throw new Error('This template is already running');
    }
    const cluster = await this.discovery.find(clusterId);
    if (!cluster) throw new Error('Cluster not found');

    const template = await this.loadTemplate(templateId);
    const executor = new TemplateExecutor(await this.discovery.connect(cluster));
    executor.getLogCapture().on('log', () => this.emit('change'));
    await executor.execute(template, cluster.id);

    await this.registry.register({
      templateId,
      templateName: template.name,
      clusterId: cluster.id,
      source: 'app',
    });
    const dispose = this.registry.watchControl(templateId, {
      onStop: () => this.stop(templateId),
      onRestart: () => this.restart(templateId),
    });

    this.runs.set(templateId, {
      template,
      clusterId: cluster.id,
      clusterName: cluster.name,
      startedAt: new Date().toISOString(),
      executor,
      dispose,
    });
    this.emit('change');
  }

  async stop(templateId: string): Promise<void> {
    const run = this.runs.get(templateId);
    if (!run) return;
    this.runs.delete(templateId);
    run.dispose();
    await run.executor.stopAll();
    await this.registry.unregister(templateId);
    this.emit('change');
  }

  async stopAll(): Promise<number> {
    const ids = this.ids();
    await Promise.allSettled(ids.map((id) => this.stop(id)));
    return ids.length;
  }

  /** Reload the template from disk and start its forwards again on the same cluster */
  async restart(templateId: string): Promise<void> {
    const run = this.runs.get(templateId);
    if (!run) return;
    await run.executor.stopAll();
    run.template = await this.loadTemplate(templateId);
    await run.executor.execute(run.template, run.clusterId);
    this.emit('change');
  }

  async setForward(
    templateId: string,
    forwardName: string,
    action: 'start' | 'stop'
  ): Promise<void> {
    const run = this.runs.get(templateId);
    if (!run) throw new Error('This template is not running in the app');
    if (!run.template.forwards.some((f) => f.name === forwardName))
      throw new Error(`No forward called '${forwardName}'`);
    if (action === 'stop') await run.executor.stopForward(templateId, forwardName);
    else await run.executor.startForward(templateId, forwardName);
    this.emit('change');
  }

  /** Per-forward state for the UI */
  forwardStates(templateId: string): Map<string, ForwardState> {
    const run = this.runs.get(templateId);
    const states = new Map<string, ForwardState>();
    if (!run) return states;
    for (const f of run.executor.getExecution(templateId)?.forwards ?? []) {
      const live = run.executor.getForwardStatus(templateId, f.name);
      states.set(f.name, {
        status: f.status === 'running' && live?.status === 'error' ? 'error' : f.status,
        connections: live?.activeConnections ?? 0,
        pod: live?.podName,
        error: live?.error ?? f.error,
      });
    }
    return states;
  }

  info(templateId: string) {
    const run = this.runs.get(templateId);
    return (
      run && {
        template: run.template,
        clusterId: run.clusterId,
        clusterName: run.clusterName,
        startedAt: run.startedAt,
      }
    );
  }

  logs(templateId: string, forwardName?: string, limit = 300): LogEntry[] {
    const run = this.runs.get(templateId);
    if (!run) return [];
    return (run.executor.getLogs(templateId, forwardName) as LogEntry[]).slice(-limit);
  }

  /** Stop everything before the app quits */
  async shutdown(): Promise<void> {
    await this.stopAll();
  }
}
