import { describe, it, expect } from 'vitest';
import { closeDecision } from '../src/main/close-policy';

describe('closeDecision', () => {
  it('closes normally when nothing runs or the app is quitting', () => {
    expect(closeDecision(0, false, 'darwin')).toBe('close');
    expect(closeDecision(3, true, 'win32')).toBe('close');
  });

  it('hides to the tray when templates run', () => {
    expect(closeDecision(1, false, 'darwin')).toBe('hide');
    expect(closeDecision(2, false, 'win32')).toBe('hide');
  });

  it('asks on Linux, where a tray may not exist', () => {
    expect(closeDecision(1, false, 'linux')).toBe('ask');
  });
});
