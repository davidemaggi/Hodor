import type { Cluster, ClusterHealth, Settings } from '@hodor/core';
import type { HodorApi, RunningTemplate, TemplateSummary } from '../../shared/api';

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

const templates: TemplateSummary[] = [
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
          forwards: templates[0].forwards,
        },
      ];

// ?theme=dark|light, ?empty=1 (first run) and ?idle=1 (nothing running) let design reviews screenshot every state
const theme = (params.get('theme') as Settings['theme'] | null) ?? 'system';
if (params.has('empty')) {
  clusters.length = 0;
  templates.length = 0;
}
if (params.has('idle')) templates.forEach((t) => (t.running = false));

let settings: Settings = { language: 'en', theme, lastUsedCluster: clusters[1]?.id };

console.assert(
  templates.filter((t) => t.running).length === running.length,
  'running flags match the run list'
);

const later = <T>(value: T, ms = 350) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

export const fixtureApi: HodorApi = {
  app: {
    info: () =>
      later(
        {
          version: '0.6.0-dev',
          platform: 'darwin',
          kubectl: '/usr/local/bin/kubectl',
          dataDir: `${home}/.hodor`,
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
  },
  templates: { list: () => later(templates) },
  running: {
    list: () => later(running),
    stop: async (templateId) => {
      running = running.filter((r) => r.templateId !== templateId);
      const t = templates.find((x) => x.id === templateId);
      if (t) t.running = false;
      return later(true, 300);
    },
  },
  settings: {
    get: () => later(settings, 50),
    update: async (patch) => {
      settings = { ...settings, ...patch };
      return later(settings, 120);
    },
  },
};
