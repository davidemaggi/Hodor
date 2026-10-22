import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { KubeConfigParser, KubeConfigMerger } from '@hodor/core';

/**
 * Merge multiple kubeconfig files
 */
export async function configMergeCommand(files: string[], outputPath?: string): Promise<void> {
  const spinner = ora('Merging kubeconfig files...').start();

  try {
    // Validate files exist
    for (const file of files) {
      try {
        await fs.access(file);
      } catch {
        spinner.fail(`File not found: ${file}`);
        process.exit(1);
      }
    }

    spinner.text = `Merging ${files.length} kubeconfig files...`;

    const merger = new KubeConfigMerger();
    const merged = await merger.mergeFiles(files);

    spinner.succeed('Kubeconfig files merged successfully');

    // Show summary
    console.log(chalk.cyan('\nMerge Summary:'));
    console.log(chalk.dim(`  Clusters: ${merged.clusters.length}`));
    console.log(chalk.dim(`  Users: ${merged.users.length}`));
    console.log(chalk.dim(`  Contexts: ${merged.contexts.length}`));
    console.log(chalk.dim(`  Current Context: ${merged['current-context'] || 'none'}`));

    // Write output
    if (outputPath) {
      const writeSpinner = ora(`Writing to ${outputPath}...`).start();

      const parser = new KubeConfigParser();
      await parser.writeConfig(outputPath, merged);

      writeSpinner.succeed(chalk.green(`Merged config written to ${outputPath}`));
    } else {
      console.log(chalk.yellow('\nNo output file specified. Use -o flag to save the merged config.'));
      console.log(chalk.dim('Example: hodor config:merge file1 file2 -o merged-config'));
    }
  } catch (error: any) {
    spinner.fail('Failed to merge kubeconfig files');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}
