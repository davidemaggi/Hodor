import chalk from 'chalk';
import { RunRegistry } from '@hodor/core';
import { fail } from '../../utils/shared.js';
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

  const targets = options.all ? running : running.filter((r) => r.templateName === name);
  if (!options.all && !name) {
    fail(t('templates.stop.whichOne'));
  }
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
