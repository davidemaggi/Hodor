import chalk from 'chalk';
import { RunRegistry } from '@hodor/core';
import { fail } from '../../utils/shared.js';
import { prompt } from '../../utils/prompt.js';
import { t } from '../../i18n.js';

/**
 * Stop a template started by `hodor template:run` in another terminal
 */
export async function templateStopCommand(
  name: string | undefined,
  options: { all?: boolean }
): Promise<void> {
  const registry = new RunRegistry();
  const running = await registry.list();

  if (running.length === 0) {
    console.log(chalk.dim(t('templates.stop.nothingRunning')));
    return;
  }

  let all = options.all;
  if (!all && !name) {
    const ALL = '\u0000all';
    const { pick } = await prompt<{ pick: string }>([
      {
        type: 'list',
        name: 'pick',
        message: t('templates.stop.pick'),
        pageSize: 15,
        choices: [
          ...running.map((r) => ({
            name: `${r.templateName} ${chalk.dim(
              r.source === 'app' ? t('templates.stop.inApp') : `pid ${r.pid}`
            )}`,
            value: r.templateName,
            short: r.templateName,
          })),
          ...(running.length > 1
            ? [
                {
                  name: chalk.yellow(t('templates.stop.all', { count: running.length })),
                  value: ALL,
                },
              ]
            : []),
        ],
      },
    ]);
    if (pick === ALL) all = true;
    else name = pick;
  }

  const targets = all ? running : running.filter((r) => r.templateName === name);
  if (targets.length === 0) {
    fail(
      t('templates.stop.notRunning', {
        name,
        running: running.map((r) => r.templateName).join(', '),
      })
    );
  }

  for (const record of targets) {
    await registry.requestStop(record.templateId);
    console.log(
      chalk.green(`✔ ${t('templates.stop.stopped', { name: record.templateName })}`) +
        chalk.dim(` (pid ${record.pid})`)
    );
  }
}
