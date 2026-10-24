import chalk from 'chalk';
import ora from 'ora';
import { ClusterDiscovery, RunRegistry, TemplateExecutor } from '@hodor/core';
import type { LogEntry, TemplateExecution } from '@hodor/core';
import {
  chooseTemplate,
  confirmProduction,
  fail,
  openTemplates,
  pickCluster,
} from '../../utils/shared.js';
import { t } from '../../i18n.js';

const LEVEL_COLORS: Record<LogEntry['level'], (s: string) => string> = {
  debug: chalk.dim,
  info: chalk.cyan,
  warn: chalk.yellow,
  error: chalk.red,
};

function printExecution(execution: TemplateExecution): void {
  for (const f of execution.forwards) {
    const status =
      f.status === 'running'
        ? chalk.green('●')
        : f.status === 'error'
          ? chalk.red('✖')
          : chalk.dim('○');
    console.log(
      `  ${status} ${chalk.bold(f.name.padEnd(16))} ${chalk.cyan(`127.0.0.1:${f.localPort}`)} → ${f.namespace}/${f.resourceType}/${f.resourceName}:${f.remotePort}`
    );
    if (f.error) console.log(chalk.red(`      ${f.error}`));
  }
}

/**
 * Run a template in the foreground until Ctrl+C or `hodor template:stop`
 */
export async function templateRunCommand(
  name: string | undefined,
  options: { cluster?: string; logs?: boolean; yes?: boolean }
): Promise<void> {
  const manager = await openTemplates();
  const registry = new RunRegistry();
  const busy = new Set((await registry.list()).map((r) => r.templateId));
  const template = await chooseTemplate(
    manager,
    name,
    t('templates.run.pick'),
    (candidate) => busy.has(candidate.id) && t('templates.run.alreadyRunningShort')
  );

  const existing = await registry.get(template.id);
  if (existing) {
    fail(t('templates.run.alreadyRunning', { name: template.name, pid: existing.pid }));
  }

  const cluster = await pickCluster(options.cluster);
  await confirmProduction(
    cluster,
    t('templates.run.prodConfirm', { name: template.name, cluster: cluster.name }),
    options.yes
  );
  const spinner = ora(
    t('templates.run.holding', { count: template.forwards.length, cluster: cluster.name })
  ).start();

  let executor: TemplateExecutor;
  try {
    executor = new TemplateExecutor(await new ClusterDiscovery().connect(cluster));
  } catch (error: any) {
    spinner.stop();
    fail(t('templates.run.connectFailed', { cluster: cluster.name, error: error.message }));
  }

  if (options.logs) {
    executor.getLogCapture().on('log', (entry: LogEntry) => {
      const forward = entry.forwardId?.replace(`${template.id}-`, '') || '';
      console.log(
        `${chalk.dim(entry.timestamp.toLocaleTimeString())} ${LEVEL_COLORS[entry.level](entry.level.padEnd(5))} ${chalk.dim(forward)} ${entry.message}`
      );
    });
  }

  const execution = await executor.execute(template, cluster.id);
  const running = execution.forwards.filter((f) => f.status === 'running').length;

  if (running === 0) {
    spinner.fail(t('templates.run.noneStarted'));
    printExecution(execution);
    await executor.stop(template.id);
    process.exit(1);
  }

  spinner.succeed(
    running === execution.forwards.length
      ? chalk.green(t('templates.run.up', { name: template.name, cluster: cluster.name }))
      : chalk.yellow(
          t('templates.run.partial', {
            name: template.name,
            running,
            total: execution.forwards.length,
          })
        )
  );
  printExecution(execution);

  await registry.register({
    templateId: template.id,
    templateName: template.name,
    clusterId: cluster.id,
  });

  const stopWatching = registry.watchRestart(template.id, async () => {
    console.log(chalk.cyan(`\n↻ ${t('templates.run.changed')}`));
    const fresh = (await openTemplates()).get(template.id);
    await executor.stop(template.id);
    if (!fresh) {
      console.log(chalk.yellow(t('templates.run.deleted')));
      await shutdown(0);
      return;
    }
    printExecution(await executor.execute(fresh, cluster.id));
  });

  let shuttingDown = false;
  const shutdown = async (code: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopWatching();
    console.log(chalk.dim(`\n${t('templates.run.lettingGo')}`));
    await executor.stopAll();
    await registry.unregister(template.id);
    console.log(chalk.green(t('templates.run.stopped')));
    process.exit(code);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  console.log(
    chalk.dim(
      `\n${t('templates.run.ctrlC')}${options.logs ? '' : ` · ${t('templates.run.logsHint')}`}`
    )
  );
}
