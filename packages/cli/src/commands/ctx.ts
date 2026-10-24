import chalk from 'chalk';
import { prompt } from '../utils/prompt.js';
import { ContextManager, clusterId } from '@hodor/core';
import { confirmProduction, fail, requireKubectl } from '../utils/shared.js';
import { t } from '../i18n.js';

/**
 * Switch kubectl's default context
 */
export async function ctxCommand(
  contextName?: string,
  options: { yes?: boolean } = {}
): Promise<void> {
  await requireKubectl();

  try {
    const manager = new ContextManager();
    const contexts = await manager.listContexts();
    const current = await manager.getCurrentContext();

    if (contexts.length === 0) {
      fail(t('ctx.noContexts', { path: manager.getConfigPath() }));
    }

    if (!contextName) {
      const answer = await prompt<{ context: string }>([
        {
          type: 'list',
          name: 'context',
          message: t('ctx.pick'),
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
      console.log(chalk.dim(t('ctx.alreadyDefault', { name: contextName })));
      return;
    }

    await confirmProduction(
      { id: clusterId(manager.getConfigPath(), contextName), name: contextName },
      t('ctx.prodConfirm', { name: contextName }),
      options.yes
    );
    await manager.switchContext(contextName);

    console.log(chalk.green(`✔ ${t('ctx.switched', { name: contextName })}`));
    const info = await manager.getClusterInfo(contextName);
    if (info) console.log(chalk.dim(`  ${info.server}`));
    console.log(chalk.dim(`  ${t('common.backupSaved')}`));
  } catch (error: any) {
    if (/not found/.test(error.message)) {
      fail(
        t('ctx.notFoundHint', { error: error.message, path: new ContextManager().getConfigPath() })
      );
    }
    fail(error.message);
  }
}
