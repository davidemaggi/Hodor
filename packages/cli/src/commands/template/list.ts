import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { TemplateManager, TemplateStorage } from '@hodor/core';

/**
 * List all templates
 */
export async function templateListCommand(options: {
  tags?: string[];
  search?: string;
}): Promise<void> {
  const spinner = ora('Loading templates...').start();

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

    spinner.stop();

    if (templates.length === 0) {
      console.log(chalk.yellow('\nNo templates found.'));
      console.log(chalk.dim('Create a new template with: hodor template:create'));
      return;
    }

    // Create table
    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Description'),
        chalk.cyan('Forwards'),
        chalk.cyan('Tags'),
        chalk.cyan('Updated'),
      ],
      colWidths: [25, 40, 12, 30, 20],
      wordWrap: true,
    });

    // Add rows
    for (const template of templates) {
      const description = template.description || chalk.dim('No description');
      const tags = template.tags.length > 0 ? template.tags.join(', ') : chalk.dim('none');
      const updated = template.updatedAt.toLocaleDateString();

      table.push([
        chalk.bold(template.name),
        description,
        template.forwards.length.toString(),
        tags,
        updated,
      ]);
    }

    console.log('\n' + table.toString());

    // Summary
    console.log(
      chalk.dim(
        `\n${templates.length} template${templates.length !== 1 ? 's' : ''} found`
      )
    );

    // Show all tags if no filter applied
    if (!options.tags && !options.search) {
      const allTags = manager.getAllTags();
      if (allTags.length > 0) {
        console.log(chalk.dim(`Available tags: ${allTags.join(', ')}`));
      }
    }
  } catch (error: any) {
    spinner.fail('Failed to load templates');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}
