import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  ClusterDiscovery,
  SettingsStorage,
  TemplateManager,
  TemplateStorage,
  findKubectl,
} from '@hodor/core';
import type { Cluster, Template } from '@hodor/core';

export async function openTemplates(): Promise<TemplateManager> {
  const storage = new TemplateStorage();
  await storage.initialize();
  return new TemplateManager(storage);
}

export async function openSettings(): Promise<SettingsStorage> {
  const settings = new SettingsStorage();
  await settings.initialize();
  return settings;
}

export function fail(message: string): never {
  console.error(chalk.red(`\n✖ ${message}`));
  process.exit(1);
}

export function requireTemplate(manager: TemplateManager, name: string): Template {
  const template = manager.getByName(name);
  if (!template) {
    fail(`Template '${name}' not found. Hodor checked twice. Try: hodor template:list`);
  }
  return template;
}

/**
 * ctx/ns change kubectl's own defaults, so they only make sense when kubectl is installed
 */
export async function requireKubectl(): Promise<void> {
  if (!(await findKubectl())) {
    fail(
      'kubectl is not installed, so there is no kubectl default to change. Hodor itself works fine without it.'
    );
  }
}

export function clusterLabel(cluster: Cluster, showSource: boolean): string {
  const star = cluster.isDefault ? chalk.yellow('★ ') : '  ';
  const source = showSource ? chalk.dim(` (${cluster.sourceFile})`) : '';
  return `${star}${cluster.name}${source}`;
}

/**
 * Resolve the cluster to run on: explicit option, otherwise interactive with the last used one preselected
 */
export async function pickCluster(explicit?: string): Promise<Cluster> {
  const discovery = new ClusterDiscovery();
  const settings = await openSettings();

  if (explicit) {
    const cluster = await discovery.find(explicit);
    if (!cluster) fail(`Cluster '${explicit}' not found. See: hodor clusters`);
    await settings.set('lastUsedCluster', cluster.id);
    return cluster;
  }

  const clusters = await discovery.list();
  if (clusters.length === 0) {
    fail('No clusters found in ~/.kube. Hodor holds doors, but there are no doors here.');
  }

  const showSource = new Set(clusters.map((c) => c.sourceFile)).size > 1;
  const lastUsed = settings.get('lastUsedCluster');
  const preselected = clusters.find((c) => c.id === lastUsed) || clusters.find((c) => c.isDefault);

  const { id } = await inquirer.prompt<{ id: string }>([
    {
      type: 'list',
      name: 'id',
      message: `Run on which cluster? ${chalk.dim('(★ = kubectl default)')}`,
      choices: clusters.map((c) => ({
        name: clusterLabel(c, showSource),
        value: c.id,
        short: c.name,
      })),
      default: preselected?.id,
      pageSize: 15,
    },
  ]);

  await settings.set('lastUsedCluster', id);
  return clusters.find((c) => c.id === id)!;
}
