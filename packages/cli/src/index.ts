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
    console.log(chalk.yellow('Use subcommands: config:merge'));
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

// Template commands
program
  .command('template')
  .description('Manage port-forward templates')
  .action(() => {
    console.log(chalk.yellow('Use subcommands: template:create, template:list, template:run, etc.'));
  });

program
  .command('template:create')
  .alias('template:new')
  .description('Create a new port-forward template')
  .action(async () => {
    const { templateCreateCommand } = await import('./commands/template/create.js');
    await templateCreateCommand();
  });

program
  .command('template:list')
  .alias('template:ls')
  .description('List all templates')
  .option('-t, --tags <tags...>', 'Filter by tags')
  .option('-s, --search <query>', 'Search templates')
  .action(async (options: { tags?: string[]; search?: string }) => {
    const { templateListCommand } = await import('./commands/template/list.js');
    await templateListCommand(options);
  });

program
  .command('template:run')
  .description('Run a template')
  .argument('<name>', 'Template name')
  .option('-c, --cluster <cluster>', 'Cluster name to run on')
  .action(async (name: string, options: { cluster?: string }) => {
    const { templateRunCommand } = await import('./commands/template/run.js');
    await templateRunCommand(name, options);
  });

program
  .command('template:delete')
  .alias('template:rm')
  .description('Delete a template')
  .argument('<name>', 'Template name')
  .option('-f, --force', 'Skip confirmation')
  .action(async (name: string, options: { force?: boolean }) => {
    const { templateDeleteCommand } = await import('./commands/template/delete.js');
    await templateDeleteCommand(name, options);
  });

program
  .command('template:export')
  .description('Export a template')
  .argument('<name>', 'Template name')
  .option('-o, --output <file>', 'Output file path')
  .option('-m, --multiple <names...>', 'Export multiple templates')
  .action(async (name: string, options: { output?: string; multiple?: string[] }) => {
    const { templateExportCommand } = await import('./commands/template/export-import.js');
    await templateExportCommand(name, options);
  });

program
  .command('template:import')
  .description('Import a template')
  .argument('<file>', 'Template file to import')
  .action(async (file: string) => {
    const { templateImportCommand } = await import('./commands/template/export-import.js');
    await templateImportCommand(file);
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
