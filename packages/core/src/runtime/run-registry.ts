import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface RunRecord {
  templateId: string;
  templateName: string;
  clusterId: string;
  pid: number;
  startedAt: string;
  /** Who started it. Older records have none and came from the CLI. */
  source?: 'cli' | 'app';
}

/**
 * Tracks templates running in other Hodor processes (one CLI process per `template:run`).
 *
 * Communication is file based so it works the same on every OS:
 * - `<id>.json` registers a running template and its PID
 * - `<id>.restart` asks the running process to reload the template and restart
 */
export class RunRegistry {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir || path.join(os.homedir(), '.hodor', 'run');
  }

  private recordPath(templateId: string): string {
    return path.join(this.dir, `${templateId}.json`);
  }

  private restartPath(templateId: string): string {
    return path.join(this.dir, `${templateId}.restart`);
  }

  private stopPath(templateId: string): string {
    return path.join(this.dir, `${templateId}.stop`);
  }

  async register(record: Omit<RunRecord, 'pid' | 'startedAt'>, pid = process.pid): Promise<void> {
    record = { source: 'cli', ...record };
    await fs.mkdir(this.dir, { recursive: true, mode: 0o700 });
    const full: RunRecord = { ...record, pid, startedAt: new Date().toISOString() };
    await fs.writeFile(this.recordPath(record.templateId), JSON.stringify(full, null, 2), {
      mode: 0o600,
    });
    await fs.rm(this.restartPath(record.templateId), { force: true });
  }

  async unregister(templateId: string): Promise<void> {
    await fs.rm(this.recordPath(templateId), { force: true });
    await fs.rm(this.restartPath(templateId), { force: true });
    await fs.rm(this.stopPath(templateId), { force: true });
  }

  /**
   * Running templates. Records of dead processes are cleaned up.
   */
  async list(): Promise<RunRecord[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.dir);
    } catch {
      return [];
    }

    const records: RunRecord[] = [];
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      try {
        const record = JSON.parse(
          await fs.readFile(path.join(this.dir, file), 'utf-8')
        ) as RunRecord;
        if (isProcessAlive(record.pid)) {
          records.push(record);
        } else {
          await this.unregister(record.templateId);
        }
      } catch {
        // Corrupted record, ignore
      }
    }
    return records;
  }

  async get(templateId: string): Promise<RunRecord | undefined> {
    return (await this.list()).find((r) => r.templateId === templateId);
  }

  async isRunning(templateId: string): Promise<boolean> {
    return (await this.get(templateId)) !== undefined;
  }

  /**
   * Stop a running template. A CLI run is its own process and gets terminated; an app run lives
   * inside the desktop app with other templates, so it is asked to stop through a marker file.
   */
  async requestStop(templateId: string): Promise<boolean> {
    const record = await this.get(templateId);
    if (!record) return false;

    if (record.source === 'app') {
      await fs.writeFile(this.stopPath(templateId), new Date().toISOString(), { mode: 0o600 });
      return true;
    }

    try {
      process.kill(record.pid, 'SIGTERM');
    } catch {
      // Already gone
    }
    await this.unregister(templateId);
    return true;
  }

  /**
   * Called by the desktop app for each of its runs: react to stop and restart requests from elsewhere
   */
  watchControl(
    templateId: string,
    handlers: { onStop: () => void | Promise<void>; onRestart: () => void | Promise<void> },
    intervalMs = 1000
  ): () => void {
    const stopWatchingRestart = this.watchRestart(templateId, handlers.onRestart, intervalMs);
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await fs.access(this.stopPath(templateId));
        await fs.rm(this.stopPath(templateId), { force: true });
        await handlers.onStop();
      } catch {
        // No stop requested
      } finally {
        busy = false;
      }
    }, intervalMs);

    return () => {
      clearInterval(timer);
      stopWatchingRestart();
    };
  }

  /**
   * Ask the running process to reload the template and restart its forwards
   */
  async requestRestart(templateId: string): Promise<boolean> {
    if (!(await this.isRunning(templateId))) return false;
    await fs.writeFile(this.restartPath(templateId), new Date().toISOString(), { mode: 0o600 });
    return true;
  }

  /**
   * Called by the running process: invoke `onRestart` whenever a restart is requested
   */
  watchRestart(
    templateId: string,
    onRestart: () => void | Promise<void>,
    intervalMs = 1000
  ): () => void {
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await fs.access(this.restartPath(templateId));
        await fs.rm(this.restartPath(templateId), { force: true });
        await onRestart();
      } catch {
        // No restart requested
      } finally {
        busy = false;
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    // EPERM: the process exists but belongs to someone else
    return error?.code === 'EPERM';
  }
}
