import { describe, it, expect, vi } from 'vitest';
import { LogCapture } from '../../src/kubernetes/log-capture';

describe('LogCapture', () => {
  it('keeps at most N entries per forward', () => {
    const logs = new LogCapture(3);
    for (let i = 0; i < 5; i++) logs.log('a', 'info', `m${i}`);
    expect(logs.getLogs('a').map((l) => l.message)).toEqual(['m2', 'm3', 'm4']);
  });

  it('filters, searches and counts', () => {
    const logs = new LogCapture();
    logs.log('a', 'info', 'connected');
    logs.log('a', 'error', 'boom');
    logs.log('b', 'warn', 'slow');
    expect(logs.getErrorCount()).toBe(1);
    expect(logs.getWarningCount('b')).toBe(1);
    expect(logs.searchLogs('BOOM').map((l) => l.forwardId)).toEqual(['a']);
    expect(logs.getRecentLogs(1, 'a')[0].message).toBe('boom');
  });

  it('emits every entry', () => {
    const logs = new LogCapture();
    const listener = vi.fn();
    logs.on('log', listener);
    logs.log('a', 'debug', 'x');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ forwardId: 'a', message: 'x' })
    );
  });
});
