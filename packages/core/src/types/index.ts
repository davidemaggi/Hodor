/**
 * Core type definitions for Hodor
 */

/**
 * A selectable Kubernetes target: one context from one kubeconfig file
 */
export interface Cluster {
  /** Stable identifier: `<kubeconfig path>::<context name>` */
  id: string;
  /** Context name */
  name: string;
  /** Cluster name referenced by the context */
  cluster: string;
  server: string;
  user: string;
  /** Kubeconfig file the context comes from */
  sourceFile: string;
  namespace?: string;
  /** True for kubectl's current default context */
  isDefault: boolean;
}

export interface ClusterHealth {
  reachable: boolean;
  version?: string;
  error?: string;
}

export interface Context {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
}

export interface KubeConfig {
  clusters: Cluster[];
  contexts: Context[];
  currentContext: string;
}

export interface PortForward {
  id: string;
  name: string;
  namespace: string;
  resourceType: 'pod' | 'service' | 'deployment';
  resourceName: string;
  localPort: number;
  remotePort: number;
  status: 'running' | 'stopped' | 'error';
  error?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  forwards: PortForwardConfig[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PortForwardConfig {
  name: string;
  namespace: string;
  resourceType: 'pod' | 'service' | 'deployment';
  resourceName: string;
  localPort: number;
  remotePort: number;
  secrets?: string[];
  configMaps?: string[];
}

export interface Secret {
  name: string;
  namespace: string;
  data: Record<string, string>;
}

export interface ConfigMap {
  name: string;
  namespace: string;
  data: Record<string, string>;
}

export interface TemplateExecution {
  templateId: string;
  clusterId: string;
  forwards: PortForward[];
  status: 'running' | 'stopped' | 'partial';
  startedAt: Date;
}
