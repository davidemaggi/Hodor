import chalk from 'chalk';
import { RunRegistry } from '@hodor/core';
import { fail } from '../../utils/shared.js';

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
    console.log(chalk.dim('Nothing is running. All doors are already closed.'));
    return;
  }

  const targets = options.all ? running : running.filter((r) => r.templateName === name);
  if (!options.all && !name) {
    fail('Tell me which template to stop, or use --all');
  }
  if (targets.length === 0) {
    fail(`'${name}' is not running. Running: ${running.map((r) => r.templateName).join(', ')}`);
  }

  for (const record of targets) {
    await registry.requestStop(record.templateId);
    console.log(
      chalk.green(`✔ Stopped ${record.templateName}`) + chalk.dim(` (pid ${record.pid})`)
    );
  }
}
