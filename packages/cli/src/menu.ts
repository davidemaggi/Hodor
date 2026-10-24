import chalk from 'chalk';
import inquirer from 'inquirer';
import { RunRegistry, VERSION } from '@hodor/core';
import { prompt } from './utils/prompt.js';
import { t } from './i18n.js';

/**
 * `hodor` on its own: every command, grouped by what you want to do.
 * Returns the command to run (its own questions follow), or null to quit.
 */
export async function mainMenu(): Promise<string | null> {
  const running = (await new RunRegistry().list()).length;
  console.log(
    `\n${chalk.bold('🚪 Hodor')} ${chalk.dim(`v${VERSION}`)}${
      running ? chalk.green(`  ● ${t('menu.running', { count: running })}`) : ''
    }\n`
  );

  const group = (label: string) => new inquirer.Separator(chalk.dim(`── ${label}`));
  const item = (command: string, label: string) => ({
    name: `${label} ${chalk.dim(`hodor ${command}`)}`,
    value: command,
    short: label,
  });

  const { command } = await prompt<{ command: string }>([
    {
      type: 'list',
      name: 'command',
      message: t('menu.title'),
      pageSize: 22,
      loop: false,
      choices: [
        group(t('menu.groups.forwards')),
        item('template:run', t('menu.items.run')),
        item('template:stop', t('menu.items.stop')),
        item('template:list', t('menu.items.list')),
        group(t('menu.groups.templates')),
        item('template:create', t('menu.items.create')),
        item('template:edit', t('menu.items.edit')),
        item('template:delete', t('menu.items.delete')),
        item('template:command', t('menu.items.command')),
        item('template:export', t('menu.items.export')),
        item('template:import', t('menu.items.import')),
        group(t('menu.groups.clusters')),
        item('clusters', t('menu.items.clusters')),
        item('ctx', t('menu.items.ctx')),
        item('ns', t('menu.items.ns')),
        item('config:merge', t('menu.items.merge')),
        item('config:export', t('menu.items.export_kubeconfig')),
        new inquirer.Separator(' '),
        item('help', t('menu.items.help')),
        { name: t('menu.items.quit'), value: '' },
      ],
    },
  ]);
  return command || null;
}
