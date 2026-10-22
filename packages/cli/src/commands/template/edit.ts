import chalk from 'chalk';
import inquirer from 'inquirer';
import { RunRegistry } from '@hodor/core';
import type { PortForwardConfig, Template } from '@hodor/core';
import { fail, openTemplates, requireTemplate } from '../../utils/shared.js';
import { promptForForward } from './create.js';

type Action = 'details' | 'add' | 'edit' | 'remove' | 'move' | 'save' | 'discard';

function describeForward(f: PortForwardConfig): string {
  const links = [
    ...(f.secrets || []).map((s) => `🔑${s}`),
    ...(f.configMaps || []).map((c) => `📄${c}`),
  ].join(' ');
  return `${f.name} ${chalk.dim(`${f.localPort} → ${f.namespace}/${f.resourceType}/${f.resourceName}:${f.remotePort}`)} ${chalk.dim(links)}`;
}

async function pickForward(draft: Template, message: string): Promise<number> {
  const { index } = await inquirer.prompt<{ index: number }>([
    {
      type: 'list',
      name: 'index',
      message,
      choices: draft.forwards.map((f, i) => ({ name: describeForward(f), value: i })),
    },
  ]);
  return index;
}

/**
 * Interactive editor for every part of a template
 */
export async function templateEditCommand(name: string): Promise<void> {
  const manager = await openTemplates();
  const original = requireTemplate(manager, name);
  const draft: Template = structuredClone(original);
  let dirty = false;

  for (;;) {
    console.log(
      `\n${chalk.bold(draft.name)}${draft.description ? chalk.dim(` · ${draft.description}`) : ''}${draft.tags.length ? chalk.magenta(` #${draft.tags.join(' #')}`) : ''}`
    );
    draft.forwards.forEach((f, i) => console.log(chalk.dim(`  ${i + 1}. `) + describeForward(f)));

    const { action } = await inquirer.prompt<{ action: Action }>([
      {
        type: 'list',
        name: 'action',
        message: 'What now?',
        choices: [
          { name: 'Edit name, description, tags', value: 'details' },
          { name: 'Add a forward', value: 'add' },
          { name: 'Edit a forward', value: 'edit' },
          {
            name: 'Remove a forward',
            value: 'remove',
            disabled: draft.forwards.length <= 1 && 'a template needs at least one',
          },
          {
            name: 'Reorder forwards',
            value: 'move',
            disabled: draft.forwards.length <= 1 && 'only one forward',
          },
          new inquirer.Separator(),
          { name: dirty ? chalk.green('Save') : 'Save', value: 'save' },
          { name: 'Discard changes', value: 'discard' },
        ],
      },
    ]);

    if (action === 'discard') {
      console.log(chalk.dim('Changes discarded.'));
      return;
    }

    if (action === 'save') break;

    dirty = true;
    if (action === 'details') {
      const answers = await inquirer.prompt<{ name: string; description: string; tags: string }>([
        {
          type: 'input',
          name: 'name',
          message: 'Name:',
          default: draft.name,
          validate: (v: string) =>
            !v.trim()
              ? 'Name is required'
              : manager.nameExists(v, draft.id)
                ? `'${v}' is taken`
                : true,
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description:',
          default: draft.description || '',
        },
        {
          type: 'input',
          name: 'tags',
          message: 'Tags (comma-separated):',
          default: draft.tags.join(', '),
        },
      ]);
      draft.name = answers.name.trim();
      draft.description = answers.description.trim() || undefined;
      draft.tags = answers.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (action === 'add') {
      draft.forwards.push(await promptForForward(draft.forwards.map((f) => f.name)));
    } else if (action === 'edit') {
      const index = await pickForward(draft, 'Which forward?');
      const others = draft.forwards.filter((_, i) => i !== index).map((f) => f.name);
      draft.forwards[index] = await promptForForward(others, draft.forwards[index]);
    } else if (action === 'remove') {
      draft.forwards.splice(await pickForward(draft, 'Remove which forward?'), 1);
    } else if (action === 'move') {
      const from = await pickForward(draft, 'Move which forward?');
      const { to } = await inquirer.prompt<{ to: number }>([
        {
          type: 'list',
          name: 'to',
          message: 'To position:',
          choices: draft.forwards.map((_, i) => ({ name: `${i + 1}`, value: i })),
          default: from,
        },
      ]);
      const [moved] = draft.forwards.splice(from, 1);
      draft.forwards.splice(to, 0, moved);
    }
  }

  if (!dirty) {
    console.log(chalk.dim('Nothing changed.'));
    return;
  }

  try {
    await manager.update(draft.id, {
      name: draft.name,
      description: draft.description,
      tags: draft.tags,
      forwards: draft.forwards,
    });
  } catch (error: any) {
    fail(`Not saved: ${error.message}`);
  }
  console.log(chalk.green(`✔ Saved '${draft.name}'`));

  const registry = new RunRegistry();
  if (await registry.isRunning(draft.id)) {
    const { restart } = await inquirer.prompt<{ restart: boolean }>([
      {
        type: 'confirm',
        name: 'restart',
        message: 'This template is running. Restart it with the new settings?',
        default: true,
      },
    ]);
    if (restart && (await registry.requestRestart(draft.id))) {
      console.log(
        chalk.green('✔ Restart requested, the running Hodor will pick it up in a second.')
      );
    } else {
      console.log(chalk.dim('The running instance keeps the old settings until you restart it.'));
    }
  }
}
