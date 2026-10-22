import chalk from 'chalk';
import inquirer from 'inquirer';
import { TemplateManager, TemplateStorage } from '@hodor/core';

/**
 * Delete a template
 */
export async function templateDeleteCommand(templateName: string, options: {
  force?: boolean;
}): Promise<void> {
  try {
    const storage = new TemplateStorage();
    await storage.initialize();
    const manager = new TemplateManager(storage);

    // Find template
    const template = manager.getByName(templateName);
    if (!template) {
      console.log(chalk.red(`\nTemplate '${templateName}' not found.`));
      process.exit(1);
    }

    // Confirm deletion unless --force
    if (!options.force) {
      const answer = await inquirer.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.yellow(
            `Are you sure you want to delete template '${template.name}'?`
          ),
          default: false,
        },
      ]);

      if (!answer.confirm) {
        console.log(chalk.dim('Deletion cancelled.'));
        return;
      }
    }

    // Delete template
    await manager.delete(template.id);

    console.log(chalk.green(`✓ Template '${template.name}' deleted successfully.`));
  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}
