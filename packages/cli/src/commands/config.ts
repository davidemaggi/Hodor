import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import { ContextManager, KubeConfigMerger, KubeConfigParser } from '@hodor/core';
import { fail } from '../utils/shared.js';
import { t } from '../i18n.js';

/**
 * Merge kubeconfig files. By default they go into kubectl's default kubeconfig (backed up first).
 */
export async function configMergeCommand(
  files: string[],
  options: { output?: string; yes?: boolean } = {}
): Promise<void> {
  try {
    for (const file of files) {
      await fs.access(file).catch(() => fail(t('config.fileNotFound', { file })));
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

    const targetLabel = t('config.previewTarget');
    const contextsLabel = t('config.previewContexts');
    const width = Math.max(targetLabel.length, contextsLabel.length) + 1;
    const contextNames = config.contexts.map((c) => c.name).join(', ') || t('config.none');
    console.log(chalk.cyan(`\n${t('config.previewTitle')}`));
    console.log(chalk.dim(`  ${targetLabel.padEnd(width)}${target}`));
    console.log(chalk.dim(`  ${contextsLabel.padEnd(width)}${contextNames}`));
    for (const s of skipped) {
      console.log(
        chalk.yellow(
          `  ⚠ ${t('config.skipped', { kind: s.kind, name: s.name, source: inputs[s.source] })}`
        )
      );
    }

    if (!options.yes) {
      const { ok } = await inquirer.prompt<{ ok: boolean }>([
        {
          type: 'confirm',
          name: 'ok',
          message: t('config.confirm', { target }),
          default: true,
        },
      ]);
      if (!ok) {
        console.log(chalk.dim(t('config.cancelled')));
        return;
      }
    }

    if (options.output) {
      await parser.writeConfig(target, config);
    } else {
      const { backup } = await manager.mergeFiles(files);
      if (backup) console.log(chalk.dim(`  ${t('config.backup', { path: backup })}`));
    }

    console.log(chalk.green(`✔ ${t('config.merged', { count: files.length, target })}`));
  } catch (error: any) {
    fail(t('config.failed', { error: error.message }));
  }
}
