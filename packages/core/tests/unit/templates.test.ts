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

  it('drops unknown fields on import, so a file cannot smuggle cluster details in', async () => {
    const { m } = await manager();
    const file = JSON.stringify({
      templates: [
        {
          name: 'x',
          server: 'https://evil',
          context: 'prod',
          tags: [],
          forwards: [{ ...fwd('a', 18000), token: 'secret' }],
        },
      ],
    });
    const [imported] = await m.importTemplates(file);
    expect(JSON.stringify(imported)).not.toMatch(/evil|prod|token|secret/);
  });

  it('rejects invalid template files with a readable message', async () => {
    const { m } = await manager();
    await expect(m.importTemplates('nope')).rejects.toThrow(/Not a JSON file/);
    await expect(m.importTemplates('{"foo":1}')).rejects.toThrow(/Not a Hodor template file/);
    await expect(
      m.importTemplates(
        JSON.stringify({ templates: [{ name: 'bad', forwards: [{ ...fwd('a', 70000) }] }] })
      )
    ).rejects.toThrow(/Template 'bad': forwards.0.localPort/);
    await expect(
      m.importTemplates(
        JSON.stringify({
          templates: [{ name: 'ns', forwards: [{ ...fwd('a', 1), namespace: 'Bad NS' }] }],
        })
      )
    ).rejects.toThrow(/namespace/);
  });

  it('renames imports whose name already exists', async () => {
    const { m } = await manager();
    await m.create({ name: 'stack', forwards: [fwd('a', 1)] });
    const file = m.exportMultiple(m.getAll().map((t) => t.id));
    const [again, third] = await m.importTemplates(file + '');
    expect(again.name).toBe('stack (2)');
    expect((await m.importTemplates(file))[0].name).toBe('stack (3)');
    expect(third).toBeUndefined();
  });

  it('keeps an explicit order', async () => {
    const { m, file } = await manager();
    const a = await m.create({ name: 'a', forwards: [fwd('a', 1)] });
    const b = await m.create({ name: 'b', forwards: [fwd('b', 2)] });
    const c = await m.create({ name: 'c', forwards: [fwd('c', 3)] });
    await m.reorder([c.id, a.id]);
    expect(m.getAll().map((t) => t.name)).toEqual(['c', 'a', 'b']);
    const reloaded = new TemplateStorage(file);
    await reloaded.initialize();
    expect(reloaded.getAll().map((t) => t.name)).toEqual(['c', 'a', 'b']);
    expect(b).toBeDefined();
  });

  it('exports templates without any cluster details and imports them as new', async () => {
    const { m } = await manager();
    const t = await m.create({
      name: 't',
      forwards: [fwd('db', 15432, { secrets: ['pg'] })],
      tags: ['x'],
    });

    const json = m.export(t.id);
    expect(json).not.toMatch(/server|context|cluster|token|"id"|createdAt/i);
    expect(JSON.parse(json)).toMatchObject({ kind: 'hodor-templates', version: 1 });

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
