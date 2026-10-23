import { Command, Help } from 'commander';
import { VERSION } from '@hodor/core';
import { initI18n, t } from './i18n.js';

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
  .argument('<files...>', t('help.configMerge.files'))
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
  .argument('<name>', t('help.args.templateName'))
  .option('-c, --cluster <cluster>', t('help.templateRun.cluster'))
  .option('-l, --logs', t('help.templateRun.logs'))
  .action(async (name: string, options: { cluster?: string; logs?: boolean }) => {
    const { templateRunCommand } = await import('./commands/template/run.js');
    await templateRunCommand(name, options);
  });

program
  .command('template:stop')
  .description(t('help.templateStop.description'))
  .argument('[name]', t('help.args.templateName'))
  .option('-a, --all', t('help.templateStop.all'))
  .action(async (name: string | undefined, options: { all?: boolean }) => {
    const { templateStopCommand } = await import('./commands/template/stop.js');
    await templateStopCommand(name, options);
  });

program
  .command('template:edit')
  .description(t('help.templateEdit.description'))
  .argument('<name>', t('help.args.templateName'))
  .action(async (name: string) => {
    const { templateEditCommand } = await import('./commands/template/edit.js');
    await templateEditCommand(name);
  });

program
  .command('template:command')
  .alias('template:cmd')
  .description(t('help.templateCommand.description'))
  .argument('<name>', t('help.args.templateName'))
  .option('-f, --forward <name>', t('help.templateCommand.forward'))
  .option('-p, --platform <platform>', t('help.templateCommand.platform'))
  .option('--context <context>', t('help.templateCommand.context'))
  .option('-s, --script', t('help.templateCommand.script'))
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
  .description(t('help.templateDelete.description'))
  .argument('<name>', t('help.args.templateName'))
  .option('-f, --force', t('help.templateDelete.force'))
  .action(async (name: string, options: { force?: boolean }) => {
    const { templateDeleteCommand } = await import('./commands/template/delete.js');
    await templateDeleteCommand(name, options);
  });

program
  .command('template:export')
  .description(t('help.templateExport.description'))
  .argument('<name>', t('help.args.templateName'))
  .option('-o, --output <file>', t('help.templateExport.output'))
  .option('-m, --multiple <names...>', t('help.templateExport.multiple'))
  .action(async (name: string, options: { output?: string; multiple?: string[] }) => {
    const { templateExportCommand } = await import('./commands/template/export-import.js');
    await templateExportCommand(name, options);
  });

program
  .command('template:import')
  .description(t('help.templateImport.description'))
  .argument('<file>', t('help.templateImport.file'))
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
