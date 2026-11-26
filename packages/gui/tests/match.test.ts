import { describe, it, expect } from 'vitest';
import { matchOptions } from '../src/renderer/src/match';

const opts = (...labels: string[]) => labels.map((label) => ({ value: label, label }));
const labels = (xs: { label: string }[]) => xs.map((x) => x.label);

describe('matchOptions', () => {
  const namespaces = opts('default', 'kube-system', 'kube-public', 'payments', 'system-tools');

  it('returns everything for an empty or blank query', () => {
    expect(matchOptions(namespaces, '')).toBe(namespaces);
    expect(matchOptions(namespaces, '   ')).toBe(namespaces);
  });

  it('matches anywhere in the label, ignoring case', () => {
    expect(labels(matchOptions(namespaces, 'PUB'))).toEqual(['kube-public']);
  });

  it('puts the exact label first, then prefixes, then the rest, keeping order within each', () => {
    expect(labels(matchOptions(namespaces, 'system'))).toEqual(['system-tools', 'kube-system']);
    expect(labels(matchOptions(opts('a-kube', 'kube-x', 'kube'), 'kube'))).toEqual([
      'kube',
      'kube-x',
      'a-kube',
    ]);
  });

  it('needs every word of the query', () => {
    expect(labels(matchOptions(namespaces, 'kube sys'))).toEqual(['kube-system']);
    expect(matchOptions(namespaces, 'kube nope')).toEqual([]);
  });
});
