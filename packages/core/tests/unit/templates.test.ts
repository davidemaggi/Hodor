import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TemplateManager } from '../../src/templates/manager';
import { TemplateStorage } from '../../src/storage/template-storage';
import { TemplateValidator } from '../../src/templates/validator';
import type { PortForwardConfig } from '../../src/types';
import { tmpDir } from '../helpers/tmp';

const fwd = (
  name: string,
  localPort: number,
  extra: Partial<PortForwardConfig> = {}
): PortForwardConfig => ({
  name,
  namespace: 'default',
  resourceType: 'service',
  resourceName: name,
  localPort,
  remotePort: 80,
  ...extra,
});

async function manager() {
  const file = path.join(await tmpDir(), 'templates.json');
  const storage = new TemplateStorage(file);
  await storage.initialize();
  const m = new TemplateManager(storage);
  return { m, file };
}

describe('TemplateManager', () => {
  it('creates, persists and reloads templates', async () => {
    const { m, file } = await manager();
    const t = await m.create({
      name: 'stack',
      description: 'd',
      forwards: [fwd('api', 18080)],
      tags: ['dev'],
    });

    const reloaded = new TemplateStorage(file);
    await reloaded.initialize();
    expect(reloaded.get(t.id)?.name).toBe('stack');
    expect(reloaded.get(t.id)?.createdAt).toBeInstanceOf(Date);
  });

  it('rejects invalid templates', async () => {
    const { m } = await manager();
    await expect(m.create({ name: '', forwards: [fwd('a', 1)] })).rejects.toThrow(/name/);
    await expect(m.create({ name: 'x', forwards: [] })).rejects.toThrow(/at least one/);
    await expect(m.create({ name: 'x', forwards: [fwd('a', 70000)] })).rejects.toThrow(/port/);
    await expect(m.create({ name: 'x', forwards: [fwd('a', 1), fwd('a', 2)] })).rejects.toThrow(
      /Duplicate/
    );
  });

  it('searches by name, description and tags, and filters by tag', async () => {
    const { m } = await manager();
    await m.create({
      name: 'payments',
      description: 'billing stuff',
      forwards: [fwd('a', 1)],
      tags: ['prod'],
    });
    await m.create({ name: 'search', forwards: [fwd('b', 2)], tags: ['dev'] });

    expect(m.search('BILLING').map((t) => t.name)).toEqual(['payments']);
    expect(m.search('dev').map((t) => t.name)).toEqual(['search']);
    expect(m.filterByTags(['prod']).map((t) => t.name)).toEqual(['payments']);
    expect(m.getAllTags()).toEqual(['dev', 'prod']);
  });

  it('reorders, adds and removes forwards', async () => {
    const { m } = await manager();
    const t = await m.create({ name: 't', forwards: [fwd('a', 1), fwd('b', 2), fwd('c', 3)] });

    const reordered = await m.reorderForwards(t.id, [2, 0, 1]);
    expect(reordered.forwards.map((f) => f.name)).toEqual(['c', 'a', 'b']);
    await expect(m.reorderForwards(t.id, [0, 0, 1])).rejects.toThrow();

    expect((await m.removeForward(t.id, 0)).forwards.map((f) => f.name)).toEqual(['a', 'b']);
    expect((await m.addForward(t.id, fwd('d', 4))).forwards).toHaveLength(3);
  });

  it('exports templates without any cluster details and imports them as new', async () => {
    const { m } = await manager();
    const t = await m.create({
      name: 't',
      forwards: [fwd('db', 15432, { secrets: ['pg'] })],
      tags: ['x'],
    });

    const json = m.export(t.id);
    expect(json).not.toMatch(/server|context|cluster|token/i);

    const { m: other } = await manager();
    const imported = await other.import(json);
    expect(imported.id).not.toBe(t.id);
    expect(imported.forwards[0].secrets).toEqual(['pg']);
  });

  it('exports and imports several templates at once', async () => {
    const { m } = await manager();
    const a = await m.create({ name: 'a', forwards: [fwd('a', 1)] });
    const b = await m.create({ name: 'b', forwards: [fwd('b', 2)] });

    const { m: other } = await manager();
    const imported = await other.importMultiple(m.exportMultiple([a.id, b.id]));
    expect(imported.map((t) => t.name)).toEqual(['a', 'b']);
  });

  it('starts empty when the storage file is missing', async () => {
    const { m, file } = await manager();
    expect(m.getAll()).toEqual([]);
    await expect(fs.access(file)).resolves.toBeUndefined();
  });
});

describe('TemplateValidator', () => {
  const validator = new TemplateValidator();
  const base = { id: '1', name: 't', tags: [], createdAt: new Date(), updatedAt: new Date() };

  it('flags duplicate local ports', () => {
    const result = validator.validate({ ...base, forwards: [fwd('a', 8000), fwd('b', 8000)] });
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toMatch(/Duplicate local ports/);
  });

  it('accepts a sane template', () => {
    expect(validator.validate({ ...base, forwards: [fwd('a', 18000)] }).valid).toBe(true);
  });
});
