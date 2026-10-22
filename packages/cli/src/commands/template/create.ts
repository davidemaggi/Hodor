import chalk from 'chalk';
import inquirer from 'inquirer';
import { TemplateManager, TemplateStorage, validatePort, validateResourceName } from '@hodor/core';
import type { PortForwardConfig } from '@hodor/core';

/**
 * Create a new template
 */
export async function templateCreateCommand(): Promise<void> {
  console.log(chalk.cyan('\n🚪 Hodor Template Creator\n'));

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
        message: 'Template name:',
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Template name is required';
          }
          if (manager.nameExists(input)) {
            return `Template '${input}' already exists`;
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description (optional):',
      },
      {
        type: 'input',
        name: 'tags',
        message: 'Tags (comma-separated, optional):',
      },
    ]);

    const tags = basicInfo.tags
      ? basicInfo.tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
      : [];

    // Step 2: Add port-forwards
    const forwards: PortForwardConfig[] = [];
    let addMore = true;

    console.log(chalk.dim('\nAdd port-forwards to your template:\n'));

    while (addMore) {
      const forward = await promptForForward(forwards.map((f) => f.name));
      forwards.push(forward);

      const { continue: shouldContinue } = await inquirer.prompt<{ continue: boolean }>([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Add another port-forward?',
          default: true,
        },
      ]);

      addMore = shouldContinue;
    }

    // Step 3: Create template
    console.log(chalk.dim('\nCreating template...\n'));

    const template = await manager.create({
      name: basicInfo.name,
      description: basicInfo.description || undefined,
      forwards,
      tags,
    });

    console.log(chalk.green(`✓ Template '${template.name}' created successfully!`));
    console.log(chalk.dim(`  ID: ${template.id}`));
    console.log(chalk.dim(`  Forwards: ${template.forwards.length}`));

    if (template.tags.length > 0) {
      console.log(chalk.dim(`  Tags: ${template.tags.join(', ')}`));
    }

    console.log(chalk.dim('\nRun this template with:'));
    console.log(chalk.cyan(`  hodor template:run ${template.name}`));
  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Prompt for a single port-forward configuration
 */
async function promptForForward(existingNames: string[]): Promise<PortForwardConfig> {
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
      message: 'Forward name:',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Forward name is required';
        }
        if (existingNames.includes(input)) {
          return `Forward name '${input}' already exists in this template`;
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'namespace',
      message: 'Namespace:',
      default: 'default',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Namespace is required';
        }
        if (!validateResourceName(input)) {
          return 'Invalid namespace name';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'resourceType',
      message: 'Resource type:',
      choices: [
        { name: 'Service', value: 'service' },
        { name: 'Deployment', value: 'deployment' },
        { name: 'Pod', value: 'pod' },
      ],
      default: 'service',
    },
    {
      type: 'input',
      name: 'resourceName',
      message: 'Resource name:',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Resource name is required';
        }
        return true;
      },
    },
    {
      type: 'number',
      name: 'localPort',
      message: 'Local port:',
      validate: (input: number) => {
        if (!validatePort(input)) {
          return 'Port must be between 1 and 65535';
        }
        return true;
      },
    },
    {
      type: 'number',
      name: 'remotePort',
      message: 'Remote port:',
      validate: (input: number) => {
        if (!validatePort(input)) {
          return 'Port must be between 1 and 65535';
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'addSecrets',
      message: 'Link secrets to this forward?',
      default: false,
    },
    {
      type: 'input',
      name: 'secrets',
      message: 'Secret names (comma-separated):',
      when: (answers) => answers.addSecrets,
    },
    {
      type: 'confirm',
      name: 'addConfigMaps',
      message: 'Link configmaps to this forward?',
      default: false,
    },
    {
      type: 'input',
      name: 'configMaps',
      message: 'ConfigMap names (comma-separated):',
      when: (answers) => answers.addConfigMaps,
    },
  ]);

  const secrets = answers.secrets
    ? answers.secrets.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : undefined;

  const configMaps = answers.configMaps
    ? answers.configMaps.split(',').map((c) => c.trim()).filter((c) => c.length > 0)
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
