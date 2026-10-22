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

    // With -o the inputs are merged on their own; otherwise into the default kubeconfig
    const plan = options.output
      ? {
          ...(await new KubeConfigMerger().mergeFiles(files)),
          inputs: files,
          added: [] as string[],
        }
      : await new KubeConfigMerger().planMerge(target, files);
    const { config, skipped, inputs } = plan;

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
      const { backup } = await manager.mergeFiles(files);
      if (backup) console.log(chalk.dim(`  Backup: ${backup}`));
    }

    console.log(
      chalk.green(`✔ Merged ${files.length} file${files.length !== 1 ? 's' : ''} into ${target}`)
    );
  } catch (error: any) {
    fail(`Merge failed: ${error.message}`);
  }
}
