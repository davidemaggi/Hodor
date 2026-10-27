import chalk from 'chalk';
import inquirer from 'inquirer';
import { prompt } from '../../utils/prompt.js';
import { RunRegistry } from '@hodor/core';
import type { PortForwardConfig, Template } from '@hodor/core';
import { chooseTemplate, fail, openTemplates } from '../../utils/shared.js';
import { newForwardSession, promptForForward } from './forward-wizard.js';
import { t } from '../../i18n.js';

type Action = 'details' | 'add' | 'edit' | 'remove' | 'move' | 'save' | 'discard';

function describeForward(f: PortForwardConfig): string {
  const links = [
    ...(f.secrets || []).map((s) => `🔑${s}`),
    ...(f.configMaps || []).map((c) => `📄${c}`),
  ].join(' ');
  return `${f.name} ${chalk.dim(`${f.localPort} → ${f.namespace}/${f.resourceType}/${f.resourceName}:${f.remotePort}`)} ${chalk.dim(links)}`;
}

async function pickForward(draft: Template, message: string): Promise<number> {
  const { index } = await prompt<{ index: number }>([
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
export async function templateEditCommand(name?: string): Promise<void> {
  const manager = await openTemplates();
  const original = await chooseTemplate(manager, name, t('templates.edit.pick'));
  const draft: Template = structuredClone(original);
  let dirty = false;
  const session = newForwardSession(draft.forwards.map((f) => f.localPort));

  for (;;) {
    console.log(
      `\n${chalk.bold(draft.name)}${draft.description ? chalk.dim(` · ${draft.description}`) : ''}${draft.tags.length ? chalk.magenta(` #${draft.tags.join(' #')}`) : ''}`
    );
    draft.forwards.forEach((f, i) => console.log(chalk.dim(`  ${i + 1}. `) + describeForward(f)));

    const { action } = await prompt<{ action: Action }>([
      {
        type: 'list',
        name: 'action',
        message: t('templates.edit.whatNow'),
        choices: [
          { name: t('templates.edit.actions.details'), value: 'details' },
          { name: t('templates.edit.actions.add'), value: 'add' },
          { name: t('templates.edit.actions.edit'), value: 'edit' },
          {
            name: t('templates.edit.actions.remove'),
            value: 'remove',
            disabled: draft.forwards.length <= 1 && t('templates.edit.needsOne'),
          },
          {
            name: t('templates.edit.actions.move'),
            value: 'move',
            disabled: draft.forwards.length <= 1 && t('templates.edit.onlyOne'),
          },
          new inquirer.Separator(),
          {
            name: dirty
              ? chalk.green(t('templates.edit.actions.save'))
              : t('templates.edit.actions.save'),
            value: 'save',
          },
          { name: t('templates.edit.actions.discard'), value: 'discard' },
        ],
      },
    ]);

    if (action === 'discard') {
      console.log(chalk.dim(t('templates.edit.discarded')));
      return;
    }

    if (action === 'save') break;

    dirty = true;
    if (action === 'details') {
      const answers = await prompt<{ name: string; description: string; tags: string }>([
        {
          type: 'input',
          name: 'name',
          message: t('templates.edit.name'),
          default: draft.name,
          validate: (v: string) =>
            !v.trim()
              ? t('templates.edit.nameRequired')
              : manager.nameExists(v, draft.id)
                ? t('templates.edit.nameTaken', { name: v })
                : true,
        },
        {
          type: 'input',
          name: 'description',
          message: t('templates.edit.description'),
          default: draft.description || '',
        },
        {
          type: 'input',
          name: 'tags',
          message: t('templates.edit.tags'),
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
      draft.forwards.push(
        await promptForForward(
          draft.forwards.map((f) => f.name),
          undefined,
          session
        )
      );
    } else if (action === 'edit') {
      const index = await pickForward(draft, t('templates.edit.whichForward'));
      const others = draft.forwards.filter((_, i) => i !== index).map((f) => f.name);
      draft.forwards[index] = await promptForForward(others, draft.forwards[index], session);
    } else if (action === 'remove') {
      draft.forwards.splice(await pickForward(draft, t('templates.edit.removeWhich')), 1);
    } else if (action === 'move') {
      const from = await pickForward(draft, t('templates.edit.moveWhich'));
      const { to } = await prompt<{ to: number }>([
        {
          type: 'list',
          name: 'to',
          message: t('templates.edit.toPosition'),
          choices: draft.forwards.map((_, i) => ({ name: `${i + 1}`, value: i })),
          default: from,
        },
      ]);
      const [moved] = draft.forwards.splice(from, 1);
      draft.forwards.splice(to, 0, moved);
    }
  }

  if (!dirty) {
    console.log(chalk.dim(t('templates.edit.nothingChanged')));
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
    fail(t('templates.edit.notSaved', { error: error.message }));
  }
  console.log(chalk.green(`✔ ${t('templates.edit.saved', { name: draft.name })}`));

  const registry = new RunRegistry();
  if (await registry.isRunning(draft.id)) {
    const { restart } = await prompt<{ restart: boolean }>([
      {
        type: 'confirm',
        name: 'restart',
        message: t('templates.edit.restartPrompt'),
        default: true,
      },
    ]);
    if (restart && (await registry.requestRestart(draft.id))) {
      console.log(chalk.green(`✔ ${t('templates.edit.restartRequested')}`));
    } else {
      console.log(chalk.dim(t('templates.edit.keepsOld')));
    }
  }
}
