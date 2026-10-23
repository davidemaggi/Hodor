import chalk from 'chalk';
import { ClusterDiscovery, CommandGenerator } from '@hodor/core';
import type { Platform, Template } from '@hodor/core';
import { prompt } from '../../utils/prompt.js';
import { chooseTemplate, fail, openTemplates } from '../../utils/shared.js';
import { t } from '../../i18n.js';

const PLATFORMS: Platform[] = ['linux', 'macos', 'windows'];

function currentPlatform(): Platform {
  return process.platform === 'win32'
    ? 'windows'
    : process.platform === 'darwin'
      ? 'macos'
      : 'linux';
}

/**
 * Print the kubectl commands equivalent to a template (or a single forward)
 */
export async function templateCommandCommand(
  name: string | undefined,
  options: { forward?: string; platform?: string; context?: string; script?: boolean }
): Promise<void> {
  const guided = !name;
  const template = await chooseTemplate(await openTemplates(), name, t('templates.command.pick'));
  if (guided) options = { ...options, ...(await askOptions(template, options)) };
  const platform = (options.platform || currentPlatform()) as Platform;
  if (!PLATFORMS.includes(platform)) {
    fail(t('templates.command.unknownPlatform', { platform, platforms: PLATFORMS.join(', ') }));
  }

  const forwards = options.forward
    ? template.forwards.filter((f) => f.name === options.forward)
    : template.forwards;
  if (forwards.length === 0) {
    fail(
      t('templates.command.forwardNotFound', { forward: options.forward, template: template.name })
    );
  }

  const generator = new CommandGenerator();
  const commandOptions = { context: options.context };

  if (options.script) {
    process.stdout.write(generator.generateShellScript(forwards, platform, commandOptions) + '\n');
    return;
  }

  for (const cmd of generator.generateTemplateCommands(forwards, platform, commandOptions)) {
    console.log(cmd.command);
  }
  if (!options.context && process.stdout.isTTY) {
    console.error(chalk.dim(`\n${t('templates.command.contextHint')}`));
  }
}

/** Without a template name on the command line, ask for everything the options would have said */
async function askOptions(
  template: Template,
  given: { forward?: string; platform?: string; context?: string; script?: boolean }
): Promise<{ forward?: string; platform?: string; context?: string; script?: boolean }> {
  const contexts = [...new Set((await new ClusterDiscovery().list()).map((c) => c.name))];
  const answers = await prompt<{
    platform: Platform;
    forward: string;
    context: string;
    script: boolean;
  }>([
    {
      type: 'list',
      name: 'platform',
      message: t('templates.command.askPlatform'),
      when: !given.platform,
      default: currentPlatform(),
      choices: [
        { name: 'Linux (bash)', value: 'linux' },
        { name: 'macOS (bash/zsh)', value: 'macos' },
        { name: 'Windows (PowerShell)', value: 'windows' },
      ],
    },
    {
      type: 'list',
      name: 'forward',
      message: t('templates.command.askForward'),
      when: !given.forward && template.forwards.length > 1,
      choices: [
        {
          name: t('templates.command.allForwards', { count: template.forwards.length }),
          value: '',
        },
        ...template.forwards.map((f) => ({
          name: `${f.name} ${chalk.dim(`:${f.localPort} → ${f.resourceType}/${f.resourceName}`)}`,
          value: f.name,
          short: f.name,
        })),
      ],
    },
    {
      type: 'list',
      name: 'context',
      message: t('templates.command.askContext'),
      when: !given.context && contexts.length > 0,
      pageSize: 15,
      choices: [
        { name: t('templates.command.currentContext'), value: '' },
        ...contexts.map((c) => ({ name: c, value: c })),
      ],
    },
    {
      type: 'list',
      name: 'script',
      message: t('templates.command.askFormat'),
      when: !given.script,
      choices: [
        { name: t('templates.command.formatLines'), value: false },
        { name: t('templates.command.formatScript'), value: true },
      ],
    },
  ]);
  return {
    platform: given.platform ?? answers.platform,
    forward: given.forward ?? (answers.forward || undefined),
    context: given.context ?? (answers.context || undefined),
    script: given.script ?? answers.script,
  };
}
