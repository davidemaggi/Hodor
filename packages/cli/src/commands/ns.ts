import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ContextManager, KubernetesClient } from '@hodor/core';
import { fail, requireKubectl } from '../utils/shared.js';
import { t } from '../i18n.js';

/**
 * Switch the namespace of kubectl's current context
 */
export async function nsCommand(namespaceName?: string): Promise<void> {
  await requireKubectl();

  try {
    const manager = new ContextManager();
    const currentContext = await manager.getCurrentContext();
    if (!currentContext) {
      fail(t('ns.noContext'));
    }

    const currentNamespace = (await manager.getContextNamespace()) || 'default';

    if (!namespaceName) {
      const spinner = ora(t('ns.listing', { context: currentContext })).start();
      let names: string[] | undefined;
      try {
        const client = await KubernetesClient.forContext(manager.getConfigPath(), currentContext);
        names = (await client.listNamespaces())
          .map((ns) => ns.metadata?.name || '')
          .filter(Boolean);
        spinner.stop();
      } catch {
        spinner.warn(t('ns.listFailed'));
      }

      const answer = await inquirer.prompt<{ namespace: string }>([
        names
          ? {
              type: 'list',
              name: 'namespace',
              message: t('ns.pick'),
              choices: names.map((n) => ({
                name: `${n === currentNamespace ? chalk.yellow('★ ') : '  '}${n}`,
                value: n,
                short: n,
              })),
              default: currentNamespace,
              pageSize: 15,
            }
          : {
              type: 'input',
              name: 'namespace',
              message: t('ns.input'),
              default: currentNamespace,
            },
      ]);
      namespaceName = answer.namespace;
    }

    await manager.setNamespace(namespaceName);
    console.log(
      chalk.green(`✔ ${t('ns.switched', { context: currentContext, namespace: namespaceName })}`)
    );
    console.log(chalk.dim(`  ${t('common.backupSaved')}`));
  } catch (error: any) {
    fail(error.message);
  }

  process.exit(0);
}
