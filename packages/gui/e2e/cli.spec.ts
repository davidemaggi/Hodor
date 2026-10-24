import { test, expect } from '@playwright/test';
import * as pty from '@lydell/node-pty';
import { spawnSync } from 'child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
  existsSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

/**
 * The `hodor` command as installed: the CLI bundle run by the app's Electron in Node mode, through
 * a launcher like resources/bin/hodor(.cmd), in a real pseudo-terminal (ConPTY on Windows).
 * This is where Windows used to fail every list with ERR_USE_AFTER_CLOSE.
 * Needs `pnpm --filter @hodor/cli bundle` first.
 */
const BUNDLE = resolve(__dirname, '../../cli/bundle/hodor.mjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ELECTRON: string = require('electron');
const WINDOWS = process.platform === 'win32';

test.skip(!existsSync(BUNDLE), 'needs the CLI bundle (pnpm --filter @hodor/cli bundle)');

const KUBECONFIG = `apiVersion: v1
kind: Config
clusters:
- name: a
  cluster: {server: 'https://127.0.0.1:1'}
users:
- name: u
  user: {token: x}
contexts:
- name: alpha
  context: {cluster: a, user: u}
current-context: alpha
`;

const TEMPLATES = JSON.stringify({
  kind: 'hodor-templates',
  version: 1,
  templates: [
    {
      name: 'dns',
      tags: ['dev'],
      forwards: [
        {
          name: 'metrics',
          namespace: 'kube-system',
          resourceType: 'service',
          resourceName: 'kube-dns',
          localPort: 19153,
          remotePort: 9153,
        },
      ],
    },
  ],
});

const DOWN = '\x1b[B';
const ENTER = '\r';
// eslint-disable-next-line no-control-regex
const strip = (s: string) => s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g, '');

let home: string;
let launcher: string;
let env: Record<string, string>;

test.beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'hodor-cli-'));
  mkdirSync(join(home, '.kube'));
  writeFileSync(join(home, '.kube', 'config'), KUBECONFIG);
  writeFileSync(join(home, 'templates.json'), TEMPLATES);

  if (WINDOWS) {
    launcher = join(home, 'hodor.cmd');
    writeFileSync(
      launcher,
      `@echo off\r\nsetlocal\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n"${ELECTRON}" "${BUNDLE}" %*\r\n`
    );
  } else {
    launcher = join(home, 'hodor');
    writeFileSync(
      launcher,
      `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec "${ELECTRON}" "${BUNDLE}" "$@"\n`
    );
    chmodSync(launcher, 0o755);
  }

  env = { ...process.env, HOME: home, USERPROFILE: home, HODOR_LANG: 'en' } as Record<
    string,
    string
  >;
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.KUBECONFIG;

  const seeded = spawnSync(
    WINDOWS ? 'cmd.exe' : launcher,
    hodorArgs('template:import', 'templates.json'),
    {
      cwd: home,
      env,
      encoding: 'utf-8',
    }
  );
  expect(seeded.stdout + seeded.stderr).toContain('Imported 1 template');
});

test.afterEach(() => rmSync(home, { recursive: true, force: true }));

function hodorArgs(...args: string[]): string[] {
  return WINDOWS ? ['/d', '/c', launcher, ...args] : args;
}

/** `hodor <args>` in a pseudo-terminal */
function terminal(...args: string[]) {
  const proc = pty.spawn(WINDOWS ? 'cmd.exe' : launcher, hodorArgs(...args), {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: home,
    env,
  });
  let output = '';
  proc.onData((data) => (output += data));
  const exit = new Promise<number>((done) => proc.onExit(({ exitCode }) => done(exitCode)));
  return {
    output: () => strip(output),
    /** Run the steps; on failure, show what the terminal said */
    async steps(body: () => Promise<void>) {
      try {
        await body();
      } catch (error) {
        console.log(`--- hodor ${args.join(' ')} said:\n${strip(output)}\n---`);
        throw error;
      } finally {
        proc.kill();
      }
    },
    /** Wait for some text, then type */
    async answer(text: string, keys: string) {
      await expect.poll(() => strip(output), { timeout: 20_000 }).toContain(text);
      proc.write(keys);
    },
    /** Wait for the last words, then for the process to exit by itself */
    async ends(text: string) {
      await expect.poll(() => strip(output), { timeout: 30_000 }).toContain(text);
      return Promise.race([
        exit,
        new Promise<string>((done) => setTimeout(() => done('still running'), 10_000)),
      ]);
    },
  };
}

test('template:run without a name: pick the template, then the cluster', async () => {
  const hodor = terminal('template:run');
  await hodor.steps(async () => {
    await hodor.answer('Which template?', ENTER);
    await hodor.answer('Run on which cluster?', ENTER);
    // The fake cluster refuses connections: getting this far means both lists took the answers
    expect(await hodor.ends('No forward could be started')).toBe(1);
    expect(hodor.output()).not.toContain('ERR_USE_AFTER_CLOSE');
  });
});

test('hodor on its own: the menu leads to deleting a template', async () => {
  const hodor = terminal();
  await hodor.steps(async () => {
    // Run, Stop, List, Create, Edit, Delete
    await hodor.answer('What do you need?', DOWN.repeat(5) + ENTER);
    await hodor.answer('Delete which template?', ENTER);
    await hodor.answer("delete template 'dns'?", `y${ENTER}`);
    expect(await hodor.ends("Template 'dns' deleted")).toBe(0);
    expect(hodor.output()).not.toContain('ERR_USE_AFTER_CLOSE');
  });
});

test('config:export without names: tick the contexts, then choose the file', async () => {
  const hodor = terminal('config:export');
  await hodor.steps(async () => {
    await hodor.answer('Export which contexts?', ' ' + ENTER);
    await hodor.answer('Save to', ENTER);
    expect(await hodor.ends('Saved 1 context to alpha.kubeconfig.yaml')).toBe(0);
  });
  const saved = readFileSync(join(home, 'alpha.kubeconfig.yaml'), 'utf-8');
  expect(saved).toContain('name: alpha');
  expect(saved).toContain('token: x');
});

test('config:merge at a terminal: tick contexts, choose the kubeconfig, see the plan', async () => {
  writeFileSync(
    join(home, 'qa.yaml'),
    KUBECONFIG.replace(/alpha/g, 'qa').replace("'https://127.0.0.1:1'", "'https://127.0.0.1:9'")
  );
  const hodor = terminal('config:merge', 'qa.yaml');
  await hodor.steps(async () => {
    await hodor.answer('Which contexts?', ENTER);
    await hodor.answer('Into which kubeconfig?', ENTER);
    await hodor.answer('Add 1 context to', ENTER);
    expect(await hodor.ends('Added 1 context to')).toBe(0);
  });
  expect(readFileSync(join(home, '.kube', 'config'), 'utf-8')).toContain('name: qa');
});

test('without a terminal it asks for the argument instead of hanging', async () => {
  // On Windows the CLI opens the console itself, so a pipe alone doesn't make it non-interactive
  test.skip(WINDOWS, 'Windows reads answers from the console');
  const result = spawnSync(launcher, ['template:run'], {
    cwd: home,
    env,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 20_000,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("there's no terminal to ask in");
});
