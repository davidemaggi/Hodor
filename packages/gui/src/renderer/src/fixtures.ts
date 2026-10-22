import type { Cluster, ClusterHealth, PodView, ServiceView, Settings } from '@hodor/core';
import type {
  HodorApi,
  LogLine,
  MergePreview,
  RunningTemplate,
  TemplateDetail,
} from '../../shared/api';

// Sample data for the browser preview only. Believable, small, and consistent with itself.
const params = new URLSearchParams(window.location.search);
const home = '/Users/sam';
const id = (file: string, ctx: string) => `${home}/.kube/${file}::${ctx}`;

const clusters: Cluster[] = [
  {
    id: id('config', 'docker-desktop'),
    name: 'docker-desktop',
    cluster: 'docker-desktop',
    server: 'https://127.0.0.1:6443',
    user: 'docker-desktop',
    sourceFile: `${home}/.kube/config`,
    isDefault: true,
  },
  {
    id: id('config', 'kind-hodor'),
    name: 'kind-hodor',
    cluster: 'kind-hodor',
    server: 'https://127.0.0.1:52817',
    user: 'kind-hodor',
    sourceFile: `${home}/.kube/config`,
    namespace: 'shop',
    isDefault: false,
  },
  {
    id: id('staging.yaml', 'staging-eu'),
    name: 'staging-eu',
    cluster: 'staging-eu',
    server: 'https://k8s.staging.northwind.dev:6443',
    user: 'sam@staging',
    sourceFile: `${home}/.kube/staging.yaml`,
    namespace: 'shop',
    isDefault: false,
  },
  {
    id: id('prod.yaml', 'prod-eu-west'),
    name: 'prod-eu-west',
    cluster: 'prod-eu-west',
    server: 'https://k8s.eu-west.northwind.dev',
    user: 'sam@prod',
    sourceFile: `${home}/.kube/prod.yaml`,
    namespace: 'payments',
    isDefault: false,
  },
];

const health: Record<string, ClusterHealth> = {
  [clusters[0].id]: { reachable: true, version: 'v1.34.3' },
  [clusters[1].id]: { reachable: true, version: 'v1.33.1' },
  [clusters[2].id]: { reachable: false, error: 'getaddrinfo ENOTFOUND k8s.staging.northwind.dev' },
  [clusters[3].id]: { reachable: true, version: 'v1.32.4' },
};

const templates: TemplateDetail[] = [
  {
    id: 'a1f3c09e2b7d4e51',
    name: 'shop-dev',
    description: 'API, Postgres and Redis for the shop',
    tags: ['dev', 'backend'],
    updatedAt: '2026-10-21T16:42:00.000Z',
    running: true,
    forwards: [
      {
        name: 'api',
        namespace: 'shop',
        resourceType: 'service',
        resourceName: 'shop-api',
        localPort: 18080,
        remotePort: 80,
      },
      {
        name: 'postgres',
        namespace: 'shop',
        resourceType: 'service',
        resourceName: 'postgres',
        localPort: 15432,
        remotePort: 5432,
        secrets: ['postgres-credentials'],
        configMaps: ['shop-db-config'],
      },
      {
        name: 'redis',
        namespace: 'shop',
        resourceType: 'service',
        resourceName: 'redis-master',
        localPort: 16379,
        remotePort: 6379,
      },
    ],
  },
  {
    id: 'b84e0d17c3a95f22',
    name: 'observability',
    description: 'Grafana and Prometheus',
    tags: ['infra'],
    updatedAt: '2026-10-14T09:05:00.000Z',
    running: false,
    forwards: [
      {
        name: 'grafana',
        namespace: 'monitoring',
        resourceType: 'service',
        resourceName: 'grafana',
        localPort: 13000,
        remotePort: 80,
      },
      {
        name: 'prometheus',
        namespace: 'monitoring',
        resourceType: 'service',
        resourceName: 'prometheus-server',
        localPort: 19090,
        remotePort: 9090,
      },
    ],
  },
  {
    id: 'c27b9a4f10e6d833',
    name: 'payments-debug',
    tags: ['prod', 'payments'],
    updatedAt: '2026-09-30T13:18:00.000Z',
    running: false,
    forwards: [
      {
        name: 'ledger',
        namespace: 'payments',
        resourceType: 'deployment',
        resourceName: 'ledger',
        localPort: 18443,
        remotePort: 8443,
      },
    ],
  },
];

let running: RunningTemplate[] =
  params.has('empty') || params.has('idle')
    ? []
    : [
        {
          templateId: templates[0].id,
          templateName: templates[0].name,
          clusterId: clusters[0].id,
          clusterName: clusters[0].name,
          pid: 48213,
          startedAt: '2026-10-22T07:58:00.000Z',
          source: params.has('cli') ? 'cli' : 'app',
          controllable: !params.has('cli'),
          // redis is down, to show the error state
          forwards: templates[0].forwards.map((f) => ({
            ...f,
            secrets: f.secrets ?? [],
            configMaps: f.configMaps ?? [],
            listening: f.name !== 'redis',
            ...(params.has('cli')
              ? {}
              : f.name === 'redis'
                ? {
                    status: 'error' as const,
                    connections: 0,
                    error: "No running pods found for service 'redis-master'",
                  }
                : {
                    status: 'running' as const,
                    connections: f.name === 'postgres' ? 2 : 0,
                    pod: f.name === 'api' ? 'shop-api-6f8c9d7b54-7xk2p' : 'postgres-0',
                  }),
          })),
        },
      ];

const logs: LogLine[] = [
  {
    time: '2026-10-22T07:58:01.000Z',
    level: 'info',
    forward: 'api',
    message: 'Forwarding 127.0.0.1:18080 -> shop-api-6f8c9d7b54-7xk2p:8080',
  },
  {
    time: '2026-10-22T07:58:01.000Z',
    level: 'info',
    forward: 'postgres',
    message: 'Forwarding 127.0.0.1:15432 -> postgres-0:5432',
  },
  {
    time: '2026-10-22T07:58:01.000Z',
    level: 'error',
    forward: 'redis',
    message: "Failed to start port-forward: No running pods found for service 'redis-master'",
  },
  {
    time: '2026-10-22T08:03:12.000Z',
    level: 'debug',
    forward: 'postgres',
    message: 'Connection opened',
  },
  {
    time: '2026-10-22T08:03:14.000Z',
    level: 'debug',
    forward: 'postgres',
    message: 'Connection opened',
  },
];

// ?theme=dark|light, ?empty=1 (first run) and ?idle=1 (nothing running) let design reviews screenshot every state
const theme = (params.get('theme') as Settings['theme'] | null) ?? 'system';
if (params.has('empty')) {
  clusters.length = 0;
  templates.length = 0;
}
if (params.has('idle')) templates.forEach((t) => (t.running = false));

let settings: Settings = {
  language: 'en',
  theme,
  lastUsedCluster: clusters[1]?.id,
  productionClusters: [clusters[3]?.id].filter(Boolean) as string[],
};

console.assert(
  templates.filter((t) => t.running).length === running.length,
  'running flags match the run list'
);

// The shop namespace on every cluster; other namespaces are empty
const minutesAgo = (m: number) => new Date(Date.UTC(2026, 9, 22, 8, 0) - m * 60_000).toISOString();
const services: ServiceView[] = [
  {
    name: 'postgres',
    namespace: 'shop',
    type: 'ClusterIP',
    forwardable: true,
    ports: [{ name: 'pg', port: 5432, targetPort: 'pg', protocol: 'TCP' }],
  },
  {
    name: 'redis-master',
    namespace: 'shop',
    type: 'ClusterIP',
    forwardable: true,
    ports: [{ name: 'redis', port: 6379, targetPort: 6379, protocol: 'TCP' }],
  },
  {
    name: 'shop-api',
    namespace: 'shop',
    type: 'ClusterIP',
    forwardable: true,
    ports: [
      { name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' },
      { name: 'metrics', port: 9102, targetPort: 9102, protocol: 'TCP' },
    ],
  },
  {
    name: 'shop-web',
    namespace: 'shop',
    type: 'LoadBalancer',
    forwardable: true,
    ports: [{ name: 'https', port: 443, targetPort: 3000, protocol: 'TCP' }],
  },
  { name: 'stripe-proxy', namespace: 'shop', type: 'ExternalName', forwardable: false, ports: [] },
];
const pods: PodView[] = [
  {
    name: 'postgres-0',
    namespace: 'shop',
    status: 'Running',
    ready: 1,
    containers: 1,
    restarts: 0,
    createdAt: minutesAgo(60 * 24 * 9),
    owner: 'StatefulSet/postgres',
    ports: [{ container: 'postgres', name: 'pg', port: 5432, protocol: 'TCP' }],
  },
  {
    name: 'redis-master-0',
    namespace: 'shop',
    status: 'Running',
    ready: 1,
    containers: 1,
    restarts: 1,
    createdAt: minutesAgo(60 * 24 * 9),
    owner: 'StatefulSet/redis-master',
    ports: [{ container: 'redis', name: 'redis', port: 6379, protocol: 'TCP' }],
  },
  {
    name: 'shop-api-6f8c9d7b54-7xk2p',
    namespace: 'shop',
    status: 'Running',
    ready: 2,
    containers: 2,
    restarts: 0,
    createdAt: minutesAgo(95),
    owner: 'ReplicaSet/shop-api-6f8c9d7b54',
    ports: [
      { container: 'api', name: 'http', port: 8080, protocol: 'TCP' },
      { container: 'api', name: 'metrics', port: 9102, protocol: 'TCP' },
    ],
  },
  {
    name: 'shop-api-6f8c9d7b54-q9lmd',
    namespace: 'shop',
    status: 'CrashLoopBackOff',
    ready: 1,
    containers: 2,
    restarts: 14,
    createdAt: minutesAgo(95),
    owner: 'ReplicaSet/shop-api-6f8c9d7b54',
    ports: [
      { container: 'api', name: 'http', port: 8080, protocol: 'TCP' },
      { container: 'api', name: 'metrics', port: 9102, protocol: 'TCP' },
    ],
  },
  {
    name: 'shop-web-5d4f8b6c9-hj4tn',
    namespace: 'shop',
    status: 'Running',
    ready: 1,
    containers: 1,
    restarts: 0,
    createdAt: minutesAgo(60 * 26),
    owner: 'ReplicaSet/shop-web-5d4f8b6c9',
    ports: [{ container: 'web', port: 3000, protocol: 'TCP' }],
  },
  {
    name: 'migrate-schema-29340',
    namespace: 'shop',
    status: 'Completed',
    ready: 0,
    containers: 1,
    restarts: 0,
    createdAt: minutesAgo(60 * 3),
    owner: 'Job/migrate-schema-29340',
    ports: [],
  },
];
const namespaces = ['default', 'kube-system', 'monitoring', 'payments', 'shop'];

const mergePreview: MergePreview = {
  token: '6f1c2e9a-3b7d-4c55-9a1e-2d8f0b7c4e13',
  target: `${home}/.kube/config`,
  files: [`${home}/Downloads/qa-cluster.yaml`],
  added: ['qa-eu'],
  contexts: ['docker-desktop', 'kind-hodor', 'qa-eu'],
  skipped: [{ kind: 'user', name: 'sam', file: `${home}/Downloads/qa-cluster.yaml` }],
};

const later = <T>(value: T, ms = 350) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

export const fixtureApi: HodorApi = {
  app: {
    info: () =>
      later(
        {
          version: '0.9.0-dev',
          platform: 'darwin',
          kubectl: params.has('nokubectl') ? null : '/usr/local/bin/kubectl',
          dataDir: `${home}/.hodor`,
          defaultKubeconfig: `${home}/.kube/config`,
        },
        50
      ),
  },
  clusters: {
    list: () => later(clusters),
    health: (clusterId) =>
      later(
        health[clusterId] ?? { reachable: false, error: 'unknown' },
        clusterId.includes('staging') ? 1600 : 700
      ),
    select: async (clusterId) => {
      settings = { ...settings, lastUsedCluster: clusterId };
    },
    namespaces: (clusterId) =>
      health[clusterId]?.reachable
        ? later({ namespaces, complete: !clusterId.includes('prod') })
        : Promise.reject(new Error('getaddrinfo ENOTFOUND k8s.staging.northwind.dev')),
    pods: (_id, ns) => later(ns === 'shop' ? pods : [], 500),
    services: (_id, ns) => later(ns === 'shop' ? services : [], 400),
    linkables: (_id, ns) =>
      later(
        ns === 'shop'
          ? {
              secrets: ['postgres-credentials', 'redis-auth', 'stripe-api-key'],
              configMaps: ['shop-api-config', 'shop-db-config'],
            }
          : { secrets: [], configMaps: [] },
        300
      ),
  },
  kubectl: {
    setContext: async (clusterId) => {
      clusters.forEach((c) => (c.isDefault = c.id === clusterId));
      return later(undefined, 200);
    },
    setNamespace: async (clusterId, ns) => {
      const c = clusters.find((x) => x.id === clusterId);
      if (c) c.namespace = ns;
      return later(undefined, 200);
    },
  },
  kubeconfig: {
    chooseAndPreview: () => later(mergePreview, 300),
    previewDropped: () => later(mergePreview, 300),
    previewCluster: () =>
      later(
        {
          ...mergePreview,
          files: [`${home}/.kube/prod.yaml`],
          added: ['prod-eu-west'],
          contexts: ['docker-desktop', 'kind-hodor', 'prod-eu-west'],
          skipped: [],
        },
        300
      ),
    applyMerge: () =>
      later(
        {
          target: mergePreview.target,
          backup: `${home}/.hodor/backups/config.2026-10-22T08-00-00-000Z.bak`,
          added: mergePreview.added,
        },
        400
      ),
  },
  templates: {
    list: () => later(templates),
    get: (id) => {
      const t = templates.find((x) => x.id === id);
      return t ? later(t, 150) : Promise.reject(new Error('Template not found'));
    },
    create: async (input) => {
      const t: TemplateDetail = {
        ...input,
        id: Math.random().toString(16).slice(2, 18).padEnd(16, '0'),
        updatedAt: new Date().toISOString(),
        running: false,
      };
      templates.push(t);
      return later(t, 250);
    },
    update: async (id, input) => {
      const i = templates.findIndex((x) => x.id === id);
      templates[i] = { ...templates[i], ...input, updatedAt: new Date().toISOString() };
      return later({ template: templates[i], running: templates[i].running }, 250);
    },
    remove: async (id) => {
      templates.splice(
        templates.findIndex((x) => x.id === id),
        1
      );
      running = running.filter((r) => r.templateId !== id);
    },
    reorder: async (ids) => {
      templates.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    },
    exportToFile: (ids) =>
      later(`${home}/${ids.length === 1 ? 'shop-dev' : 'templates'}.hodor.json`, 300),
    importFromFile: () => later(['qa-smoke'], 300),
    commands: async (id, options) => {
      const t = templates.find((x) => x.id === id)!;
      const ctx = options.context ? ` --context ${options.context}` : '';
      return t.forwards
        .filter((f) => !options.forward || f.name === options.forward)
        .map(
          (f) =>
            `kubectl port-forward${ctx} -n ${f.namespace} ${f.resourceType}/${f.resourceName} ${f.localPort}:${f.remotePort}`
        )
        .join('\n');
    },
  },
  running: {
    list: () => later(running),
    stop: async (templateId) => {
      running = running.filter((r) => r.templateId !== templateId);
      const t = templates.find((x) => x.id === templateId);
      if (t) t.running = false;
      return later(true, 300);
    },
    restart: () => later(true, 200),
    start: async (templateId, clusterId) => {
      const t = templates.find((x) => x.id === templateId)!;
      const c = clusters.find((x) => x.id === clusterId)!;
      t.running = true;
      running.push({
        templateId,
        templateName: t.name,
        clusterId,
        clusterName: c.name,
        pid: 1,
        startedAt: new Date().toISOString(),
        source: 'app',
        controllable: true,
        forwards: t.forwards.map((f) => ({
          ...f,
          secrets: f.secrets ?? [],
          configMaps: f.configMaps ?? [],
          listening: true,
          status: 'running',
          connections: 0,
        })),
      });
      return later(undefined, 500);
    },
    stopAll: async () => {
      const n = running.length;
      running = [];
      templates.forEach((t) => (t.running = false));
      return later(n, 300);
    },
    forward: async (templateId, name, action) => {
      const f = running
        .find((r) => r.templateId === templateId)
        ?.forwards.find((x) => x.name === name);
      if (f)
        Object.assign(
          f,
          action === 'stop'
            ? { status: 'stopped', listening: false, connections: 0, error: undefined }
            : { status: 'running', listening: true, error: undefined }
        );
      return later(undefined, 250);
    },
    logs: (_id, forward) =>
      later(
        logs.filter((l) => !forward || l.forward === forward),
        150
      ),
    linked: (_id, forward) =>
      later(
        forward === 'postgres'
          ? {
              secrets: [
                { name: 'postgres-credentials', keys: ['database', 'password', 'username'] },
              ],
              configMaps: [{ name: 'shop-db-config', keys: ['POOL_SIZE', 'SSL_MODE'] }],
            }
          : { secrets: [], configMaps: [] },
        250
      ),
    // Sample values for the preview only
    reveal: (ref) =>
      later(
        {
          text:
            ref.key === 'password'
              ? 'sample-not-a-real-password'
              : ref.key === 'POOL_SIZE'
                ? '20'
                : 'shop',
          bytes: 12,
          binary: false,
        },
        200
      ),
    copyValue: () => later(undefined, 100),
  },
  settings: {
    get: () => later(settings, 50),
    update: async (patch) => {
      settings = { ...settings, ...patch };
      return later(settings, 120);
    },
  },
};
