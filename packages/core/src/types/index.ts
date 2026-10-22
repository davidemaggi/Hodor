/**
 * Core type definitions for Hodor
 */

export interface Cluster {
  name: string;
  server: string;
  context: string;
  namespace?: string;
  isActive: boolean;
  isDefault: boolean;
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
