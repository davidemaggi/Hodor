import {
  clipboard,
  dialog,
  ipcMain,
  shell,
  type BrowserWindow,
  type IpcMainInvokeEvent,
} from 'electron';
import type { AppRunner } from './runner';
import { cliStatus, installCli } from './cli-install';
import { RELEASES_URL, checkForUpdate } from './update-check';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  ClusterDiscovery,
  CommandGenerator,
  ContextManager,
  TemplateManager,
  portableTemplateSchema,
  KubeConfigMerger,
  KubeConfigParser,
  ResourceBrowser,
  RunRegistry,
  SettingsStorage,
  TemplateStorage,
  VERSION,
  findKubectl,
  codename,
  keysOf,
  valueOf,
  type Template,
} from '@hodor/core';
import {
  CHANNELS,
  type TemplateDetail,
  type ForwardSummary,
  type LinkedResources,
  type MergeOutcome,
  type MergePreview,
  type RunningTemplate,
  type TemplateSummary,
  type ValueRef,
} from '../shared/api';

const clusterIdSchema = z.string().min(1).max(4096);
// Kubernetes namespace names are DNS labels
const namespaceSchema = z
  .string()
  .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/)
  .max(63);
const browseSchema = z.object({ clusterId: clusterIdSchema, namespace: namespaceSchema }).strict();
const droppedPathsSchema = z.array(z.string().min(1).max(4096)).min(1).max(10);
const tokenSchema = z.string().uuid();
const MAX_KUBECONFIG_BYTES = 5 * 1024 * 1024;
const MERGE_TTL_MS = 10 * 60 * 1000;
const CLIPBOARD_WIPE_MS = 30_000;
const forwardNameSchema = z.string().min(1).max(63);
const valueRefSchema = z
  .object({
    templateId: z.string().regex(/^[a-f0-9]{8,64}$/),
    forward: forwardNameSchema,
    kind: z.enum(['secret', 'configMap']),
    name: z
      .string()
      .regex(/^[a-z0-9]([-.a-z0-9]*[a-z0-9])?$/)
      .max(253),
    key: z
      .string()
      .regex(/^[-._a-zA-Z0-9]+$/)
      .max(253),
  })
  .strict();
const commandRequestSchema = z
  .object({
    platform: z.enum(['linux', 'macos', 'windows']),
    forward: z.string().max(63).optional(),
    context: z.string().max(253).optional(),
    script: z.boolean().optional(),
  })
  .strict();

const templateIdSchema = z.string().regex(/^[a-f0-9]{8,64}$/);
const templateIdsSchema = z.array(templateIdSchema).max(1000);
const settingsPatchSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    language: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .optional(),
    // Cluster ids ("<kubeconfig path>::<context>") marked as production
    productionClusters: z.array(z.string().min(1).max(4096)).max(1000).optional(),
    checkUpdates: z.boolean().optional(),
  })
  .strict();

type Handler = (arg: unknown) => unknown;

/** What the tray needs from the same code paths the renderer uses */
export interface MainServices {
  runningList(): Promise<RunningTemplate[]>;
  linked(templateId: string, forwardName: string): Promise<LinkedResources>;
  copyValue(ref: ValueRef): Promise<void>;
  copyText(text: string): Promise<void>;
  stop(templateId: string): Promise<boolean>;
  stopAll(): Promise<number>;
  setForward(templateId: string, forwardName: string, action: 'start' | 'stop'): Promise<void>;
}

/** Is anything accepting connections on 127.0.0.1:port? */
function isListening(port: number, timeoutMs = 300): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/**
 * Register every IPC handler. `isTrustedSender` rejects calls that don't come from our own renderer.
 */
export function registerIpc(
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean,
  onSettingsChanged: (settings: Awaited<ReturnType<SettingsStorage['getAll']>>) => void,
  getWindow: () => BrowserWindow | null,
  runner: AppRunner
): MainServices {
  const discovery = new ClusterDiscovery();
  const registry = new RunRegistry();
  const parser = new KubeConfigParser();
  const merger = new KubeConfigMerger();
  const pendingMerges = new Map<string, { files: string[]; expires: number }>();

  const requireCluster = async (clusterId: string) => {
    const cluster = await discovery.find(clusterId);
    if (!cluster) throw new Error('Cluster not found');
    return cluster;
  };

  const browserFor = async (clusterId: string) => {
    const cluster = await requireCluster(clusterId);
    return new ResourceBrowser(await discovery.connect(cluster), cluster.namespace || 'default');
  };

  /** kubectl can only switch to contexts in the kubeconfig it writes to */
  const requireSwitchable = async (clusterId: string) => {
    if (!(await findKubectl())) throw new Error('kubectl is not installed');
    const cluster = await requireCluster(clusterId);
    const manager = new ContextManager();
    if (path.resolve(cluster.sourceFile) !== path.resolve(manager.getConfigPath())) {
      throw new Error(
        `'${cluster.name}' lives in ${cluster.sourceFile}. Merge it into your default kubeconfig first.`
      );
    }
    return { cluster, manager };
  };

  /** Only real, small, readable kubeconfig files may be merged */
  const checkKubeconfigFile = async (file: string) => {
    if (!path.isAbsolute(file)) throw new Error('Expected an absolute path');
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > MAX_KUBECONFIG_BYTES)
      throw new Error(`${path.basename(file)} is not a kubeconfig`);
    await parser.parseFile(file);
  };

  const previewMerge = async (files: string[]): Promise<MergePreview> => {
    for (const file of files) await checkKubeconfigFile(file);
    const target = new ContextManager().getConfigPath();
    const plan = await merger.planMerge(target, files);

    const now = Date.now();
    for (const [key, pending] of pendingMerges)
      if (pending.expires < now) pendingMerges.delete(key);
    const token = randomUUID();
    pendingMerges.set(token, { files, expires: now + MERGE_TTL_MS });

    return {
      token,
      target,
      files,
      added: plan.added,
      contexts: plan.config.contexts.map((c) => c.name),
      skipped: plan.skipped.map((s) => ({
        kind: s.kind,
        name: s.name,
        file: plan.inputs[s.source],
      })),
    };
  };

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
    codename: codename(VERSION),
    platform: process.platform,
    kubectl: (await findKubectl()) ?? null,
    dataDir: path.join(os.homedir(), '.hodor'),
    defaultKubeconfig: parser.getDefaultConfigPath(),
  }));

  handle(CHANNELS.clustersList, () => discovery.list());

  handle(CHANNELS.appCliStatus, () => cliStatus());
  handle(CHANNELS.appInstallCli, () => installCli());
  handle(CHANNELS.appCheckUpdate, async () => {
    if ((await settingsStore()).get('checkUpdates') === false) return null;
    try {
      return await checkForUpdate();
    } catch {
      return null;
    }
  });
  handle(CHANNELS.appOpenRelease, async (arg) => {
    const url = z.string().url().parse(arg);
    // Only our own release pages
    if (!url.startsWith(`${RELEASES_URL}/`)) throw new Error('Not a Hodor release page');
    await shell.openExternal(url);
  });

  handle(CHANNELS.clustersHealth, async (arg) =>
    discovery.checkHealth(await requireCluster(clusterIdSchema.parse(arg)))
  );

  handle(CHANNELS.clustersSelect, async (arg) => {
    const cluster = await requireCluster(clusterIdSchema.parse(arg));
    await (await settingsStore()).set('lastUsedCluster', cluster.id);
  });

  handle(CHANNELS.clustersNamespaces, async (arg) =>
    (await browserFor(clusterIdSchema.parse(arg))).namespaces()
  );

  handle(CHANNELS.clustersPods, async (arg) => {
    const { clusterId, namespace } = browseSchema.parse(arg);
    return (await browserFor(clusterId)).pods(namespace);
  });

  handle(CHANNELS.clustersServices, async (arg) => {
    const { clusterId, namespace } = browseSchema.parse(arg);
    return (await browserFor(clusterId)).services(namespace);
  });

  handle(CHANNELS.kubectlSetContext, async (arg) => {
    const { cluster, manager } = await requireSwitchable(clusterIdSchema.parse(arg));
    await manager.switchContext(cluster.name);
  });

  handle(CHANNELS.kubectlSetNamespace, async (arg) => {
    const { clusterId, namespace } = browseSchema.parse(arg);
    const { cluster, manager } = await requireSwitchable(clusterId);
    await manager.setNamespace(namespace, cluster.name);
  });

  handle(CHANNELS.kubeconfigChoose, async () => {
    const window = getWindow();
    const options = {
      title: 'Merge kubeconfig',
      properties: ['openFile', 'multiSelections', 'showHiddenFiles'] as Array<
        'openFile' | 'multiSelections' | 'showHiddenFiles'
      >,
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return previewMerge(result.filePaths);
  });

  handle(CHANNELS.kubeconfigPreview, async (arg) => previewMerge(droppedPathsSchema.parse(arg)));

  handle(CHANNELS.kubeconfigPreviewCluster, async (arg) => {
    const cluster = await requireCluster(clusterIdSchema.parse(arg));
    return previewMerge([cluster.sourceFile]);
  });

  handle(CHANNELS.kubeconfigApply, async (arg): Promise<MergeOutcome> => {
    const token = tokenSchema.parse(arg);
    const pending = pendingMerges.get(token);
    pendingMerges.delete(token);
    if (!pending || pending.expires < Date.now())
      throw new Error('This merge preview expired. Pick the files again.');

    // mergeFiles re-plans from disk (the target may have changed since the preview) and keeps comments
    const manager = new ContextManager();
    const { backup, added } = await manager.mergeFiles(pending.files);
    return { target: manager.getConfigPath(), backup, added };
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

  const toDetail = (t: Template, running: boolean): TemplateDetail => ({
    id: t.id,
    name: t.name,
    description: t.description,
    tags: t.tags,
    forwards: t.forwards,
    updatedAt: t.updatedAt.toISOString(),
    running,
  });

  const managerAndRunning = async () => {
    const [storage, running] = await Promise.all([templateStore(), registry.list()]);
    return {
      manager: new TemplateManager(storage),
      runningIds: new Set(running.map((r) => r.templateId)),
    };
  };

  const requireTemplate = (manager: TemplateManager, id: string) => {
    const template = manager.get(id);
    if (!template)
      throw new Error('Template not found. It may have been deleted from the terminal.');
    return template;
  };

  handle(CHANNELS.templatesGet, async (arg) => {
    const { manager, runningIds } = await managerAndRunning();
    const template = requireTemplate(manager, templateIdSchema.parse(arg));
    return toDetail(template, runningIds.has(template.id));
  });

  handle(CHANNELS.templatesCreate, async (arg) => {
    const input = portableTemplateSchema.parse(arg);
    const { manager } = await managerAndRunning();
    if (manager.nameExists(input.name))
      throw new Error(`A template called '${input.name}' already exists`);
    return toDetail(await manager.create(input), false);
  });

  handle(CHANNELS.templatesUpdate, async (arg) => {
    const { id, input } = z
      .object({ id: templateIdSchema, input: z.unknown() })
      .strict()
      .parse(arg);
    const data = portableTemplateSchema.parse(input);
    const { manager, runningIds } = await managerAndRunning();
    requireTemplate(manager, id);
    if (manager.nameExists(data.name, id))
      throw new Error(`A template called '${data.name}' already exists`);
    // An explicit undefined clears the description
    const updated = await manager.update(id, { ...data, description: data.description });
    return { template: toDetail(updated, runningIds.has(id)), running: runningIds.has(id) };
  });

  handle(CHANNELS.templatesRemove, async (arg) => {
    const id = templateIdSchema.parse(arg);
    const { manager, runningIds } = await managerAndRunning();
    if (runner.has(id)) await runner.stop(id);
    else if (runningIds.has(id)) await registry.requestStop(id);
    await manager.delete(id);
  });

  handle(CHANNELS.templatesReorder, async (arg) => {
    const { manager } = await managerAndRunning();
    await manager.reorder(templateIdsSchema.parse(arg));
  });

  handle(CHANNELS.templatesExport, async (arg) => {
    const ids = templateIdsSchema.min(1).parse(arg);
    const { manager } = await managerAndRunning();
    const json = manager.exportMultiple(ids);
    const first = requireTemplate(manager, ids[0]);
    const suggested =
      ids.length === 1
        ? `${first.name.replace(/[^a-z0-9-_]+/gi, '-')}.hodor.json`
        : 'templates.hodor.json';
    const window = getWindow();
    const options = {
      title: 'Export templates',
      defaultPath: path.join(os.homedir(), suggested),
      filters: [{ name: 'Hodor templates', extensions: ['json'] }],
    };
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, json + '\n', 'utf-8');
    return result.filePath;
  });

  handle(CHANNELS.templatesImport, async () => {
    const window = getWindow();
    const options = {
      title: 'Import templates',
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: 'Hodor templates', extensions: ['json'] }],
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    const stat = await fs.stat(result.filePaths[0]);
    if (stat.size > 2 * 1024 * 1024) throw new Error('That file is too big to be a template file');
    const { manager } = await managerAndRunning();
    const imported = await manager.importTemplates(await fs.readFile(result.filePaths[0], 'utf-8'));
    return imported.map((t) => t.name);
  });

  handle(CHANNELS.templatesCommands, async (arg) => {
    const { id, options } = z
      .object({ id: templateIdSchema, options: commandRequestSchema })
      .strict()
      .parse(arg);
    const { manager } = await managerAndRunning();
    const template = requireTemplate(manager, id);
    const forwards = options.forward
      ? template.forwards.filter((f) => f.name === options.forward)
      : template.forwards;
    if (forwards.length === 0) throw new Error(`No forward called '${options.forward}'`);
    const generator = new CommandGenerator();
    const commandOptions = { context: options.context };
    return options.script
      ? generator.generateShellScript(forwards, options.platform, commandOptions)
      : generator
          .generateTemplateCommands(forwards, options.platform, commandOptions)
          .map((c) => c.command)
          .join('\n');
  });

  handle(CHANNELS.runningRestart, async (arg) => {
    const id = templateIdSchema.parse(arg);
    if (runner.has(id)) {
      await runner.restart(id);
      return true;
    }
    return registry.requestRestart(id);
  });

  handle(CHANNELS.runningStart, async (arg) => {
    const { templateId, clusterId } = z
      .object({ templateId: templateIdSchema, clusterId: clusterIdSchema })
      .strict()
      .parse(arg);
    await runner.start(templateId, clusterId);
    await (await settingsStore()).set('lastUsedCluster', clusterId);
  });

  const stopAll = async () => {
    const fromApp = await runner.stopAll();
    const others = await registry.list();
    await Promise.all(others.map((r) => registry.requestStop(r.templateId)));
    return fromApp + others.length;
  };
  handle(CHANNELS.runningStopAll, () => stopAll());

  handle(CHANNELS.runningForward, async (arg) => {
    const { templateId, forwardName, action } = z
      .object({
        templateId: templateIdSchema,
        forwardName: forwardNameSchema,
        action: z.enum(['start', 'stop']),
      })
      .strict()
      .parse(arg);
    await runner.setForward(templateId, forwardName, action);
  });

  handle(CHANNELS.runningLogs, async (arg) => {
    const { templateId, forwardName } = z
      .object({ templateId: templateIdSchema, forwardName: forwardNameSchema.optional() })
      .strict()
      .parse(arg);
    const prefix = `${templateId}-`;
    return runner.logs(templateId, forwardName).map((entry) => ({
      time: entry.timestamp.toISOString(),
      level: entry.level,
      forward: entry.forwardId?.startsWith(prefix)
        ? entry.forwardId.slice(prefix.length)
        : (entry.forwardId ?? ''),
      message: entry.message,
    }));
  });

  /**
   * The cluster and linked resource of a running forward. Only names linked to that forward in the
   * template can be read: the renderer can't ask for arbitrary secrets.
   */
  const linkedTarget = async (templateId: string, forwardName: string) => {
    const record = (await registry.list()).find((r) => r.templateId === templateId);
    if (!record) throw new Error('This template is not running');
    const template = runner.info(templateId)?.template ?? (await templateStore()).get(templateId);
    const forward = template?.forwards.find((f) => f.name === forwardName);
    if (!forward) throw new Error(`No forward called '${forwardName}'`);
    const client = await discovery.connect(await requireCluster(record.clusterId));
    return { forward, client };
  };

  const readValue = async (ref: z.infer<typeof valueRefSchema>) => {
    const { forward, client } = await linkedTarget(ref.templateId, ref.forward);
    const allowed = ref.kind === 'secret' ? (forward.secrets ?? []) : (forward.configMaps ?? []);
    if (!allowed.includes(ref.name)) throw new Error(`'${ref.name}' is not linked to this forward`);
    const resource =
      ref.kind === 'secret'
        ? await client.getSecret(ref.name, forward.namespace)
        : await client.getConfigMap(ref.name, forward.namespace);
    if (!resource) throw new Error(`'${ref.name}' was not found in ${forward.namespace}`);
    const value = valueOf(ref.kind, resource, ref.key);
    if (!value) throw new Error(`'${ref.name}' has no key '${ref.key}'`);
    return value;
  };

  const linked = async (templateId: string, forwardName: string): Promise<LinkedResources> => {
    const { forward, client } = await linkedTarget(templateId, forwardName);
    const describe = async (kind: 'secret' | 'configMap', name: string) => {
      try {
        const resource =
          kind === 'secret'
            ? await client.getSecret(name, forward.namespace)
            : await client.getConfigMap(name, forward.namespace);
        return resource
          ? { name, keys: keysOf(resource) }
          : { name, keys: null, error: `not found in ${forward.namespace}` };
      } catch (error: any) {
        return { name, keys: null, error: String(error?.message || error).replace(/^.*?: /, '') };
      }
    };
    return {
      secrets: await Promise.all((forward.secrets ?? []).map((n) => describe('secret', n))),
      configMaps: await Promise.all(
        (forward.configMaps ?? []).map((n) => describe('configMap', n))
      ),
    };
  };
  handle(CHANNELS.runningLinked, (arg) => {
    const { templateId, forwardName } = z
      .object({ templateId: templateIdSchema, forwardName: forwardNameSchema })
      .strict()
      .parse(arg);
    return linked(templateId, forwardName);
  });

  handle(CHANNELS.runningReveal, async (arg) => readValue(valueRefSchema.parse(arg)));

  const copyValue = async (ref: ValueRef) => {
    const value = await readValue(valueRefSchema.parse(ref));
    if (value.text === undefined)
      throw new Error('This value is binary and cannot be copied as text');
    const text = value.text;
    await clipboard.writeText(text);
    // Forget it after a while, unless the user copied something else since
    setTimeout(async () => {
      if ((await clipboard.readText()) === text) clipboard.clear();
    }, CLIPBOARD_WIPE_MS).unref();
  };
  handle(CHANNELS.runningCopyValue, (arg) => copyValue(arg as ValueRef));

  handle(CHANNELS.clustersLinkables, async (arg) => {
    const { clusterId, namespace } = browseSchema.parse(arg);
    return (await browserFor(clusterId)).linkables(namespace);
  });

  const runningList = async (): Promise<RunningTemplate[]> => {
    const [storage, running] = await Promise.all([templateStore(), registry.list()]);
    return Promise.all(
      running.map(async (r) => {
        const controllable = runner.has(r.templateId);
        const states = runner.forwardStates(r.templateId);
        // An app run uses the template as it was started (or last restarted), not as edited since
        const template = runner.info(r.templateId)?.template ?? storage.get(r.templateId);
        return {
          templateId: r.templateId,
          templateName: r.templateName,
          clusterId: r.clusterId,
          clusterName: r.clusterId.split('::').pop() || r.clusterId,
          pid: r.pid,
          startedAt: r.startedAt,
          source: r.source ?? 'cli',
          controllable,
          forwards: await Promise.all(
            (template?.forwards || []).map(async (f) => {
              const state = states.get(f.name);
              return {
                ...summarize(f),
                secrets: f.secrets ?? [],
                configMaps: f.configMaps ?? [],
                listening: state ? state.status === 'running' : await isListening(f.localPort),
                ...(state
                  ? {
                      status: state.status,
                      connections: state.connections,
                      pod: state.pod,
                      error: state.error,
                    }
                  : {}),
              };
            })
          ),
        };
      })
    );
  };
  handle(CHANNELS.runningList, () => runningList());

  const stop = async (id: string) => {
    if (runner.has(id)) {
      await runner.stop(id);
      return true;
    }
    return registry.requestStop(id);
  };
  handle(CHANNELS.runningStop, (arg) => stop(templateIdSchema.parse(arg)));

  handle(CHANNELS.settingsGet, async () => (await settingsStore()).getAll());

  handle(CHANNELS.settingsUpdate, async (arg) => {
    const settings = await settingsStore();
    await settings.update(settingsPatchSchema.parse(arg));
    const all = settings.getAll();
    onSettingsChanged(all);
    return all;
  });

  return {
    runningList,
    linked,
    copyValue,
    copyText: (text) => clipboard.writeText(text),
    stop,
    stopAll,
    setForward: (templateId, forwardName, action) =>
      runner.setForward(templateId, forwardName, action),
  };
}
