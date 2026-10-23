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

export interface LinkableNames {
  /** null when the user may not list them; they can still type a name */
  secrets: string[] | null;
  configMaps: string[] | null;
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

  /** Names of secrets and config maps a forward can link to */
  async linkables(namespace: string): Promise<LinkableNames> {
    const orNull = async (load: () => Promise<string[]>) => {
      try {
        return await load();
      } catch (error) {
        if (error instanceof KubernetesApiError && error.statusCode === 403) return null;
        throw error;
      }
    };
    const [secrets, configMaps] = await Promise.all([
      orNull(() => this.client.listSecretNames(namespace)),
      orNull(() => this.client.listConfigMapNames(namespace)),
    ]);
    return { secrets, configMaps };
  }

  async services(namespace: string): Promise<ServiceView[]> {
    return (await this.client.listServices(namespace)).map(summarizeService).sort(byName);
  }
}

export interface DecodedValue {
  /** The value as text, when it is valid UTF-8 without control characters */
  text?: string;
  bytes: number;
  binary: boolean;
}

/**
 * Decode secret data (base64) or config map binaryData into text when it is text
 */
export function decodeValue(base64: string): DecodedValue {
  const buffer = Buffer.from(base64, 'base64');
  const text = buffer.toString('utf8');
  // eslint-disable-next-line no-control-regex
  const binary = text.includes('\uFFFD') || /[\x00-\x08\x0E-\x1F]/.test(text);
  return binary ? { bytes: buffer.length, binary } : { text, bytes: buffer.length, binary };
}

/** Key names of a secret or config map, never the values */
export function keysOf(
  resource: { data?: Record<string, string>; binaryData?: Record<string, string> } | null
): string[] {
  if (!resource) return [];
  return [...Object.keys(resource.data ?? {}), ...Object.keys(resource.binaryData ?? {})].sort();
}

/** One value: secrets hold base64 in `data`; config maps hold text in `data` and base64 in `binaryData` */
export function valueOf(
  kind: 'secret' | 'configMap',
  resource: { data?: Record<string, string>; binaryData?: Record<string, string> },
  key: string
): DecodedValue | undefined {
  if (kind === 'secret') {
    const raw = resource.data?.[key];
    return raw === undefined ? undefined : decodeValue(raw);
  }
  const text = resource.data?.[key];
  if (text !== undefined) return { text, bytes: Buffer.byteLength(text), binary: false };
  const raw = resource.binaryData?.[key];
  return raw === undefined ? undefined : decodeValue(raw);
}
