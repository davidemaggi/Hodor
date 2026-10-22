import { describe, it, expect } from 'vitest';
import type * as k8s from '@kubernetes/client-node';
import {
  podStatus,
  summarizePod,
  summarizeService,
  ResourceBrowser,
} from '../../src/kubernetes/resources';
import { KubernetesApiError, type KubernetesClient } from '../../src/kubernetes/client';

const pod = (overrides: Partial<k8s.V1Pod> = {}): k8s.V1Pod => ({
  metadata: {
    name: 'api-7d9f-x2',
    namespace: 'shop',
    creationTimestamp: new Date('2026-10-20T08:00:00Z'),
    ownerReferences: [{ kind: 'ReplicaSet', name: 'api-7d9f', apiVersion: 'apps/v1', uid: '1' }],
  },
  spec: {
    containers: [
      { name: 'api', ports: [{ containerPort: 8080, name: 'http' }] },
      { name: 'sidecar', ports: [{ containerPort: 9090, protocol: 'UDP' }] },
    ],
  },
  status: {
    phase: 'Running',
    containerStatuses: [
      {
        name: 'api',
        ready: true,
        restartCount: 2,
        image: 'a',
        imageID: 'a',
        state: { running: {} },
      },
      {
        name: 'sidecar',
        ready: false,
        restartCount: 1,
        image: 'b',
        imageID: 'b',
        state: { running: {} },
      },
    ],
  },
  ...overrides,
});

describe('summarizePod', () => {
  it('collects readiness, restarts, owner and every container port', () => {
    expect(summarizePod(pod())).toEqual({
      name: 'api-7d9f-x2',
      namespace: 'shop',
      status: 'Running',
      ready: 1,
      containers: 2,
      restarts: 3,
      createdAt: '2026-10-20T08:00:00.000Z',
      owner: 'ReplicaSet/api-7d9f',
      ports: [
        { container: 'api', name: 'http', port: 8080, protocol: 'TCP' },
        { container: 'sidecar', name: undefined, port: 9090, protocol: 'UDP' },
      ],
    });
  });

  it('reports the waiting reason like kubectl does', () => {
    const crashing = pod();
    crashing.status!.containerStatuses![0].state = { waiting: { reason: 'CrashLoopBackOff' } };
    expect(podStatus(crashing)).toBe('CrashLoopBackOff');
    expect(podStatus(pod({ metadata: { name: 'x', deletionTimestamp: new Date() } }))).toBe(
      'Terminating'
    );
  });
});

describe('summarizeService', () => {
  it('keeps ports and marks selector-less services as not forwardable', () => {
    const svc: k8s.V1Service = {
      metadata: { name: 'db', namespace: 'shop' },
      spec: {
        selector: { app: 'db' },
        ports: [{ port: 5432, targetPort: 'pg' as any, name: 'pg' }],
      },
    };
    expect(summarizeService(svc)).toEqual({
      name: 'db',
      namespace: 'shop',
      type: 'ClusterIP',
      forwardable: true,
      ports: [{ name: 'pg', port: 5432, targetPort: 'pg', protocol: 'TCP' }],
    });
    expect(
      summarizeService({ metadata: { name: 'ext' }, spec: { type: 'ExternalName' } }).forwardable
    ).toBe(false);
  });
});

describe('ResourceBrowser', () => {
  it('falls back to the context namespace when listing namespaces is forbidden', async () => {
    const client = {
      listNamespaces: async () => {
        throw new KubernetesApiError('Failed: forbidden', 403);
      },
    } as unknown as KubernetesClient;
    expect(await new ResourceBrowser(client, 'team-a').namespaces()).toEqual({
      namespaces: ['team-a'],
      complete: false,
    });
  });

  it('rethrows other errors', async () => {
    const client = {
      listNamespaces: async () => {
        throw new KubernetesApiError('Failed: boom', 500);
      },
    } as unknown as KubernetesClient;
    await expect(new ResourceBrowser(client).namespaces()).rejects.toThrow(/boom/);
  });

  it('sorts pods and services by name', async () => {
    const client = {
      listPods: async () => [pod({ metadata: { name: 'b' } }), pod({ metadata: { name: 'a' } })],
      listServices: async () => [{ metadata: { name: 'z' } }, { metadata: { name: 'm' } }],
    } as unknown as KubernetesClient;
    const browser = new ResourceBrowser(client);
    expect((await browser.pods('x')).map((p) => p.name)).toEqual(['a', 'b']);
    expect((await browser.services('x')).map((s) => s.name)).toEqual(['m', 'z']);
  });
});

import { decodeValue, keysOf, valueOf } from '../../src/kubernetes/resources';

describe('secret and config map values', () => {
  it('decodes text and flags binary', () => {
    expect(decodeValue(Buffer.from('s3cr3t').toString('base64'))).toEqual({
      text: 's3cr3t',
      bytes: 6,
      binary: false,
    });
    expect(decodeValue(Buffer.from([0xff, 0x00, 0x10]).toString('base64'))).toEqual({
      bytes: 3,
      binary: true,
    });
  });

  it('lists keys without values and reads one value per kind', () => {
    const secret = {
      data: {
        password: Buffer.from('pw').toString('base64'),
        user: Buffer.from('me').toString('base64'),
      },
    };
    expect(keysOf(secret)).toEqual(['password', 'user']);
    expect(valueOf('secret', secret, 'password')?.text).toBe('pw');
    const cm = {
      data: { 'app.env': 'A=1' },
      binaryData: { logo: Buffer.from([0xff]).toString('base64') },
    };
    expect(keysOf(cm)).toEqual(['app.env', 'logo']);
    expect(valueOf('configMap', cm, 'app.env')).toEqual({ text: 'A=1', bytes: 3, binary: false });
    expect(valueOf('configMap', cm, 'logo')?.binary).toBe(true);
    expect(valueOf('configMap', cm, 'missing')).toBeUndefined();
  });
});
