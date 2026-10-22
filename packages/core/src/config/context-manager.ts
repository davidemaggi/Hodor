import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';
import { KubeConfigParser, KubeConfigFile, writeFileAtomic } from './parser';
import { KubeConfigMerger } from './merger';

export interface ContextManagerOptions {
  /** Kubeconfig to manage. Defaults to the file kubectl writes to. */
  configPath?: string;
  /** Where backups go. Kept outside ~/.kube so they are not mistaken for kubeconfigs. */
  backupDir?: string;
  /** How many backups to keep per kubeconfig */
  maxBackups?: number;
}

/**
 * Manages kubectl context and namespace switching.
 *
 * Every write backs up the original file first and preserves comments/formatting.
 */
export class ContextManager {
  private parser: KubeConfigParser;
  private configPath: string;
  private backupDir: string;
  private maxBackups: number;

  constructor(options: ContextManagerOptions | string = {}) {
    const opts = typeof options === 'string' ? { configPath: options } : options;
    this.parser = new KubeConfigParser();
    this.configPath = opts.configPath || this.parser.getDefaultConfigPath();
    this.backupDir = opts.backupDir || path.join(os.homedir(), '.hodor', 'backups');
    this.maxBackups = opts.maxBackups ?? 10;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  private read(): Promise<KubeConfigFile> {
    return this.parser.parseFile(this.configPath);
  }

  /**
   * Get current context name
   */
  async getCurrentContext(): Promise<string | undefined> {
    return (await this.read())['current-context'];
  }

  /**
   * Switch to a different context
   */
  async switchContext(contextName: string): Promise<void> {
    await this.edit((doc, config) => {
      if (!config.contexts.some((ctx) => ctx.name === contextName)) {
        throw new Error(`Context '${contextName}' not found`);
      }
      doc.set('current-context', contextName);
    });
  }

  /**
   * Get namespace for a context
   */
  async getContextNamespace(contextName?: string): Promise<string | undefined> {
    const config = await this.read();
    const name = contextName || config['current-context'];
    return config.contexts.find((ctx) => ctx.name === name)?.context.namespace;
  }

  /**
   * Set namespace for a context (default: current context)
   */
  async setNamespace(namespace: string, contextName?: string): Promise<void> {
    await this.edit((doc, config) => {
      const name = contextName || config['current-context'];
      if (!name) {
        throw new Error('No context specified and no current context set');
      }

      const index = config.contexts.findIndex((ctx) => ctx.name === name);
      if (index === -1) {
        throw new Error(`Context '${name}' not found`);
      }

      doc.setIn(['contexts', index, 'context', 'namespace'], namespace);
    });
  }

  /**
   * List all available contexts
   */
  async listContexts(): Promise<Array<{ name: string; cluster: string; namespace?: string }>> {
    const config = await this.read();
    return config.contexts.map((ctx) => ({
      name: ctx.name,
      cluster: ctx.context.cluster,
      namespace: ctx.context.namespace,
    }));
  }

  /**
   * Get cluster info for a context
   */
  async getClusterInfo(contextName?: string): Promise<{ name: string; server: string } | null> {
    const config = await this.read();
    const name = contextName || config['current-context'];
    const context = config.contexts.find((ctx) => ctx.name === name);
    const cluster = context && config.clusters.find((c) => c.name === context.context.cluster);

    return cluster ? { name: cluster.name, server: cluster.cluster.server } : null;
  }

  /**
   * Merge kubeconfig files into this one. Existing entries win on name conflicts; new clusters,
   * users and contexts are appended to the YAML document, so comments and formatting survive.
   * Backs up first. Returns the backup path and the context names added.
   */
  async mergeFiles(files: string[]): Promise<{ backup: string | null; added: string[] }> {
    const plan = await new KubeConfigMerger().planMerge(this.configPath, files);

    if (!(await this.parser.configExists(this.configPath))) {
      await this.parser.writeConfig(this.configPath, plan.config);
      return { backup: null, added: plan.added };
    }

    const content = await fs.readFile(this.configPath, 'utf-8');
    const doc = YAML.parseDocument(content);
    const current = this.parser.parseContent(content);

    for (const kind of ['clusters', 'users', 'contexts'] as const) {
      const existing = new Set((current[kind] as Array<{ name: string }>).map((e) => e.name));
      const incoming = (plan.config[kind] as Array<{ name: string }>).filter(
        (e) => !existing.has(e.name)
      );
      if (incoming.length === 0) continue;
      if (!YAML.isSeq(doc.get(kind))) doc.set(kind, doc.createNode([]));
      for (const entry of incoming) doc.addIn([kind], doc.createNode(entry));
    }

    if (!current['current-context'] && plan.config['current-context']) {
      doc.set('current-context', plan.config['current-context']);
    }

    const backup = await this.backupConfig();
    await writeFileAtomic(this.configPath, doc.toString());
    return { backup, added: plan.added };
  }

  /**
   * Replace the whole kubeconfig. Backs up first. Prefer mergeFiles(), which keeps comments.
   */
  async replaceConfig(config: KubeConfigFile): Promise<string | null> {
    const backup = (await this.parser.configExists(this.configPath))
      ? await this.backupConfig()
      : null;
    await this.parser.writeConfig(this.configPath, config);
    return backup;
  }

  /**
   * Copy the current kubeconfig to the backup directory, pruning old backups
   */
  async backupConfig(): Promise<string> {
    await fs.mkdir(this.backupDir, { recursive: true, mode: 0o700 });

    const base = path.basename(this.configPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `${base}.${timestamp}.bak`);

    await fs.copyFile(this.configPath, backupPath);
    await fs.chmod(backupPath, 0o600);
    await this.pruneBackups(base);

    return backupPath;
  }

  private async pruneBackups(base: string): Promise<void> {
    const backups = (await fs.readdir(this.backupDir))
      .filter((f) => f.startsWith(`${base}.`) && f.endsWith('.bak'))
      .sort();

    for (const old of backups.slice(0, Math.max(0, backups.length - this.maxBackups))) {
      await fs.rm(path.join(this.backupDir, old), { force: true });
    }
  }

  /**
   * Edit the kubeconfig through the YAML document so comments survive
   */
  private async edit(mutate: (doc: YAML.Document, config: KubeConfigFile) => void): Promise<void> {
    const content = await fs.readFile(this.configPath, 'utf-8');
    const doc = YAML.parseDocument(content);
    const config = this.parser.parseContent(content);

    mutate(doc, config);

    await this.backupConfig();
    await writeFileAtomic(this.configPath, doc.toString());
  }
}
