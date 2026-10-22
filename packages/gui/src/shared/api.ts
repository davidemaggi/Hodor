import type {
  Cluster,
  ClusterHealth,
  PortForwardConfig,
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
  };
  templates: {
    list(): Promise<TemplateSummary[]>;
  };
  running: {
    list(): Promise<RunningTemplate[]>;
    stop(templateId: string): Promise<boolean>;
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

export interface RunningTemplate {
  templateId: string;
  templateName: string;
  clusterId: string;
  /** Context name, derived from the cluster id */
  clusterName: string;
  pid: number;
  startedAt: string;
  forwards: ForwardSummary[];
}

export type SettingsPatch = Partial<{ theme: ThemePreference; language: string }>;

export const CHANNELS = {
  appInfo: 'hodor:app:info',
  clustersList: 'hodor:clusters:list',
  clustersHealth: 'hodor:clusters:health',
  templatesList: 'hodor:templates:list',
  runningList: 'hodor:running:list',
  runningStop: 'hodor:running:stop',
  settingsGet: 'hodor:settings:get',
  settingsUpdate: 'hodor:settings:update',
} as const;

declare global {
  interface Window {
    hodor?: HodorApi;
  }
}
