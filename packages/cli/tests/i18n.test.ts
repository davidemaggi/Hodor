import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = path.join(ROOT, 'src', 'locales');
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

type Messages = { [key: string]: string | Messages };

function load(lang: string): Messages {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, `${lang}.json`), 'utf-8'));
}

/** Flatten nested keys to `a.b.c` */
function flatten(messages: Messages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else Object.assign(out, flatten(value, full));
  }
  return out;
}

/** Normalised key (plural suffix stripped) -> sorted set of placeholders across all its forms */
function placeholdersByKey(messages: Messages): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const [key, value] of Object.entries(flatten(messages))) {
    const base = key.replace(PLURAL_SUFFIX, '');
    const set = map.get(base) ?? new Set<string>();
    for (const match of value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) set.add(match[1]);
    map.set(base, set);
  }
  return new Map([...map].map(([key, set]) => [key, [...set].sort()]));
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const en = placeholdersByKey(load('en'));
const itMessages = placeholdersByKey(load('it'));

describe('CLI translations', () => {
  it('en and it have exactly the same keys', () => {
    expect([...itMessages.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it('placeholders match for every key', () => {
    for (const [key, vars] of en) {
      expect({ key, vars: itMessages.get(key) }).toEqual({ key, vars });
    }
  });

  it('every literal key used in the source exists in en.json', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(path.join(ROOT, 'src'))) {
      const code = fs.readFileSync(file, 'utf-8');
      for (const match of code.matchAll(/\bt\('([\w.]+)'/g)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter((key) => !en.has(key));
    expect(missing).toEqual([]);
  });
});
