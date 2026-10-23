import { app } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { CliStatus } from '../shared/api';

const run = promisify(execFile);

/** The launcher shipped with the app (resources/bin/hodor or hodor.cmd) */
function launcher(): string {
  return path.join(
    process.resourcesPath,
    'bin',
    process.platform === 'win32' ? 'hodor.cmd' : 'hodor'
  );
}

function target(): string | undefined {
  if (process.platform === 'darwin') return '/usr/local/bin/hodor';
  if (process.platform === 'linux') return path.join(os.homedir(), '.local', 'bin', 'hodor');
  return undefined;
}

/** Every `hodor` on PATH, first match first */
async function onPath(): Promise<string | undefined> {
  const names = process.platform === 'win32' ? ['hodor.cmd', 'hodor.exe'] : ['hodor'];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // keep looking
      }
    }
  }
  return undefined;
}

export async function cliStatus(): Promise<CliStatus> {
  if (!app.isPackaged) return { state: 'dev' };
  if (process.platform === 'linux' && process.env.APPIMAGE) return { state: 'appimage' };

  const ours = launcher();
  const found = await onPath();
  if (found) {
    const real = await fs.realpath(found).catch(() => found);
    return {
      state: real === (await fs.realpath(ours).catch(() => ours)) ? 'installed' : 'other',
      path: found,
    };
  }

  // Not on PATH, but our link may exist (e.g. ~/.local/bin isn't on PATH, or a new terminal is needed)
  const link = target();
  if (link) {
    const real = await fs.realpath(link).catch(() => undefined);
    if (real && real === (await fs.realpath(ours).catch(() => ours)))
      return { state: 'notOnPath', path: link };
  }
  return { state: 'missing', target: link };
}

/** Put `hodor` on the PATH. macOS asks for an admin password through the system dialog. */
export async function installCli(): Promise<CliStatus> {
  if (!app.isPackaged) throw new Error('Only installed builds can install the hodor command');
  const ours = launcher();

  if (process.platform === 'darwin') {
    const quoted = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
    const shell = `mkdir -p /usr/local/bin && ln -sf ${quoted(ours)} /usr/local/bin/hodor`;
    const script = `do shell script ${JSON.stringify(shell)} with administrator privileges with prompt "Hodor wants to install the hodor command in /usr/local/bin."`;
    await run('osascript', ['-e', script]);
  } else if (process.platform === 'linux') {
    if (process.env.APPIMAGE)
      throw new Error(
        'The AppImage moves every time it runs; use the .deb, .rpm or .tar.gz to get the hodor command'
      );
    const link = target()!;
    await fs.mkdir(path.dirname(link), { recursive: true });
    await fs.rm(link, { force: true });
    await fs.symlink(ours, link);
  } else {
    // Windows: same as the installer does, in case it couldn't
    const dir = path.dirname(ours).replace(/'/g, "''");
    const ps = `$d='${dir}'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if ($p -eq $null) { $p='' }; $parts=$p -split ';' | Where-Object { $_ -ne '' }; if ($parts -notcontains $d) { [Environment]::SetEnvironmentVariable('Path', (($parts + $d) -join ';'), 'User') }`;
    await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
    return { state: 'notOnPath', path: path.dirname(ours) };
  }
  return cliStatus();
}
