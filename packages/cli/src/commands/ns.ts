import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { KubernetesClient, ContextManager } from '@hodor/core';

/**
 * Switch Kubernetes namespace
 */
export async function nsCommand(namespaceName?: string): Promise<void> {
  try {
    const client = new KubernetesClient();
    await client.initialize();

    const manager = new ContextManager();
    const currentContext = await manager.getCurrentContext();

    if (!currentContext) {
      console.log(chalk.yellow('No active context. Use "hodor ctx" to select one.'));
      return;
    }

    // If no namespace provided, show selection prompt
    if (!namespaceName) {
      const spinner = ora('Loading namespaces...').start();

      let namespaces;
      try {
        namespaces = await client.listNamespaces();
      } catch (error) {
        spinner.fail('Failed to connect to cluster');
        console.log(chalk.yellow('\nCould not connect to cluster. Namespace list unavailable.'));
        console.log(chalk.dim('You can still enter a namespace name manually.'));

        const answer = await inquirer.prompt<{ namespace: string }>([
          {
            type: 'input',
            name: 'namespace',
            message: 'Enter namespace name:',
            default: 'default',
          },
        ]);

        namespaceName = answer.namespace;
        spinner.stop();
      }

      if (namespaces) {
        const currentNamespace = await manager.getContextNamespace();

        spinner.stop();

        const choices = namespaces.map((ns) => {
          const isCurrent = ns.metadata?.name === currentNamespace;
          const indicator = isCurrent ? chalk.green('● ') : '  ';

          return {
            name: `${indicator}${ns.metadata?.name || 'unknown'}`,
            value: ns.metadata?.name || '',
            short: ns.metadata?.name || '',
          };
        });

        const answer = await inquirer.prompt<{ namespace: string }>([
          {
            type: 'list',
            name: 'namespace',
            message: 'Select namespace:',
            choices,
            pageSize: 15,
          },
        ]);

        namespaceName = answer.namespace;
      }
    }

    if (!namespaceName) {
      console.log(chalk.yellow('No namespace selected.'));
      return;
    }

    // Set namespace
    const spinner = ora(`Setting namespace to '${namespaceName}'...`).start();

    await manager.setNamespace(namespaceName);

    spinner.succeed(chalk.green(`Namespace set to '${namespaceName}' for context '${currentContext}'`));
  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}
