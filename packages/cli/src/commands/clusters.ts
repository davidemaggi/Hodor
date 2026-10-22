import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { ClusterDiscovery } from '@hodor/core';
import { fail, openSettings } from '../utils/shared.js';

/**
 * List every context from every kubeconfig in ~/.kube, with a live reachability check
 */
export async function clustersCommand(options: { check?: boolean } = {}): Promise<void> {
  const spinner = ora('Looking for kubeconfigs...').start();

  try {
    const discovery = new ClusterDiscovery();
    const clusters = await discovery.list();

    if (clusters.length === 0) {
      spinner.stop();
      console.log(chalk.yellow('\nNo clusters found in ~/.kube.'));
      console.log(
        chalk.dim('Drop a kubeconfig in there, or merge one with: hodor config:merge <file>')
      );
      return;
    }

    const check = options.check !== false;
    spinner.text = `Knocking on ${clusters.length} door${clusters.length !== 1 ? 's' : ''}...`;
    const health = check
      ? await Promise.all(clusters.map((c) => discovery.checkHealth(c)))
      : clusters.map(() => undefined);
    spinner.stop();

    const lastUsed = (await openSettings()).get('lastUsedCluster');
    const multipleFiles = new Set(clusters.map((c) => c.sourceFile)).size > 1;

    const head = ['', 'Context', 'Server', 'Namespace', 'Status'];
    if (multipleFiles) head.push('Kubeconfig');
    const table = new Table({ head: head.map((h) => chalk.cyan(h)), style: { head: [] } });

    clusters.forEach((cluster, i) => {
      const h = health[i];
      const status = !h
        ? chalk.dim('not checked')
        : h.reachable
          ? chalk.green(`● up ${chalk.dim(h.version || '')}`)
          : chalk.red('○ unreachable');

      const marks = `${cluster.isDefault ? chalk.yellow('★') : ' '}${cluster.id === lastUsed ? chalk.magenta('↺') : ' '}`;
      const name = cluster.isDefault ? chalk.bold(cluster.name) : cluster.name;
      const row = [
        marks,
        name,
        chalk.dim(cluster.server),
        cluster.namespace || chalk.dim('default'),
        status,
      ];
      if (multipleFiles) row.push(chalk.dim(cluster.sourceFile));
      table.push(row);
    });

    console.log('\n' + table.toString());

    const up = health.filter((h) => h?.reachable).length;
    console.log(
      chalk.dim(
        `\n${clusters.length} context${clusters.length !== 1 ? 's' : ''}${check ? `, ${up} reachable` : ''}`
      ) +
        chalk.dim(
          `   ${chalk.yellow('★')} kubectl default   ${chalk.magenta('↺')} last used by Hodor`
        )
    );
  } catch (error: any) {
    spinner.stop();
    fail(`Failed to load clusters: ${error.message}`);
  }

  // Health checks that timed out may still hold sockets open
  process.exit(0);
}
