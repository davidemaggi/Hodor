import chalk from 'chalk';
import { prompt } from '../../utils/prompt.js';
import { TemplateManager, TemplateStorage } from '@hodor/core';
import { newForwardSession, promptForForward } from './forward-wizard.js';
import type { PortForwardConfig } from '@hodor/core';
import { t } from '../../i18n.js';

/**
 * Create a new template
 */
export async function templateCreateCommand(): Promise<void> {
  console.log(chalk.cyan(`\n${t('templates.create.title')}\n`));

  try {
    const storage = new TemplateStorage();
    await storage.initialize();
    const manager = new TemplateManager(storage);

    // Step 1: Template basic info
    const basicInfo = await prompt<{
      name: string;
      description: string;
      tags: string;
    }>([
      {
        type: 'input',
        name: 'name',
        message: t('templates.create.name'),
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return t('templates.create.nameRequired');
          }
          if (manager.nameExists(input)) {
            return t('templates.create.nameExists', { name: input });
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: t('templates.create.description'),
      },
      {
        type: 'input',
        name: 'tags',
        message: t('templates.create.tags'),
      },
    ]);

    const tags = basicInfo.tags
      ? basicInfo.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];

    // Step 2: Add port-forwards
    const forwards: PortForwardConfig[] = [];
    let addMore = true;

    console.log(chalk.dim(`\n${t('templates.create.addForwards')}\n`));

    const session = newForwardSession();
    while (addMore) {
      const forward = await promptForForward(
        forwards.map((f) => f.name),
        undefined,
        session
      );
      forwards.push(forward);

      const { continue: shouldContinue } = await prompt<{ continue: boolean }>([
        {
          type: 'confirm',
          name: 'continue',
          message: t('templates.create.addAnother'),
          default: true,
        },
      ]);

      addMore = shouldContinue;
    }

    // Step 3: Create template
    console.log(chalk.dim(`\n${t('templates.create.creating')}\n`));

    const template = await manager.create({
      name: basicInfo.name,
      description: basicInfo.description || undefined,
      forwards,
      tags,
    });

    console.log(chalk.green(`✓ ${t('templates.create.created', { name: template.name })}`));
    console.log(chalk.dim(`  ${t('templates.create.id', { id: template.id })}`));
    console.log(
      chalk.dim(`  ${t('templates.create.forwards', { count: template.forwards.length })}`)
    );

    if (template.tags.length > 0) {
      console.log(
        chalk.dim(`  ${t('templates.create.tagList', { tags: template.tags.join(', ') })}`)
      );
    }

    console.log(chalk.dim(`\n${t('templates.create.runHint')}`));
    console.log(chalk.cyan(`  hodor template:run ${template.name}`));
  } catch (error: any) {
    console.error(chalk.red(`\n${t('common.error', { error: error.message })}`));
    process.exit(1);
  }
}
