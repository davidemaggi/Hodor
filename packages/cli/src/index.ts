#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '@hodor/core';

const program = new Command();

program
  .name('hodor')
  .description('🚪 Hodor - Kubernetes Port-Forward Manager')
  .version(VERSION, '-v, --version', 'Output the current version');

// Clusters command
program
  .command('clusters')
  .description('List all available Kubernetes clusters')
  .action(async () => {
    const { clustersCommand } = await import('./commands/clusters.js');
    await clustersCommand();
  });

// Context command
program
  .command('ctx')
  .alias('context')
  .description('Switch Kubernetes context')
  .argument('[context]', 'Context name to switch to')
  .action(async (context?: string) => {
    const { ctxCommand } = await import('./commands/ctx.js');
    await ctxCommand(context);
  });

// Namespace command
program
  .command('ns')
  .alias('namespace')
  .description('Switch Kubernetes namespace')
  .argument('[namespace]', 'Namespace to switch to')
  .action(async (namespace?: string) => {
    const { nsCommand } = await import('./commands/ns.js');
    await nsCommand(namespace);
  });

// Config command
program
  .command('config')
  .description('Manage kubeconfig files')
  .action(() => {
    console.log(chalk.yellow('Use subcommands: config merge'));
  });

program
  .command('config:merge')
  .description('Merge multiple kubeconfig files')
  .argument('<files...>', 'Kubeconfig files to merge')
  .option('-o, --output <file>', 'Output file path')
  .action(async (files: string[], options: { output?: string }) => {
    const { configMergeCommand } = await import('./commands/config.js');
    await configMergeCommand(files, options.output);
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
