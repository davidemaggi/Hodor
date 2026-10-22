import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ContextManager } from '@hodor/core';

/**
 * Switch Kubernetes context
 */
export async function ctxCommand(contextName?: string): Promise<void> {
  try {
    const manager = new ContextManager();

    // If no context provided, show selection prompt
    if (!contextName) {
      const spinner = ora('Loading contexts...').start();

      const contexts = await manager.listContexts();
      const currentContext = await manager.getCurrentContext();

      spinner.stop();

      if (contexts.length === 0) {
        console.log(chalk.yellow('No contexts found in kubeconfig.'));
        return;
      }

      const choices = contexts.map((ctx) => {
        const isCurrent = ctx.name === currentContext;
        const indicator = isCurrent ? chalk.green('● ') : '  ';
        const namespace = ctx.namespace ? chalk.dim(` [${ctx.namespace}]`) : '';

        return {
          name: `${indicator}${ctx.name}${namespace}`,
          value: ctx.name,
          short: ctx.name,
        };
      });

      const answer = await inquirer.prompt<{ context: string }>([
        {
          type: 'list',
          name: 'context',
          message: 'Select context:',
          choices,
          pageSize: 15,
        },
      ]);

      contextName = answer.context;
    }

    // Switch context
    const spinner = ora(`Switching to context '${contextName}'...`).start();

    await manager.switchContext(contextName);

    spinner.succeed(chalk.green(`Switched to context '${contextName}'`));

    // Show cluster info
    const clusterInfo = await manager.getClusterInfo(contextName);
    if (clusterInfo) {
      console.log(chalk.dim(`  Cluster: ${clusterInfo.name}`));
      console.log(chalk.dim(`  Server: ${clusterInfo.server}`));
    }

    const namespace = await manager.getContextNamespace(contextName);
    if (namespace) {
      console.log(chalk.dim(`  Namespace: ${namespace}`));
    }
  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}
