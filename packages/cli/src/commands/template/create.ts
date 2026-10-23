import chalk from 'chalk';
import inquirer from 'inquirer';
import { TemplateManager, TemplateStorage, validatePort, validateResourceName } from '@hodor/core';
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
    const basicInfo = await inquirer.prompt<{
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

    while (addMore) {
      const forward = await promptForForward(forwards.map((f) => f.name));
      forwards.push(forward);

      const { continue: shouldContinue } = await inquirer.prompt<{ continue: boolean }>([
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

/**
 * Prompt for a single port-forward configuration
 */
export async function promptForForward(
  existingNames: string[],
  current?: PortForwardConfig
): Promise<PortForwardConfig> {
  const answers = await inquirer.prompt<{
    name: string;
    namespace: string;
    resourceType: 'pod' | 'service' | 'deployment';
    resourceName: string;
    localPort: number;
    remotePort: number;
    addSecrets: boolean;
    secrets?: string;
    addConfigMaps: boolean;
    configMaps?: string;
  }>([
    {
      type: 'input',
      name: 'name',
      message: t('templates.forward.name'),
      default: current?.name,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return t('templates.forward.nameRequired');
        }
        if (existingNames.includes(input)) {
          return t('templates.forward.nameExists', { name: input });
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'namespace',
      message: t('templates.forward.namespace'),
      default: current?.namespace || 'default',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return t('templates.forward.namespaceRequired');
        }
        if (!validateResourceName(input)) {
          return t('templates.forward.namespaceInvalid');
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'resourceType',
      message: t('templates.forward.resourceType'),
      choices: [
        { name: 'Service', value: 'service' },
        { name: 'Deployment', value: 'deployment' },
        { name: 'Pod', value: 'pod' },
      ],
      default: current?.resourceType || 'service',
    },
    {
      type: 'input',
      name: 'resourceName',
      message: t('templates.forward.resourceName'),
      default: current?.resourceName,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return t('templates.forward.resourceNameRequired');
        }
        return true;
      },
    },
    {
      type: 'number',
      name: 'localPort',
      message: t('templates.forward.localPort'),
      default: current?.localPort,
      validate: (input: number) => {
        if (!validatePort(input)) {
          return t('templates.forward.portRange');
        }
        return true;
      },
    },
    {
      type: 'number',
      name: 'remotePort',
      message: t('templates.forward.remotePort'),
      default: current?.remotePort,
      validate: (input: number) => {
        if (!validatePort(input)) {
          return t('templates.forward.portRange');
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'addSecrets',
      message: t('templates.forward.linkSecrets'),
      default: !!current?.secrets?.length,
    },
    {
      type: 'input',
      name: 'secrets',
      message: t('templates.forward.secretNames'),
      default: current?.secrets?.join(', '),
      when: (answers) => answers.addSecrets,
    },
    {
      type: 'confirm',
      name: 'addConfigMaps',
      message: t('templates.forward.linkConfigMaps'),
      default: !!current?.configMaps?.length,
    },
    {
      type: 'input',
      name: 'configMaps',
      message: t('templates.forward.configMapNames'),
      default: current?.configMaps?.join(', '),
      when: (answers) => answers.addConfigMaps,
    },
  ]);

  const secrets = answers.secrets
    ? answers.secrets
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : undefined;

  const configMaps = answers.configMaps
    ? answers.configMaps
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    : undefined;

  return {
    name: answers.name,
    namespace: answers.namespace,
    resourceType: answers.resourceType,
    resourceName: answers.resourceName,
    localPort: answers.localPort,
    remotePort: answers.remotePort,
    secrets,
    configMaps,
  };
}
