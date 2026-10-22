import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ContextManager, KubernetesClient } from '@hodor/core';
import { fail, requireKubectl } from '../utils/shared.js';

/**
 * Switch the namespace of kubectl's current context
 */
export async function nsCommand(namespaceName?: string): Promise<void> {
  await requireKubectl();

  try {
    const manager = new ContextManager();
    const currentContext = await manager.getCurrentContext();
    if (!currentContext) {
      fail('kubectl has no current context. Pick one first: hodor ctx');
    }

    const currentNamespace = (await manager.getContextNamespace()) || 'default';

    if (!namespaceName) {
      const spinner = ora(`Listing namespaces in '${currentContext}'...`).start();
      let names: string[] | undefined;
      try {
        const client = await KubernetesClient.forContext(manager.getConfigPath(), currentContext);
        names = (await client.listNamespaces())
          .map((ns) => ns.metadata?.name || '')
          .filter(Boolean);
        spinner.stop();
      } catch {
        spinner.warn('Could not list namespaces (cluster unreachable or no permission).');
      }

      const answer = await inquirer.prompt<{ namespace: string }>([
        names
          ? {
              type: 'list',
              name: 'namespace',
              message: 'Pick a namespace:',
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
              message: 'Namespace name:',
              default: currentNamespace,
            },
      ]);
      namespaceName = answer.namespace;
    }

    await manager.setNamespace(namespaceName);
    console.log(chalk.green(`✔ '${currentContext}' now defaults to namespace '${namespaceName}'`));
    console.log(chalk.dim(`  Backup of the previous kubeconfig saved in ~/.hodor/backups`));
  } catch (error: any) {
    fail(error.message);
  }

  process.exit(0);
}
