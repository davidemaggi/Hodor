import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { RunRegistry } from '../../src/runtime/run-registry';
import { tmpDir } from '../helpers/tmp';

const record = { templateId: 't1', templateName: 'stack', clusterId: 'x::dev' };

describe('RunRegistry', () => {
  it('registers and lists live processes', async () => {
    const registry = new RunRegistry(await tmpDir());
    await registry.register(record);
    expect(await registry.isRunning('t1')).toBe(true);
    expect((await registry.list())[0]).toMatchObject({ ...record, pid: process.pid });
    await registry.unregister('t1');
    expect(await registry.list()).toEqual([]);
  });

  it('drops records of dead processes', async () => {
    const registry = new RunRegistry(await tmpDir());
    const child = spawn(process.execPath, ['-e', '']);
    await new Promise((r) => child.on('exit', r));
    await registry.register(record, child.pid!);
    expect(await registry.list()).toEqual([]);
  });

  it('stops a running process', async () => {
    const registry = new RunRegistry(await tmpDir());
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
    await registry.register(record, child.pid!);
    const exited = new Promise((r) => child.on('exit', r));
    expect(await registry.requestStop('t1')).toBe(true);
    await exited;
    expect(await registry.isRunning('t1')).toBe(false);
  });

  it('delivers restart requests to the watcher', async () => {
    const registry = new RunRegistry(await tmpDir());
    await registry.register(record);
    let restarts = 0;
    const stop = registry.watchRestart(
      't1',
      () => {
        restarts++;
      },
      20
    );
    expect(await registry.requestRestart('t1')).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
    stop();
    expect(restarts).toBe(1);
  });

  it('ignores restart requests for templates that are not running', async () => {
    const registry = new RunRegistry(await tmpDir());
    expect(await registry.requestRestart('nope')).toBe(false);
  });
});

describe('RunRegistry app runs', () => {
  it('asks app runs to stop through a marker instead of killing the app', async () => {
    const registry = new RunRegistry(await tmpDir());
    await registry.register({ ...record, source: 'app' });
    let stops = 0;
    const dispose = registry.watchControl(
      't1',
      { onStop: () => void stops++, onRestart: () => {} },
      20
    );
    expect(await registry.requestStop('t1')).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
    dispose();
    expect(stops).toBe(1);
    // the test process (the "app") is still alive and still registered until it unregisters itself
    expect(await registry.isRunning('t1')).toBe(true);
  });
});
