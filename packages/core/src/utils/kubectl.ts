import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Locate a kubectl binary on PATH. Returns undefined when kubectl is not installed.
 */
export async function findKubectl(envPath = process.env.PATH || ''): Promise<string | undefined> {
  const names =
    process.platform === 'win32' ? ['kubectl.exe', 'kubectl.cmd', 'kubectl'] : ['kubectl'];

  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        await fs.access(
          candidate,
          process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK
        );
        return candidate;
      } catch {
        // keep looking
      }
    }
  }

  return undefined;
}
