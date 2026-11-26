import { describe, expect, it } from 'vitest';
import type { PodView, ServiceView } from '@hodor/core';
import {
  filterChoices,
  matches,
  suggestForwardName,
  targetsOf,
  type Target,
} from '../src/utils/forward-choices.js';

const service = (name: string, extra: Partial<ServiceView> = {}): ServiceView => ({
  name,
  namespace: 'shop',
  type: 'ClusterIP',
  forwardable: true,
  ports: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' }],
  ...extra,
});

const pod = (name: string, extra: Partial<PodView> = {}): PodView => ({
  name,
  namespace: 'shop',
  status: 'Running',
  ready: 1,
  containers: 1,
  restarts: 0,
  ports: [{ container: 'app', name: 'http', port: 8080, protocol: 'TCP' }],
  ...extra,
});

describe('matches', () => {
  it('finds every word in any order, ignoring case and colours', () => {
    expect(matches('\x1b[36msvc\x1b[39m Payments-API', 'api pay')).toBe(true);
    expect(matches('svc payments-api', 'pod')).toBe(false);
  });

  it('lets everything through with no term', () => {
    expect(matches('anything', undefined)).toBe(true);
    expect(matches('anything', '   ')).toBe(true);
  });
});

describe('filterChoices', () => {
  it('searches the description too', () => {
    const choices = [
      { name: 'api', value: 1, description: '8080' },
      { name: 'web', value: 2, description: '80' },
    ];
    expect(filterChoices(choices, '8080').map((c) => c.value)).toEqual([1]);
    expect(filterChoices(choices, 'we').map((c) => c.value)).toEqual([2]);
  });
});

describe('targetsOf', () => {
  it('puts services first, then deployments, then loose pods, and drops what cannot be forwarded', () => {
    const targets = targetsOf(
      [service('web'), service('external', { forwardable: false })],
      [
        pod('debug'),
        pod('web-7d9f8c6b5d-x2x9q', { owner: 'ReplicaSet/web-7d9f8c6b5d' }),
        pod('web-7d9f8c6b5d-k8m2p', { owner: 'ReplicaSet/web-7d9f8c6b5d' }),
        pod('job-1', { status: 'Succeeded' }),
        pod('db-0', { owner: 'StatefulSet/db' }),
      ]
    );
    expect(targets.map((t) => `${t.type}/${t.name}`)).toEqual([
      'service/web',
      'deployment/web',
      'pod/debug',
      'pod/db-0',
    ]);
  });

  it("gives a deployment its replicas' ports once", () => {
    const owner = 'ReplicaSet/api-5f6d7c8b9';
    const [deployment] = targetsOf(
      [],
      [
        pod('api-5f6d7c8b9-aaaaa', { owner }),
        pod('api-5f6d7c8b9-bbbbb', {
          owner,
          ports: [
            { container: 'app', name: 'http', port: 8080, protocol: 'TCP' },
            { container: 'app', name: 'admin', port: 9000, protocol: 'TCP' },
          ],
        }),
      ]
    );
    expect(deployment.ports.map((p) => p.port)).toEqual([8080, 9000]);
  });

  it('keeps TCP ports only and labels them', () => {
    const [svc, p] = targetsOf(
      [
        service('dns', {
          ports: [
            { name: 'dns', port: 53, targetPort: 53, protocol: 'UDP' },
            { name: 'dns-tcp', port: 53, targetPort: 53, protocol: 'TCP' },
            { name: 'metrics', port: 9153, targetPort: 9153, protocol: 'TCP' },
          ],
        }),
      ],
      [pod('api')]
    );
    expect(svc.ports).toEqual([
      { port: 53, label: 'dns-tcp' },
      { port: 9153, label: 'metrics' },
    ]);
    expect(targetsOf([service('web')], [])[0].ports).toEqual([{ port: 80, label: 'http → 8080' }]);
    expect(p.ports).toEqual([{ port: 8080, label: 'http · app' }]);
  });
});

describe('suggestForwardName', () => {
  const one: Target = { type: 'service', name: 'postgres', ports: [{ port: 5432, label: '' }] };
  const two: Target = {
    type: 'service',
    name: 'web',
    ports: [
      { port: 80, label: '' },
      { port: 443, label: '' },
    ],
  };

  it('uses the resource name, plus the port when it has several', () => {
    expect(suggestForwardName(one, 5432, [])).toBe('postgres');
    expect(suggestForwardName(two, 443, [])).toBe('web-443');
  });

  it('adds a counter when the name is taken', () => {
    expect(suggestForwardName(one, 5432, ['postgres', 'postgres-2'])).toBe('postgres-3');
  });
});
