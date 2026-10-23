import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { RunRegistry, TemplateManager, TemplateStorage } from '@hodor/core';
import { getLanguage, t } from '../../i18n.js';

/**
 * List all templates
 */
export async function templateListCommand(options: {
  tags?: string[];
  search?: string;
}): Promise<void> {
  const spinner = ora(t('templates.list.loading')).start();

  try {
    const storage = new TemplateStorage();
    await storage.initialize();

    const manager = new TemplateManager(storage);

    let templates = manager.getAll();

    // Apply filters
    if (options.tags && options.tags.length > 0) {
      templates = manager.filterByTags(options.tags);
    }

    if (options.search) {
      templates = manager.search(options.search);
    }

    const running = new Set((await new RunRegistry().list()).map((r) => r.templateId));
    spinner.stop();

    if (templates.length === 0) {
      console.log(chalk.yellow(`\n${t('templates.list.empty')}`));
      console.log(chalk.dim(t('templates.list.emptyHint')));
      return;
    }

    // Create table
    const table = new Table({
      head: ['name', 'description', 'forwards', 'tags', 'updated'].map((k) =>
        chalk.cyan(t(`templates.list.table.${k}`))
      ),
      colWidths: [25, 40, 12, 30, 20],
      wordWrap: true,
    });

    // Add rows
    for (const template of templates) {
      const description = template.description || chalk.dim(t('templates.list.noDescription'));
      const tags =
        template.tags.length > 0 ? template.tags.join(', ') : chalk.dim(t('templates.list.none'));
      const updated = template.updatedAt.toLocaleDateString(getLanguage());

      table.push([
        (running.has(template.id) ? chalk.green('● ') : '  ') + chalk.bold(template.name),
        description,
        template.forwards.length.toString(),
        tags,
        updated,
      ]);
    }

    console.log('\n' + table.toString());

    // Summary
    console.log(chalk.dim(`\n${t('templates.list.found', { count: templates.length })}`));

    // Show all tags if no filter applied
    if (!options.tags && !options.search) {
      const allTags = manager.getAllTags();
      if (allTags.length > 0) {
        console.log(chalk.dim(t('templates.list.availableTags', { tags: allTags.join(', ') })));
      }
    }
  } catch (error: any) {
    spinner.fail(t('templates.list.loadFailed'));
    console.error(chalk.red(`\n${t('common.error', { error: error.message })}`));
    process.exit(1);
  }
}
