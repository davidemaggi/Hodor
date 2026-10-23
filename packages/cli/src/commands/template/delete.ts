import chalk from 'chalk';
import inquirer from 'inquirer';
import { TemplateManager, TemplateStorage } from '@hodor/core';
import { t } from '../../i18n.js';

/**
 * Delete a template
 */
export async function templateDeleteCommand(
  templateName: string,
  options: {
    force?: boolean;
  }
): Promise<void> {
  try {
    const storage = new TemplateStorage();
    await storage.initialize();
    const manager = new TemplateManager(storage);

    // Find template
    const template = manager.getByName(templateName);
    if (!template) {
      console.log(chalk.red(`\n${t('templates.delete.notFound', { name: templateName })}`));
      process.exit(1);
    }

    // Confirm deletion unless --force
    if (!options.force) {
      const answer = await inquirer.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.yellow(t('templates.delete.confirm', { name: template.name })),
          default: false,
        },
      ]);

      if (!answer.confirm) {
        console.log(chalk.dim(t('templates.delete.cancelled')));
        return;
      }
    }

    // Delete template
    await manager.delete(template.id);

    console.log(chalk.green(`✓ ${t('templates.delete.deleted', { name: template.name })}`));
  } catch (error: any) {
    console.error(chalk.red(`\n${t('common.error', { error: error.message })}`));
    process.exit(1);
  }
}
