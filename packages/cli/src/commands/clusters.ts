import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { ClusterDiscovery } from '@hodor/core';
import { fail, openSettings } from '../utils/shared.js';
import { t } from '../i18n.js';

/**
 * List every context from every kubeconfig in ~/.kube, with a live reachability check
 */
export async function clustersCommand(options: { check?: boolean } = {}): Promise<void> {
  const spinner = ora(t('clusters.looking')).start();

  try {
    const discovery = new ClusterDiscovery();
    const clusters = await discovery.list();

    if (clusters.length === 0) {
      spinner.stop();
      console.log(chalk.yellow(`\n${t('clusters.empty')}`));
      console.log(chalk.dim(t('clusters.emptyHint')));
      return;
    }

    const check = options.check !== false;
    spinner.text = t('clusters.knocking', { count: clusters.length });
    const health = check
      ? await Promise.all(clusters.map((c) => discovery.checkHealth(c)))
      : clusters.map(() => undefined);
    spinner.stop();

    const lastUsed = (await openSettings()).get('lastUsedCluster');
    const multipleFiles = new Set(clusters.map((c) => c.sourceFile)).size > 1;

    const head = ['context', 'server', 'namespace', 'status'].map((k) => t(`clusters.table.${k}`));
    head.unshift('');
    if (multipleFiles) head.push(t('clusters.table.kubeconfig'));
    const table = new Table({ head: head.map((h) => chalk.cyan(h)), style: { head: [] } });

    clusters.forEach((cluster, i) => {
      const h = health[i];
      const status = !h
        ? chalk.dim(t('clusters.status.notChecked'))
        : h.reachable
          ? chalk.green(`● ${t('clusters.status.up', { version: chalk.dim(h.version || '') })}`)
          : chalk.red(`○ ${t('clusters.status.unreachable')}`);

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
        `\n${t('clusters.summary', { count: clusters.length })}${check ? t('clusters.reachable', { count: up }) : ''}`
      ) +
        chalk.dim(
          `   ${chalk.yellow('★')} ${t('clusters.legendDefault')}   ${chalk.magenta('↺')} ${t('clusters.legendLastUsed')}`
        )
    );
  } catch (error: any) {
    spinner.stop();
    fail(t('clusters.loadFailed', { error: error.message }));
  }

  // Health checks that timed out may still hold sockets open
  process.exit(0);
}
