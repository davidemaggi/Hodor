import chalk from 'chalk';
import { CommandGenerator } from '@hodor/core';
import type { Platform } from '@hodor/core';
import { fail, openTemplates, requireTemplate } from '../../utils/shared.js';

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
  name: string,
  options: { forward?: string; platform?: string; context?: string; script?: boolean }
): Promise<void> {
  const template = requireTemplate(await openTemplates(), name);
  const platform = (options.platform || currentPlatform()) as Platform;
  if (!PLATFORMS.includes(platform)) {
    fail(`Unknown platform '${platform}'. Use one of: ${PLATFORMS.join(', ')}`);
  }

  const forwards = options.forward
    ? template.forwards.filter((f) => f.name === options.forward)
    : template.forwards;
  if (forwards.length === 0) {
    fail(`Forward '${options.forward}' not found in '${template.name}'`);
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
    console.error(
      chalk.dim("\n# Uses kubectl's current context. Add --context <name> to target another one.")
    );
  }
}
