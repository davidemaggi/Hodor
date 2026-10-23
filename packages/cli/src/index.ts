import { Command, Help } from 'commander';
import { VERSION } from '@hodor/core';
import { initI18n, t } from './i18n.js';
import { canPrompt } from './utils/prompt.js';

await initI18n();

const program = new Command();

// Help headings and the built-in help option/command are inherited by every subcommand
program
  .name('hodor')
  .description(t('help.program.description'))
  .version(VERSION, '-v, --version', t('help.program.version'))
  .helpOption('-h, --help', t('help.program.help'))
  .addHelpCommand('help [command]', t('help.program.help'))
  .configureHelp({
    formatHelp: (cmd, helper) =>
      Help.prototype.formatHelp
        .call(helper, cmd, helper)
        .replace(/^Usage:/m, t('help.headings.usage'))
        .replace(/^Arguments:$/m, t('help.headings.arguments'))
        .replace(/^Options:$/m, t('help.headings.options'))
        .replace(/^Commands:$/m, t('help.headings.commands')),
  });

// Clusters command
program
  .command('clusters')
  .description(t('help.clusters.description'))
  .option('--no-check', t('help.clusters.noCheck'))
  .action(async (options: { check?: boolean }) => {
    const { clustersCommand } = await import('./commands/clusters.js');
    await clustersCommand(options);
  });

// Context command
program
  .command('ctx')
  .alias('context')
  .description(t('help.ctx.description'))
  .argument('[context]', t('help.ctx.context'))
  .action(async (context?: string) => {
    const { ctxCommand } = await import('./commands/ctx.js');
    await ctxCommand(context);
  });

// Namespace command
program
  .command('ns')
  .alias('namespace')
  .description(t('help.ns.description'))
  .argument('[namespace]', t('help.ns.namespace'))
  .action(async (namespace?: string) => {
    const { nsCommand } = await import('./commands/ns.js');
    await nsCommand(namespace);
  });

// Config command
program
  .command('config')
  .description(t('help.config.description'))
  .action(() => {
    program.outputHelp();
  });

program
  .command('config:merge')
  .description(t('help.configMerge.description'))
  .argument('[files...]', t('help.configMerge.files'))
  .option('-o, --output <file>', t('help.configMerge.output'))
  .option('-y, --yes', t('help.configMerge.yes'))
  .action(async (files: string[], options: { output?: string; yes?: boolean }) => {
    const { configMergeCommand } = await import('./commands/config.js');
    await configMergeCommand(files, options);
  });

// Template commands
program
  .command('template')
  .description(t('help.template.description'))
  .action(() => {
    program.outputHelp();
  });

program
  .command('template:create')
  .alias('template:new')
  .description(t('help.templateCreate.description'))
  .action(async () => {
    const { templateCreateCommand } = await import('./commands/template/create.js');
    await templateCreateCommand();
  });

program
  .command('template:list')
  .alias('template:ls')
  .description(t('help.templateList.description'))
  .option('-t, --tags <tags...>', t('help.templateList.tags'))
  .option('-s, --search <query>', t('help.templateList.search'))
  .action(async (options: { tags?: string[]; search?: string }) => {
    const { templateListCommand } = await import('./commands/template/list.js');
    await templateListCommand(options);
  });

program
  .command('template:run')
  .description(t('help.templateRun.description'))
  .argument('[name]', t('help.args.templateNameOrPick'))
  .option('-c, --cluster <cluster>', t('help.templateRun.cluster'))
  .option('-l, --logs', t('help.templateRun.logs'))
  .action(async (name: string | undefined, options: { cluster?: string; logs?: boolean }) => {
    const { templateRunCommand } = await import('./commands/template/run.js');
    await templateRunCommand(name, options);
  });

program
  .command('template:stop')
  .description(t('help.templateStop.description'))
  .argument('[name]', t('help.args.templateNameOrPick'))
  .option('-a, --all', t('help.templateStop.all'))
  .action(async (name: string | undefined, options: { all?: boolean }) => {
    const { templateStopCommand } = await import('./commands/template/stop.js');
    await templateStopCommand(name, options);
  });

program
  .command('template:edit')
  .description(t('help.templateEdit.description'))
  .argument('[name]', t('help.args.templateNameOrPick'))
  .action(async (name: string | undefined) => {
    const { templateEditCommand } = await import('./commands/template/edit.js');
    await templateEditCommand(name);
  });

program
  .command('template:command')
  .alias('template:cmd')
  .description(t('help.templateCommand.description'))
  .argument('[name]', t('help.args.templateNameOrGuide'))
  .option('-f, --forward <name>', t('help.templateCommand.forward'))
  .option('-p, --platform <platform>', t('help.templateCommand.platform'))
  .option('--context <context>', t('help.templateCommand.context'))
  .option('-s, --script', t('help.templateCommand.script'))
  .action(
    async (
      name: string | undefined,
      options: { forward?: string; platform?: string; context?: string; script?: boolean }
    ) => {
      const { templateCommandCommand } = await import('./commands/template/command.js');
      await templateCommandCommand(name, options);
    }
  );

program
  .command('template:delete')
  .alias('template:rm')
  .description(t('help.templateDelete.description'))
  .argument('[name]', t('help.args.templateNameOrPick'))
  .option('-f, --force', t('help.templateDelete.force'))
  .action(async (name: string | undefined, options: { force?: boolean }) => {
    const { templateDeleteCommand } = await import('./commands/template/delete.js');
    await templateDeleteCommand(name, options);
  });

program
  .command('template:export')
  .description(t('help.templateExport.description'))
  .argument('[names...]', t('help.templateExport.names'))
  .option('-o, --output <file>', t('help.templateExport.output'))
  .option('-m, --multiple <names...>', t('help.templateExport.multiple'))
  .action(async (names: string[], options: { output?: string; multiple?: string[] }) => {
    const { templateExportCommand } = await import('./commands/template/export-import.js');
    await templateExportCommand(names, options);
  });

program
  .command('template:import')
  .description(t('help.templateImport.description'))
  .argument('[file]', t('help.templateImport.file'))
  .action(async (file: string | undefined) => {
    const { templateImportCommand } = await import('./commands/template/export-import.js');
    await templateImportCommand(file);
  });

// `hodor` on its own opens the menu at a terminal, and prints the help otherwise.
// The argv layout is [runtime, script, ...args] both on Node and on the app's Electron.
const args = process.argv.slice(2);
if (args.length > 0) {
  await program.parseAsync(process.argv, { from: 'node' });
} else if (canPrompt()) {
  const { mainMenu } = await import('./menu.js');
  const command = await mainMenu();
  if (command) await program.parseAsync([...process.argv.slice(0, 2), command], { from: 'node' });
} else {
  program.outputHelp();
}
