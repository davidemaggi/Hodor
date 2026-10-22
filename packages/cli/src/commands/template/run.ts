import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import {
  TemplateManager,
  TemplateStorage,
  TemplateExecutor,
  KubernetesClient,
} from '@hodor/core';

/**
 * Run a template
 */
export async function templateRunCommand(templateName: string, options: {
  cluster?: string;
}): Promise<void> {
  try {
    const storage = new TemplateStorage();
    await storage.initialize();
    const manager = new TemplateManager(storage);

    // Find template
    const template = manager.getByName(templateName);
    if (!template) {
      console.log(chalk.red(`\nTemplate '${templateName}' not found.`));
      console.log(chalk.dim('List templates with: hodor template:list'));
      process.exit(1);
    }

    console.log(chalk.cyan(`\n🚪 Running template: ${template.name}\n`));

    // Initialize Kubernetes client
    const spinner = ora('Connecting to cluster...').start();

    const client = new KubernetesClient();
    await client.initialize();

    // Select cluster if not specified
    let clusterName = options.cluster;
    if (!clusterName) {
      const clusters = await client.getClusters();
      spinner.stop();

      if (clusters.length === 0) {
        console.log(chalk.yellow('No clusters found.'));
        process.exit(1);
      }

      const currentCluster = clusters.find((c) => c.isActive);

      const choices = clusters.map((cluster) => {
        const isCurrent = cluster.isActive;
        const indicator = isCurrent ? chalk.green('● ') : '  ';

        return {
          name: `${indicator}${cluster.name}`,
          value: cluster.name,
          short: cluster.name,
        };
      });

      const answer = await inquirer.prompt<{ cluster: string }>([
        {
          type: 'list',
          name: 'cluster',
          message: 'Select cluster to run template on:',
          choices,
          default: currentCluster?.name,
        },
      ]);

      clusterName = answer.cluster;
    }

    // Execute template
    spinner.start(`Starting ${template.forwards.length} port-forward(s)...`);

    const executor = new TemplateExecutor(client);

    // Listen to events
    executor.on('forward-started', (id: string) => {
      spinner.text = `Starting port-forwards... (${id})`;
    });

    executor.on('forward-error', (id: string, error: Error) => {
      console.log(chalk.yellow(`\n⚠ Forward ${id} failed: ${error.message}`));
    });

    const execution = await executor.execute(template, clusterName!);

    spinner.succeed(chalk.green('Template started!'));

    // Show status
    console.log(chalk.dim('\nPort-forwards:'));
    for (const forward of execution.forwards) {
      const status =
        forward.status === 'running'
          ? chalk.green('● running')
          : forward.status === 'error'
          ? chalk.red('✖ error')
          : chalk.dim('○ stopped');

      console.log(
        `  ${status} ${forward.name} → localhost:${forward.localPort} → ${forward.resourceName}:${forward.remotePort}`
      );

      if (forward.error) {
        console.log(chalk.red(`    Error: ${forward.error}`));
      }
    }

    console.log(chalk.dim(`\nStatus: ${execution.status}`));
    console.log(chalk.dim('\nPress Ctrl+C to stop all forwards'));

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log(chalk.dim('\n\nStopping template...'));
      await executor.stop(template.id);
      console.log(chalk.green('Template stopped.'));
      process.exit(0);
    });

    // Keep running
    await new Promise(() => {});
  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}
