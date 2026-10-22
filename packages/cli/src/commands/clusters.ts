import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { KubernetesClient } from '@hodor/core';

/**
 * List all available Kubernetes clusters
 */
export async function clustersCommand(): Promise<void> {
  const spinner = ora('Loading clusters...').start();

  try {
    const client = new KubernetesClient();
    await client.initialize();

    const clusters = await client.getClusters();
    spinner.succeed('Clusters loaded');

    if (clusters.length === 0) {
      console.log(chalk.yellow('\nNo clusters found in kubeconfig.'));
      console.log(chalk.dim('Add clusters to ~/.kube/config or set KUBECONFIG environment variable.'));
      return;
    }

    // Create table
    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Server'),
        chalk.cyan('Context'),
        chalk.cyan('Namespace'),
        chalk.cyan('Status'),
      ],
      colWidths: [25, 40, 25, 20, 15],
    });

    // Add rows
    for (const cluster of clusters) {
      const statusIcon = cluster.isActive ? chalk.green('● Active') : chalk.dim('○ Inactive');
      const defaultIndicator = cluster.isDefault ? chalk.yellow(' (default)') : '';

      table.push([
        cluster.name + defaultIndicator,
        cluster.server,
        cluster.context,
        cluster.namespace || chalk.dim('default'),
        statusIcon,
      ]);
    }

    console.log('\n' + table.toString());

    // Summary
    const activeCount = clusters.filter((c) => c.isActive).length;
    console.log(
      chalk.dim(
        `\n${clusters.length} cluster${clusters.length !== 1 ? 's' : ''} found, ${activeCount} active`
      )
    );
  } catch (error: any) {
    spinner.fail('Failed to load clusters');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}
