import { describe, it, expect } from 'vitest';
import { KubeConfigMerger } from '../../src/config/merger';
import { KubeConfigParser } from '../../src/config/parser';
import { kubeconfig } from '../helpers/tmp';

const parse = (c: string) => new KubeConfigParser().parseContent(c);

describe('KubeConfigMerger', () => {
  const merger = new KubeConfigMerger();

  it('combines contexts and clusters from several files', () => {
    const { config, skipped } = merger.mergeWithReport([
      parse(kubeconfig({ contexts: [{ name: 'dev' }] })),
      parse(kubeconfig({ contexts: [{ name: 'prod' }] })),
    ]);
    expect(config.contexts.map((c) => c.name)).toEqual(['dev', 'prod']);
    expect(config.clusters).toHaveLength(2);
    expect(config['current-context']).toBe('dev');
    // both files define user "me"
    expect(skipped).toEqual([{ kind: 'user', name: 'me', source: 1 }]);
  });

  it('keeps the first definition on conflicts, like kubectl', () => {
    const a = parse(kubeconfig({ contexts: [{ name: 'x', namespace: 'from-a' }] }));
    const b = parse(kubeconfig({ contexts: [{ name: 'x', namespace: 'from-b' }] }));
    const { config, skipped } = merger.mergeWithReport([a, b]);
    expect(config.contexts[0].context.namespace).toBe('from-a');
    expect(skipped.map((s) => s.kind)).toContain('context');
  });

  it('refuses to merge nothing', () => {
    expect(() => merger.merge([])).toThrow();
  });
});
