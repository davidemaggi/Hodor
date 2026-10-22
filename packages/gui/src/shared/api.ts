import type {
  Cluster,
  ClusterHealth,
  LinkableNames,
  NamespaceList,
  PodView,
  PortForwardConfig,
  ServiceView,
  Settings,
  ThemePreference,
} from '@hodor/core';

/**
 * The whole surface the renderer can reach. Every method maps to one IPC channel,
 * and the main process validates every argument.
 */
export interface HodorApi {
  app: {
    info(): Promise<AppInfo>;
  };
  clusters: {
    list(): Promise<Cluster[]>;
    health(clusterId: string): Promise<ClusterHealth>;
    /** Remember the cluster the user is working with, so it is selected again after a restart */
    select(clusterId: string): Promise<void>;
    namespaces(clusterId: string): Promise<NamespaceList>;
    pods(clusterId: string, namespace: string): Promise<PodView[]>;
    services(clusterId: string, namespace: string): Promise<ServiceView[]>;
    /** Names only: secret and config map values never leave the main process here */
    linkables(clusterId: string, namespace: string): Promise<LinkableNames>;
  };
  kubectl: {
    /** Make a context kubectl's default. Only for contexts in the default kubeconfig. */
    setContext(clusterId: string): Promise<void>;
    /** Set the default namespace of a context in the default kubeconfig */
    setNamespace(clusterId: string, namespace: string): Promise<void>;
  };
  kubeconfig: {
    /** Open a file dialog and preview merging the chosen files; null if cancelled */
    chooseAndPreview(): Promise<MergePreview | null>;
    /** Preview merging files dropped on the window */
    previewDropped(files: File[]): Promise<MergePreview>;
    /** Preview merging the kubeconfig a context comes from into the default one */
    previewCluster(clusterId: string): Promise<MergePreview>;
    /** Apply a previewed merge. The token is single-use. */
    applyMerge(token: string): Promise<MergeOutcome>;
  };
  templates: {
    list(): Promise<TemplateSummary[]>;
    get(id: string): Promise<TemplateDetail>;
    create(input: TemplateInput): Promise<TemplateDetail>;
    /** Returns whether the template is running, so the UI can offer a restart */
    update(
      id: string,
      input: TemplateInput
    ): Promise<{ template: TemplateDetail; running: boolean }>;
    /** Stops it first when it's running */
    remove(id: string): Promise<void>;
    reorder(ids: string[]): Promise<void>;
    /** Save dialog; returns the file written, or null if cancelled */
    exportToFile(ids: string[]): Promise<string | null>;
    /** Open dialog; returns the names imported, or null if cancelled */
    importFromFile(): Promise<string[] | null>;
    commands(id: string, options: CommandRequest): Promise<string>;
  };
  running: {
    list(): Promise<RunningTemplate[]>;
    stop(templateId: string): Promise<boolean>;
    /** Ask the process running it to reload the template and restart its forwards */
    restart(templateId: string): Promise<boolean>;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: SettingsPatch): Promise<Settings>;
  };
}

export interface AppInfo {
  version: string;
  platform: 'darwin' | 'win32' | 'linux' | string;
  /** Path of the kubectl binary, or null when it is not installed */
  kubectl: string | null;
  dataDir: string;
  /** The kubeconfig kubectl writes to; only its contexts can become kubectl's default */
  defaultKubeconfig: string;
}

export interface MergePreview {
  token: string;
  target: string;
  files: string[];
  /** Context names that will be new in the target */
  added: string[];
  /** Every context in the result */
  contexts: string[];
  skipped: Array<{ kind: 'cluster' | 'user' | 'context'; name: string; file: string }>;
}

export interface MergeOutcome {
  target: string;
  backup: string | null;
  added: string[];
}

export type ForwardSummary = Pick<
  PortForwardConfig,
  'name' | 'namespace' | 'resourceType' | 'resourceName' | 'localPort' | 'remotePort'
>;

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  forwards: ForwardSummary[];
  updatedAt: string;
  running: boolean;
}

export type TemplateInput = {
  name: string;
  description?: string;
  tags: string[];
  forwards: PortForwardConfig[];
};

export interface TemplateDetail extends TemplateInput {
  id: string;
  updatedAt: string;
  running: boolean;
}

export interface CommandRequest {
  platform: 'linux' | 'macos' | 'windows';
  /** Only this forward */
  forward?: string;
  /** kubectl context to target */
  context?: string;
  /** A full script instead of one command per line */
  script?: boolean;
}

export interface RunningForward extends ForwardSummary {
  /** Whether something answers on 127.0.0.1:localPort right now */
  listening: boolean;
}

export interface RunningTemplate {
  templateId: string;
  templateName: string;
  clusterId: string;
  /** Context name, derived from the cluster id */
  clusterName: string;
  pid: number;
  startedAt: string;
  source: 'cli' | 'app';
  forwards: RunningForward[];
}

export type SettingsPatch = Partial<{
  theme: ThemePreference;
  language: string;
  productionClusters: string[];
}>;

export const CHANNELS = {
  appInfo: 'hodor:app:info',
  clustersList: 'hodor:clusters:list',
  clustersHealth: 'hodor:clusters:health',
  templatesList: 'hodor:templates:list',
  runningList: 'hodor:running:list',
  runningStop: 'hodor:running:stop',
  clustersSelect: 'hodor:clusters:select',
  clustersNamespaces: 'hodor:clusters:namespaces',
  clustersPods: 'hodor:clusters:pods',
  clustersServices: 'hodor:clusters:services',
  clustersLinkables: 'hodor:clusters:linkables',
  templatesGet: 'hodor:templates:get',
  templatesCreate: 'hodor:templates:create',
  templatesUpdate: 'hodor:templates:update',
  templatesRemove: 'hodor:templates:remove',
  templatesReorder: 'hodor:templates:reorder',
  templatesExport: 'hodor:templates:export',
  templatesImport: 'hodor:templates:import',
  templatesCommands: 'hodor:templates:commands',
  runningRestart: 'hodor:running:restart',
  kubectlSetContext: 'hodor:kubectl:set-context',
  kubectlSetNamespace: 'hodor:kubectl:set-namespace',
  kubeconfigChoose: 'hodor:kubeconfig:choose',
  kubeconfigPreview: 'hodor:kubeconfig:preview',
  kubeconfigPreviewCluster: 'hodor:kubeconfig:preview-cluster',
  kubeconfigApply: 'hodor:kubeconfig:apply',
  settingsGet: 'hodor:settings:get',
  settingsUpdate: 'hodor:settings:update',
} as const;

declare global {
  interface Window {
    hodor?: HodorApi;
  }
}
