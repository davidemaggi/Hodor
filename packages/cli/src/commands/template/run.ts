import chalk from 'chalk';
import ora from 'ora';
import { ClusterDiscovery, RunRegistry, TemplateExecutor } from '@hodor/core';
import type { LogEntry, TemplateExecution } from '@hodor/core';
import { fail, openTemplates, pickCluster, requireTemplate } from '../../utils/shared.js';

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
  name: string,
  options: { cluster?: string; logs?: boolean }
): Promise<void> {
  const manager = await openTemplates();
  const template = requireTemplate(manager, name);

  const registry = new RunRegistry();
  const existing = await registry.get(template.id);
  if (existing) {
    fail(
      `'${template.name}' is already running (pid ${existing.pid}). Stop it with: hodor template:stop ${template.name}`
    );
  }

  const cluster = await pickCluster(options.cluster);
  const spinner = ora(
    `Holding ${template.forwards.length} door${template.forwards.length !== 1 ? 's' : ''} on '${cluster.name}'...`
  ).start();

  let executor: TemplateExecutor;
  try {
    executor = new TemplateExecutor(await new ClusterDiscovery().connect(cluster));
  } catch (error: any) {
    spinner.stop();
    fail(`Could not connect to '${cluster.name}': ${error.message}`);
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
    spinner.fail('No forward could be started');
    printExecution(execution);
    await executor.stop(template.id);
    process.exit(1);
  }

  spinner.succeed(
    running === execution.forwards.length
      ? chalk.green(`HODOR! ${template.name} is up on ${cluster.name}`)
      : chalk.yellow(`${template.name} is partially up (${running}/${execution.forwards.length})`)
  );
  printExecution(execution);

  await registry.register({
    templateId: template.id,
    templateName: template.name,
    clusterId: cluster.id,
  });

  const stopWatching = registry.watchRestart(template.id, async () => {
    console.log(chalk.cyan('\n↻ Template changed, restarting...'));
    const fresh = (await openTemplates()).get(template.id);
    await executor.stop(template.id);
    if (!fresh) {
      console.log(chalk.yellow('Template was deleted. Stopping.'));
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
    console.log(chalk.dim('\nLetting go of the door...'));
    await executor.stopAll();
    await registry.unregister(template.id);
    console.log(chalk.green('Stopped. Hodor rests.'));
    process.exit(code);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  console.log(
    chalk.dim(`\nCtrl+C to stop${options.logs ? '' : ' · add --logs to watch what happens'}`)
  );
}
