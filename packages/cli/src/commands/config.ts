import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import { ContextManager, KubeConfigMerger, KubeConfigParser } from '@hodor/core';
import { fail } from '../utils/shared.js';

/**
 * Merge kubeconfig files. By default they go into kubectl's default kubeconfig (backed up first).
 */
export async function configMergeCommand(
  files: string[],
  options: { output?: string; yes?: boolean } = {}
): Promise<void> {
  try {
    for (const file of files) {
      await fs.access(file).catch(() => fail(`File not found: ${file}`));
    }

    const parser = new KubeConfigParser();
    const manager = new ContextManager();
    const target = options.output || manager.getConfigPath();
    const targetExists = await parser.configExists(target);

    // Existing target first, so its entries win on conflicts
    const inputs = targetExists && !options.output ? [target, ...files] : files;
    const { config, skipped } = await new KubeConfigMerger().mergeFiles(inputs);

    console.log(chalk.cyan('\nMerge preview'));
    console.log(chalk.dim(`  Target:   ${target}`));
    console.log(
      chalk.dim(`  Contexts: ${config.contexts.map((c) => c.name).join(', ') || 'none'}`)
    );
    for (const s of skipped) {
      console.log(
        chalk.yellow(
          `  ⚠ ${s.kind} '${s.name}' from ${inputs[s.source]} skipped: name already taken`
        )
      );
    }

    if (!options.yes) {
      const { ok } = await inquirer.prompt<{ ok: boolean }>([
        {
          type: 'confirm',
          name: 'ok',
          message: `Write merged kubeconfig to ${target}?`,
          default: true,
        },
      ]);
      if (!ok) {
        console.log(chalk.dim('Nothing written. The door stays shut.'));
        return;
      }
    }

    if (options.output) {
      await parser.writeConfig(target, config);
    } else {
      const backup = await manager.replaceConfig(config);
      if (backup) console.log(chalk.dim(`  Backup: ${backup}`));
    }

    console.log(
      chalk.green(`✔ Merged ${files.length} file${files.length !== 1 ? 's' : ''} into ${target}`)
    );
  } catch (error: any) {
    fail(`Merge failed: ${error.message}`);
  }
}
