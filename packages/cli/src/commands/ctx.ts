import chalk from 'chalk';
import inquirer from 'inquirer';
import { ContextManager } from '@hodor/core';
import { fail, requireKubectl } from '../utils/shared.js';

/**
 * Switch kubectl's default context
 */
export async function ctxCommand(contextName?: string): Promise<void> {
  await requireKubectl();

  try {
    const manager = new ContextManager();
    const contexts = await manager.listContexts();
    const current = await manager.getCurrentContext();

    if (contexts.length === 0) {
      fail(`No contexts in ${manager.getConfigPath()}`);
    }

    if (!contextName) {
      const answer = await inquirer.prompt<{ context: string }>([
        {
          type: 'list',
          name: 'context',
          message: 'Pick the new kubectl default:',
          choices: contexts.map((ctx) => ({
            name: `${ctx.name === current ? chalk.yellow('★ ') : '  '}${ctx.name}${ctx.namespace ? chalk.dim(` [${ctx.namespace}]`) : ''}`,
            value: ctx.name,
            short: ctx.name,
          })),
          default: current,
          pageSize: 15,
        },
      ]);
      contextName = answer.context;
    }

    if (contextName === current) {
      console.log(chalk.dim(`'${contextName}' is already the default. Hodor approves.`));
      return;
    }

    await manager.switchContext(contextName);

    console.log(chalk.green(`✔ kubectl now points to '${contextName}'`));
    const info = await manager.getClusterInfo(contextName);
    if (info) console.log(chalk.dim(`  ${info.server}`));
    console.log(chalk.dim(`  Backup of the previous kubeconfig saved in ~/.hodor/backups`));
  } catch (error: any) {
    if (/not found/.test(error.message)) {
      fail(
        `${error.message} in ${new ContextManager().getConfigPath()}. ` +
          'If it lives in another kubeconfig, merge it first: hodor config:merge <file>'
      );
    }
    fail(error.message);
  }
}
