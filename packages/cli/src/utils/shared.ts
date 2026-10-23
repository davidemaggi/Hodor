import chalk from 'chalk';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prompt } from './prompt.js';
import {
  ClusterDiscovery,
  SettingsStorage,
  TemplateManager,
  TemplateStorage,
  findKubectl,
} from '@hodor/core';
import type { Cluster, Template } from '@hodor/core';
import { t } from '../i18n.js';

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
    fail(t('common.templateNotFound', { name }));
  }
  return template;
}

/** A template as one line of a list: name, tags, local ports */
export function templateLabel(template: Template): string {
  const tags = template.tags.length ? chalk.magenta(` #${template.tags.join(' #')}`) : '';
  const ports = chalk.dim(`  ${template.forwards.map((f) => `:${f.localPort}`).join(' ')}`);
  return `${template.name}${tags}${ports}`;
}

/**
 * The template named on the command line or, without a name, one picked from the list.
 * `disabled` greys out templates that can't be picked, with the reason shown next to them.
 */
export async function chooseTemplate(
  manager: TemplateManager,
  name: string | undefined,
  message: string,
  disabled?: (template: Template) => string | false
): Promise<Template> {
  if (name) return requireTemplate(manager, name);
  const templates = manager.getAll();
  if (templates.length === 0) fail(t('common.noTemplates'));
  const { id } = await prompt<{ id: string }>([
    {
      type: 'list',
      name: 'id',
      message,
      pageSize: 15,
      choices: templates.map((template) => ({
        name: templateLabel(template),
        value: template.id,
        short: template.name,
        disabled: disabled?.(template) || false,
      })),
    },
  ]);
  return templates.find((template) => template.id === id)!;
}

/** Several templates, ticked in a list (at least one) */
export async function chooseTemplates(
  manager: TemplateManager,
  message: string
): Promise<Template[]> {
  const templates = manager.getAll();
  if (templates.length === 0) fail(t('common.noTemplates'));
  const { ids } = await prompt<{ ids: string[] }>([
    {
      type: 'checkbox',
      name: 'ids',
      message: `${message} ${chalk.dim(t('common.checkboxHint'))}`,
      pageSize: 15,
      choices: templates.map((template) => ({
        name: templateLabel(template),
        value: template.id,
        short: template.name,
      })),
      validate: (picked: string[]) => picked.length > 0 || t('common.pickAtLeastOne'),
    },
  ]);
  return templates.filter((template) => ids.includes(template.id));
}

/** A file path typed by the user, checked to exist */
export async function askForFile(message: string): Promise<string> {
  const { file } = await prompt<{ file: string }>([
    {
      type: 'input',
      name: 'file',
      message,
      filter: (input: string) => expandHome(input.trim().replace(/^["']|["']$/g, '')),
      validate: (input: string) =>
        (input.length > 0 && existsSync(input)) || t('common.fileMissing', { file: input }),
    },
  ]);
  return file;
}

/** `~/x` → the home folder's x, as shells do (paths are often pasted that way) */
export function expandHome(file: string): string {
  return file === '~' || file.startsWith('~/') || file.startsWith('~\\')
    ? path.join(os.homedir(), file.slice(1))
    : file;
}

/**
 * ctx/ns change kubectl's own defaults, so they only make sense when kubectl is installed
 */
export async function requireKubectl(): Promise<void> {
  if (!(await findKubectl())) {
    fail(t('common.noKubectl'));
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
    if (!cluster) fail(t('common.clusterNotFound', { name: explicit }));
    await settings.set('lastUsedCluster', cluster.id);
    return cluster;
  }

  const clusters = await discovery.list();
  if (clusters.length === 0) {
    fail(t('common.noClusters'));
  }

  const showSource = new Set(clusters.map((c) => c.sourceFile)).size > 1;
  const lastUsed = settings.get('lastUsedCluster');
  const preselected = clusters.find((c) => c.id === lastUsed) || clusters.find((c) => c.isDefault);

  const { id } = await prompt<{ id: string }>([
    {
      type: 'list',
      name: 'id',
      message: t('common.pickCluster', { hint: chalk.dim(t('common.pickClusterHint')) }),
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
