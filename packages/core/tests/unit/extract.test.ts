import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { extractContexts } from '../../src/config/extract';
import { KubeConfigParser } from '../../src/config/parser';

const parse = (c: string) => new KubeConfigParser().parseContent(c);
const root = path.resolve('/kube');

const shop = parse(`apiVersion: v1
kind: Config
clusters:
- name: main
  cluster: {server: 'https://shop:6443', certificate-authority: certs/ca.crt}
- name: unused
  cluster: {server: 'https://unused:6443'}
users:
- name: me
  user: {client-certificate: certs/me.crt, client-key: /abs/me.key}
- name: robot
  user:
    exec: {apiVersion: client.authentication.k8s.io/v1, command: ./bin/login, args: [shop]}
contexts:
- name: shop-dev
  context: {cluster: main, user: me, namespace: shop}
- name: shop-ci
  context: {cluster: main, user: robot}
current-context: shop-ci
`);

const work = parse(`apiVersion: v1
kind: Config
clusters:
- name: main
  cluster: {server: 'https://work:6443'}
users:
- name: me
  user: {token: abc}
- name: path-exec
  user:
    exec: {apiVersion: client.authentication.k8s.io/v1, command: aws}
contexts:
- name: shop-dev
  context: {cluster: main, user: me}
- name: work
  context: {cluster: main, user: path-exec}
`);

const sources = new Map([
  [path.join(root, 'shop.yaml'), shop],
  [path.join(root, 'work.yaml'), work],
]);
const shopFile = path.join(root, 'shop.yaml');
const workFile = path.join(root, 'work.yaml');

describe('extractContexts', () => {
  it('takes only the chosen contexts, with their clusters and users, once each', () => {
    const { config, renamed } = extractContexts(sources, [
      { file: shopFile, context: 'shop-dev' },
      { file: shopFile, context: 'shop-ci' },
    ]);
    expect(config.contexts.map((c) => c.name)).toEqual(['shop-dev', 'shop-ci']);
    expect(config.clusters.map((c) => c.name)).toEqual(['main']);
    expect(config.users.map((u) => u.name)).toEqual(['me', 'robot']);
    expect(config['current-context']).toBe('shop-dev');
    expect(renamed).toEqual([]);
  });

  it('makes relative file paths absolute and leaves PATH lookups alone', () => {
    const { config } = extractContexts(sources, [
      { file: shopFile, context: 'shop-dev' },
      { file: shopFile, context: 'shop-ci' },
      { file: workFile, context: 'work' },
    ]);
    expect(config.clusters[0].cluster['certificate-authority']).toBe(
      path.join(root, 'certs', 'ca.crt')
    );
    const me = config.users.find((u) => u.name === 'me')!.user;
    expect(me['client-certificate']).toBe(path.join(root, 'certs', 'me.crt'));
    expect(me['client-key']).toBe('/abs/me.key');
    const robot = config.users.find((u) => u.name === 'robot')!.user as any;
    expect(robot.exec.command).toBe(path.join(root, 'bin', 'login'));
    const pathExec = config.users.find((u) => u.name === 'path-exec')!.user as any;
    expect(pathExec.exec.command).toBe('aws');
  });

  it('renames clashing names from another file and keeps the references right', () => {
    const { config, renamed } = extractContexts(sources, [
      { file: shopFile, context: 'shop-dev' },
      { file: workFile, context: 'shop-dev' },
    ]);
    expect(config.contexts.map((c) => c.name)).toEqual(['shop-dev', 'shop-dev-2']);
    expect(config.contexts[1].context).toMatchObject({ cluster: 'main-2', user: 'me-2' });
    expect(config.clusters.find((c) => c.name === 'main-2')!.cluster.server).toBe(
      'https://work:6443'
    );
    expect(renamed).toEqual([
      { kind: 'cluster', from: 'main', to: 'main-2', file: workFile },
      { kind: 'user', from: 'me', to: 'me-2', file: workFile },
      { kind: 'context', from: 'shop-dev', to: 'shop-dev-2', file: workFile },
    ]);
  });

  it('ignores a context picked twice', () => {
    const { config } = extractContexts(sources, [
      { file: shopFile, context: 'shop-dev' },
      { file: shopFile, context: 'shop-dev' },
    ]);
    expect(config.contexts).toHaveLength(1);
  });

  it('says what is missing', () => {
    expect(() => extractContexts(sources, [{ file: shopFile, context: 'nope' }])).toThrow(
      /Context 'nope' isn't in/
    );
    expect(() => extractContexts(sources, [])).toThrow(/No contexts/);
    const broken = parse(`apiVersion: v1
kind: Config
clusters: []
users: []
contexts:
- name: x
  context: {cluster: gone, user: me}
`);
    expect(() =>
      extractContexts(new Map([['/k/b', broken]]), [{ file: '/k/b', context: 'x' }])
    ).toThrow(/uses cluster 'gone'/);
  });
});
