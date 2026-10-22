#!/usr/bin/env node

import { Command } from 'commander';
import { VERSION } from '@hodor/core';

const program = new Command();

program
  .name('hodor')
  .description('🚪 Hodor - Kubernetes Port-Forward Manager')
  .version(VERSION, '-v, --version', 'Output the current version');

// Clusters command
program
  .command('clusters')
  .description('List every context in ~/.kube and check which ones are up')
  .option('--no-check', 'Skip the reachability check')
  .action(async (options: { check?: boolean }) => {
    const { clustersCommand } = await import('./commands/clusters.js');
    await clustersCommand(options);
  });

// Context command
program
  .command('ctx')
  .alias('context')
  .description("Change kubectl's default context (needs kubectl)")
  .argument('[context]', 'Context name to switch to')
  .action(async (context?: string) => {
    const { ctxCommand } = await import('./commands/ctx.js');
    await ctxCommand(context);
  });

// Namespace command
program
  .command('ns')
  .alias('namespace')
  .description("Change the namespace of kubectl's current context (needs kubectl)")
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
    program.outputHelp();
  });

program
  .command('config:merge')
  .description('Merge kubeconfig files into your default kubeconfig (backed up first)')
  .argument('<files...>', 'Kubeconfig files to merge')
  .option('-o, --output <file>', 'Write the result to another file instead')
  .option('-y, --yes', 'Do not ask for confirmation')
  .action(async (files: string[], options: { output?: string; yes?: boolean }) => {
    const { configMergeCommand } = await import('./commands/config.js');
    await configMergeCommand(files, options);
  });

// Template commands
program
  .command('template')
  .description('Manage port-forward templates')
  .action(() => {
    program.outputHelp();
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
  .option('-c, --cluster <cluster>', 'Context name (or id) to run on')
  .option('-l, --logs', 'Stream forward logs')
  .action(async (name: string, options: { cluster?: string; logs?: boolean }) => {
    const { templateRunCommand } = await import('./commands/template/run.js');
    await templateRunCommand(name, options);
  });

program
  .command('template:stop')
  .description('Stop a running template')
  .argument('[name]', 'Template name')
  .option('-a, --all', 'Stop every running template')
  .action(async (name: string | undefined, options: { all?: boolean }) => {
    const { templateStopCommand } = await import('./commands/template/stop.js');
    await templateStopCommand(name, options);
  });

program
  .command('template:edit')
  .description('Edit a template (details, forwards, order)')
  .argument('<name>', 'Template name')
  .action(async (name: string) => {
    const { templateEditCommand } = await import('./commands/template/edit.js');
    await templateEditCommand(name);
  });

program
  .command('template:command')
  .alias('template:cmd')
  .description('Print the plain kubectl commands for a template')
  .argument('<name>', 'Template name')
  .option('-f, --forward <name>', 'Only this forward')
  .option('-p, --platform <platform>', 'linux, macos or windows (PowerShell)')
  .option('--context <context>', 'kubectl context to target')
  .option('-s, --script', 'Print a full script that starts and stops every forward')
  .action(
    async (
      name: string,
      options: { forward?: string; platform?: string; context?: string; script?: boolean }
    ) => {
      const { templateCommandCommand } = await import('./commands/template/command.js');
      await templateCommandCommand(name, options);
    }
  );

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
