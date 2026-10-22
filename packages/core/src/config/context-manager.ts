import { KubeConfigParser } from './parser';
import * as fs from 'fs/promises';

/**
 * Manages kubectl context and namespace switching
 */
export class ContextManager {
  private parser: KubeConfigParser;
  private configPath: string;

  constructor(configPath?: string) {
    this.parser = new KubeConfigParser();
    this.configPath = configPath || this.parser.getDefaultConfigPath();
  }

  /**
   * Get current context name
   */
  async getCurrentContext(): Promise<string | undefined> {
    const config = await this.parser.parseFile(this.configPath);
    return config['current-context'];
  }

  /**
   * Switch to a different context
   */
  async switchContext(contextName: string): Promise<void> {
    const config = await this.parser.parseFile(this.configPath);

    // Check if context exists
    const contextExists = config.contexts.some((ctx) => ctx.name === contextName);
    if (!contextExists) {
      throw new Error(`Context '${contextName}' not found`);
    }

    // Update current context
    config['current-context'] = contextName;

    // Write back to file
    await this.parser.writeConfig(this.configPath, config);
  }

  /**
   * Get namespace for a context
   */
  async getContextNamespace(contextName?: string): Promise<string | undefined> {
    const config = await this.parser.parseFile(this.configPath);

    const name = contextName || config['current-context'];
    if (!name) {
      return undefined;
    }

    const context = config.contexts.find((ctx) => ctx.name === name);
    return context?.context.namespace;
  }

  /**
   * Set namespace for current context
   */
  async setNamespace(namespace: string, contextName?: string): Promise<void> {
    const config = await this.parser.parseFile(this.configPath);

    const name = contextName || config['current-context'];
    if (!name) {
      throw new Error('No context specified and no current context set');
    }

    const contextIndex = config.contexts.findIndex((ctx) => ctx.name === name);
    if (contextIndex === -1) {
      throw new Error(`Context '${name}' not found`);
    }

    // Update namespace
    config.contexts[contextIndex].context.namespace = namespace;

    // Write back to file
    await this.parser.writeConfig(this.configPath, config);
  }

  /**
   * List all available contexts
   */
  async listContexts(): Promise<Array<{ name: string; cluster: string; namespace?: string }>> {
    const config = await this.parser.parseFile(this.configPath);

    return config.contexts.map((ctx) => ({
      name: ctx.name,
      cluster: ctx.context.cluster,
      namespace: ctx.context.namespace,
    }));
  }

  /**
   * Get cluster info for a context
   */
  async getClusterInfo(
    contextName?: string
  ): Promise<{ name: string; server: string } | null> {
    const config = await this.parser.parseFile(this.configPath);

    const name = contextName || config['current-context'];
    if (!name) {
      return null;
    }

    const context = config.contexts.find((ctx) => ctx.name === name);
    if (!context) {
      return null;
    }

    const cluster = config.clusters.find((c) => c.name === context.context.cluster);
    if (!cluster) {
      return null;
    }

    return {
      name: cluster.name,
      server: cluster.cluster.server,
    };
  }

  /**
   * Create a backup of the current config
   */
  async backupConfig(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.configPath}.backup-${timestamp}`;

    await fs.copyFile(this.configPath, backupPath);
    return backupPath;
  }
}
