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

  it('names majors after Game of Thrones characters', () => {
    expect(codename('1.0.0-rc.1')).toBe('Aerys');
    expect(codename('1.4.2')).toBe('Aerys');
    expect(codename('0.9.0-dev')).toBeUndefined();
  });

  it('spots pre-releases', () => {
    expect(isPrerelease('1.0.0-rc.1')).toBe(true);
    expect(isPrerelease('1.0.0')).toBe(false);
  });
});
