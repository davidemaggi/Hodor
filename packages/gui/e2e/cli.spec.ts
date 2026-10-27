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

test('a production cluster takes an explicit yes', async () => {
  const id = `${resolve(home, '.kube', 'config')}::alpha`;
  writeFileSync(
    join(home, '.hodor', 'settings.json'),
    JSON.stringify({ productionClusters: [id] })
  );
  const hodor = terminal('template:run', 'dns', '-c', 'alpha');
  await hodor.steps(async () => {
    // The default answer is No
    await hodor.answer('Run dns on alpha?', ENTER);
    expect(await hodor.ends('Left alone')).toBe(0);
  });
  expect(hodor.output()).not.toContain('Holding');

  if (!WINDOWS) {
    const piped = spawnSync(launcher, ['template:run', 'dns', '-c', 'alpha'], {
      cwd: home,
      env,
      encoding: 'utf-8',
      timeout: 20_000,
    });
    expect(piped.status).toBe(1);
    expect(piped.stderr).toContain('pass --yes');
  }
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

test('template:create when the cluster is unreachable: warns, then the names are typed', async () => {
  const hodor = terminal('template:create');
  await hodor.steps(async () => {
    await hodor.answer('Template name:', `typed${ENTER}`);
    await hodor.answer('Description', ENTER);
    await hodor.answer('Tags', ENTER);
    await hodor.answer('look names up in?', ENTER);
    await hodor.answer("alpha isn't answering", '');
    await hodor.answer('Forward name:', `api${ENTER}`);
    await hodor.answer('Namespace:', `shop${ENTER}`);
    await hodor.answer('Resource type:', ENTER);
    await hodor.answer('Resource name:', `api${ENTER}`);
    await hodor.answer('Local port:', `18080${ENTER}`);
    await hodor.answer('Remote port:', `80${ENTER}`);
    await hodor.answer('Link secrets', `n${ENTER}`);
    await hodor.answer('Link configmaps', `n${ENTER}`);
    await hodor.answer('Add another', `n${ENTER}`);
    expect(await hodor.ends("Template 'typed' created")).toBe(0);
    expect(hodor.output()).not.toContain('ERR_USE_AFTER_CLOSE');
  });
});

test('template:create on a real cluster: namespace, service and port come from lists', async () => {
  const source = process.env.HODOR_E2E_KUBECONFIG;
  test.skip(!source, 'needs HODOR_E2E_KUBECONFIG');
  writeFileSync(join(home, '.kube', 'config'), readFileSync(source!, 'utf-8'));

  const hodor = terminal('template:create');
  await hodor.steps(async () => {
    await hodor.answer('Template name:', `picked${ENTER}`);
    await hodor.answer('Description', ENTER);
    await hodor.answer('Tags', ENTER);
    await hodor.answer('look names up in?', ENTER);
    // Typing filters the lists
    await hodor.answer('Namespace:', 'kube-sys');
    await hodor.answer('❯ kube-system', ENTER);
    await hodor.answer('deployment or pod in kube-system?', 'kube-dns');
    await hodor.answer('kube-dns  53, 9153', ENTER);
    // kube-dns has 53 (TCP; UDP is left out) and 9153
    await hodor.answer('Remote port:', DOWN + ENTER);
    await hodor.answer('Forward name: (kube-dns-9153)', ENTER);
    await hodor.answer('Local port: (19153)', ENTER);
    // kube-system may or may not have secrets: with none there's nothing to tick
    await expect
      .poll(() => /Secrets to link|Config maps to link/.test(hodor.output()), { timeout: 20_000 })
      .toBe(true);
    if (hodor.output().includes('Secrets to link')) await hodor.answer('Secrets to link', ENTER);
    await hodor.answer('Config maps to link', ENTER);
    await hodor.answer('Add another', `n${ENTER}`);
    expect(await hodor.ends("Template 'picked' created")).toBe(0);
  });

  const saved = JSON.parse(readFileSync(join(home, '.hodor', 'templates.json'), 'utf-8'));
  expect(saved.templates.find((t: { name: string }) => t.name === 'picked').forwards).toEqual([
    {
      name: 'kube-dns-9153',
      namespace: 'kube-system',
      resourceType: 'service',
      resourceName: 'kube-dns',
      localPort: 19153,
      remotePort: 9153,
    },
  ]);
});
