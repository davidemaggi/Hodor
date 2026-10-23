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
    /** Is the `hodor` command on the PATH? */
    cliStatus(): Promise<CliStatus>;
    installCli(): Promise<CliStatus>;
    /** Null when the check is turned off or GitHub can't be reached */
    checkUpdate(): Promise<UpdateInfo | null>;
    /** Open the GitHub release page of a version in the browser */
    openRelease(url: string): Promise<void>;
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
    /** Reload the template and restart its forwards, wherever it runs */
    restart(templateId: string): Promise<boolean>;
    /** Start a template inside the app on a cluster */
    start(templateId: string, clusterId: string): Promise<void>;
    /** Stop every running template (app and CLI); returns how many */
    stopAll(): Promise<number>;
    /** Start or stop one forward of a template running in the app */
    forward(templateId: string, forwardName: string, action: 'start' | 'stop'): Promise<void>;
    logs(templateId: string, forwardName?: string): Promise<LogLine[]>;
    /** Key names of the secrets and config maps linked to a forward (no values) */
    linked(templateId: string, forwardName: string): Promise<LinkedResources>;
    /** One value, shown on request */
    reveal(ref: ValueRef): Promise<RevealedValue>;
    /** Copy one value to the clipboard from the main process; wiped after 30 seconds */
    copyValue(ref: ValueRef): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: SettingsPatch): Promise<Settings>;
  };
}

export interface CliStatus {
  /** dev: not an installed build · appimage: can't be linked · other: a different hodor is on PATH */
  state: 'installed' | 'notOnPath' | 'missing' | 'other' | 'dev' | 'appimage';
  path?: string;
  target?: string;
}

export interface UpdateInfo {
  current: string;
  /** Set when a newer release exists */
  latest?: string;
  url?: string;
}

export interface AppInfo {
  version: string;
  /** The major's Game of Thrones name, e.g. "Aerys" */
  codename?: string;
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
  /** Live state, for templates running in the app */
  status?: 'running' | 'error' | 'stopped';
  connections?: number;
  pod?: string;
  error?: string;
  secrets: string[];
  configMaps: string[];
}

export interface LogLine {
  time: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  forward: string;
  message: string;
}

export interface LinkedEntry {
  name: string;
  /** null when the resource can't be read (missing or not allowed) */
  keys: string[] | null;
  error?: string;
}

export interface LinkedResources {
  secrets: LinkedEntry[];
  configMaps: LinkedEntry[];
}

export interface ValueRef {
  templateId: string;
  forward: string;
  kind: 'secret' | 'configMap';
  name: string;
  key: string;
}

export interface RevealedValue {
  text?: string;
  bytes: number;
  binary: boolean;
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
  /** Started by this app: forwards can be controlled one by one and logs are available */
  controllable: boolean;
  forwards: RunningForward[];
}

export type SettingsPatch = Partial<{
  theme: ThemePreference;
  language: string;
  productionClusters: string[];
  checkUpdates: boolean;
}>;

export const CHANNELS = {
  appInfo: 'hodor:app:info',
  appCliStatus: 'hodor:app:cli-status',
  appInstallCli: 'hodor:app:install-cli',
  appCheckUpdate: 'hodor:app:check-update',
  appOpenRelease: 'hodor:app:open-release',
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
  runningStart: 'hodor:running:start',
  runningStopAll: 'hodor:running:stop-all',
  runningForward: 'hodor:running:forward',
  runningLogs: 'hodor:running:logs',
  runningLinked: 'hodor:running:linked',
  runningReveal: 'hodor:running:reveal',
  runningCopyValue: 'hodor:running:copy-value',
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
