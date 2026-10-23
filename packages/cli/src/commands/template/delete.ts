import chalk from 'chalk';
import { prompt } from '../../utils/prompt.js';
import { chooseTemplate, openTemplates } from '../../utils/shared.js';
import { t } from '../../i18n.js';

/**
 * Delete a template
 */
export async function templateDeleteCommand(
  templateName: string | undefined,
  options: {
    force?: boolean;
  }
): Promise<void> {
  try {
    const manager = await openTemplates();
    const template = await chooseTemplate(manager, templateName, t('templates.delete.pick'));

    // Confirm deletion unless --force
    if (!options.force) {
      const answer = await prompt<{ confirm: boolean }>([
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
