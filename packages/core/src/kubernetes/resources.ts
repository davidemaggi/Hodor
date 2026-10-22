import * as k8s from '@kubernetes/client-node';
import { KubernetesApiError, KubernetesClient } from './client';

export interface ContainerPortView {
  container: string;
  name?: string;
  port: number;
  protocol: string;
}

export interface PodView {
  name: string;
  namespace: string;
  /** Running, Pending, Succeeded, Failed, Unknown, or a waiting reason such as CrashLoopBackOff */
  status: string;
  ready: number;
  containers: number;
  restarts: number;
  createdAt?: string;
  /** Owner as kind/name, e.g. ReplicaSet/api-7d9f */
  owner?: string;
  ports: ContainerPortView[];
}

export interface ServicePortView {
  name?: string;
  port: number;
  /** Number or named container port */
  targetPort: number | string;
  protocol: string;
}

export interface ServiceView {
  name: string;
  namespace: string;
  type: string;
  /** False for services without a selector (nothing to port-forward to) */
  forwardable: boolean;
  ports: ServicePortView[];
}

export interface NamespaceList {
  namespaces: string[];
  /** False when the user may not list namespaces; the list then holds the context's namespace only */
  complete: boolean;
}

/**
 * Pod status as kubectl shows it: a container's waiting reason beats the pod phase
 */
export function podStatus(pod: k8s.V1Pod): string {
  if (pod.metadata?.deletionTimestamp) return 'Terminating';
  for (const cs of pod.status?.containerStatuses || []) {
    const reason = cs.state?.waiting?.reason || cs.state?.terminated?.reason;
    if (reason && reason !== 'Completed') return reason;
  }
  return pod.status?.phase || 'Unknown';
}

export function summarizePod(pod: k8s.V1Pod): PodView {
  const statuses = pod.status?.containerStatuses || [];
  const owner = pod.metadata?.ownerReferences?.[0];

  return {
    name: pod.metadata?.name || '',
    namespace: pod.metadata?.namespace || '',
    status: podStatus(pod),
    ready: statuses.filter((c) => c.ready).length,
    containers: pod.spec?.containers.length || 0,
    restarts: statuses.reduce((sum, c) => sum + (c.restartCount || 0), 0),
    createdAt: pod.metadata?.creationTimestamp
      ? new Date(pod.metadata.creationTimestamp).toISOString()
      : undefined,
    owner: owner ? `${owner.kind}/${owner.name}` : undefined,
    ports: (pod.spec?.containers || []).flatMap((c) =>
      (c.ports || []).map((p) => ({
        container: c.name,
        name: p.name,
        port: p.containerPort,
        protocol: p.protocol || 'TCP',
      }))
    ),
  };
}

export function summarizeService(svc: k8s.V1Service): ServiceView {
  return {
    name: svc.metadata?.name || '',
    namespace: svc.metadata?.namespace || '',
    type: svc.spec?.type || 'ClusterIP',
    forwardable: !!svc.spec?.selector && Object.keys(svc.spec.selector).length > 0,
    ports: (svc.spec?.ports || []).map((p) => ({
      name: p.name,
      port: p.port,
      targetPort: p.targetPort ?? p.port,
      protocol: p.protocol || 'TCP',
    })),
  };
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

/**
 * Read-only view of a cluster's namespaces, pods and services
 */
export class ResourceBrowser {
  constructor(
    private client: KubernetesClient,
    private contextNamespace = 'default'
  ) {}

  async namespaces(): Promise<NamespaceList> {
    try {
      const items = await this.client.listNamespaces();
      const namespaces = items
        .map((ns) => ns.metadata?.name || '')
        .filter(Boolean)
        .sort();
      return { namespaces, complete: true };
    } catch (error: any) {
      if (error instanceof KubernetesApiError && error.statusCode === 403) {
        return { namespaces: [this.contextNamespace], complete: false };
      }
      throw error;
    }
  }

  async pods(namespace: string): Promise<PodView[]> {
    return (await this.client.listPods(namespace)).map(summarizePod).sort(byName);
  }

  async services(namespace: string): Promise<ServiceView[]> {
    return (await this.client.listServices(namespace)).map(summarizeService).sort(byName);
  }
}
