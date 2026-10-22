import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  ClusterDiscovery,
  RunRegistry,
  SettingsStorage,
  TemplateStorage,
  VERSION,
  findKubectl,
} from '@hodor/core';
import {
  CHANNELS,
  type ForwardSummary,
  type RunningTemplate,
  type TemplateSummary,
} from '../shared/api';

const clusterIdSchema = z.string().min(1).max(4096);
const templateIdSchema = z.string().regex(/^[a-f0-9]{8,64}$/);
const settingsPatchSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    language: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .optional(),
  })
  .strict();

type Handler = (arg: unknown) => unknown;

/**
 * Register every IPC handler. `isTrustedSender` rejects calls that don't come from our own renderer.
 */
export function registerIpc(
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean,
  onSettingsChanged: (settings: Awaited<ReturnType<SettingsStorage['getAll']>>) => void
): void {
  const discovery = new ClusterDiscovery();
  const registry = new RunRegistry();

  const settingsStore = async () => {
    const settings = new SettingsStorage();
    await settings.initialize();
    return settings;
  };

  // Read on every call: the CLI may have changed templates in the meantime
  const templateStore = async () => {
    const storage = new TemplateStorage();
    await storage.initialize();
    return storage;
  };

  const handle = (channel: string, fn: Handler) => {
    ipcMain.handle(channel, async (event, arg) => {
      if (!isTrustedSender(event)) {
        throw new Error('Untrusted sender');
      }
      return fn(arg);
    });
  };

  const summarize = (f: ForwardSummary): ForwardSummary => ({
    name: f.name,
    namespace: f.namespace,
    resourceType: f.resourceType,
    resourceName: f.resourceName,
    localPort: f.localPort,
    remotePort: f.remotePort,
  });

  handle(CHANNELS.appInfo, async () => ({
    version: VERSION,
    platform: process.platform,
    kubectl: (await findKubectl()) ?? null,
    dataDir: path.join(os.homedir(), '.hodor'),
  }));

  handle(CHANNELS.clustersList, () => discovery.list());

  handle(CHANNELS.clustersHealth, async (arg) => {
    const cluster = await discovery.find(clusterIdSchema.parse(arg));
    if (!cluster) throw new Error('Cluster not found');
    return discovery.checkHealth(cluster);
  });

  handle(CHANNELS.templatesList, async (): Promise<TemplateSummary[]> => {
    const [storage, running] = await Promise.all([templateStore(), registry.list()]);
    const runningIds = new Set(running.map((r) => r.templateId));
    return storage.getAll().map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      tags: t.tags,
      forwards: t.forwards.map(summarize),
      updatedAt: t.updatedAt.toISOString(),
      running: runningIds.has(t.id),
    }));
  });

  handle(CHANNELS.runningList, async (): Promise<RunningTemplate[]> => {
    const [storage, running] = await Promise.all([templateStore(), registry.list()]);
    return running.map((r) => ({
      templateId: r.templateId,
      templateName: r.templateName,
      clusterId: r.clusterId,
      clusterName: r.clusterId.split('::').pop() || r.clusterId,
      pid: r.pid,
      startedAt: r.startedAt,
      forwards: (storage.get(r.templateId)?.forwards || []).map(summarize),
    }));
  });

  handle(CHANNELS.runningStop, (arg) => registry.requestStop(templateIdSchema.parse(arg)));

  handle(CHANNELS.settingsGet, async () => (await settingsStore()).getAll());

  handle(CHANNELS.settingsUpdate, async (arg) => {
    const settings = await settingsStore();
    await settings.update(settingsPatchSchema.parse(arg));
    const all = settings.getAll();
    onSettingsChanged(all);
    return all;
  });
}
