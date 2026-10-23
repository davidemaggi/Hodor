import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const load = (lang: string) =>
  JSON.parse(readFileSync(join(__dirname, '../src/renderer/src/locales', `${lang}.json`), 'utf8'));
const en = load('en');
const italian = load('it');

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const base = (key: string) => key.replace(/_(one|other|zero|two|few|many)$/, '');
const placeholders = (s: string) =>
  [...s.matchAll(/{{\s*(\w+)\s*}}|<(\w+)>/g)].map((m) => m[1] ?? m[2]).sort();

describe('app translations', () => {
  const enKeys = flatten(en as Tree);
  const itKeys = flatten(italian as Tree);

  it('Italian covers every English key and nothing more', () => {
    const enBase = new Set([...enKeys.keys()].map(base));
    const itBase = new Set([...itKeys.keys()].map(base));
    expect([...enBase].filter((k) => !itBase.has(k))).toEqual([]);
    expect([...itBase].filter((k) => !enBase.has(k))).toEqual([]);
  });

  it('keeps the same placeholders and tags', () => {
    for (const [key, value] of enKeys) {
      const other = itKeys.get(key);
      if (other === undefined) continue;
      expect([key, placeholders(other)]).toEqual([key, placeholders(value)]);
    }
  });
});
