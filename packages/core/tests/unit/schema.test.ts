import { describe, it, expect } from 'vitest';
import { suggestLocalPort, findPortConflicts, parseTemplateFile } from '../../src/templates/schema';
import type { Template } from '../../src/types';

describe('suggestLocalPort', () => {
  it('moves ports into the 1xxxx range so they never need root', () => {
    expect(suggestLocalPort(80)).toBe(10080);
    expect(suggestLocalPort(5432)).toBe(15432);
    expect(suggestLocalPort(60000)).toBe(60000);
  });

  it('skips ports already taken', () => {
    expect(suggestLocalPort(5432, [15432, 15433])).toBe(15434);
  });
});

describe('findPortConflicts', () => {
  it('lists other templates using the same local ports', () => {
    const other = { name: 'obs', forwards: [{ name: 'grafana', localPort: 13000 }] } as Template;
    expect(findPortConflicts([{ localPort: 13000 }, { localPort: 1 }], [other])).toEqual([
      { port: 13000, template: 'obs', forward: 'grafana' },
    ]);
  });
});

describe('parseTemplateFile', () => {
  it('accepts a single legacy template object', () => {
    const one = parseTemplateFile(
      JSON.stringify({
        id: 'x',
        name: 'solo',
        tags: [],
        forwards: [
          {
            name: 'a',
            namespace: 'default',
            resourceType: 'pod',
            resourceName: 'a',
            localPort: 1,
            remotePort: 1,
          },
        ],
      })
    );
    expect(one).toHaveLength(1);
    expect(one[0]).not.toHaveProperty('id');
  });
});
