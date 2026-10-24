import { describe, it, expect } from 'vitest';
import { codename, compareVersions, isPrerelease } from '../../src/utils/version';

describe('versions', () => {
  it('orders versions by SemVer precedence', () => {
    const sorted = [
      '1.0.0',
      '0.9.0-dev',
      '1.0.0-rc.2',
      '1.0.0-rc.10',
      '1.0.1',
      '1.0.0-rc.1',
      '2.0.0',
    ].sort(compareVersions);
    expect(sorted).toEqual([
      '0.9.0-dev',
      '1.0.0-rc.1',
      '1.0.0-rc.2',
      '1.0.0-rc.10',
      '1.0.0',
      '1.0.1',
      '2.0.0',
    ]);
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
  });

  it('names every minor after a Game of Thrones character, one letter per major', () => {
    expect(codename('1.0.0-rc.1')).toBe('Aerys');
    expect(codename('1.0.1')).toBe('Aerys');
    expect(codename('1.1.0')).toBe('Aegon');
    expect(codename('v1.1.3')).toBe('Aegon');
    expect(codename('1.2.0')).toBeUndefined();
    expect(codename('0.9.0-dev')).toBeUndefined();
  });

  it('spots pre-releases', () => {
    expect(isPrerelease('1.0.0-rc.1')).toBe(true);
    expect(isPrerelease('1.0.0')).toBe(false);
  });
});
