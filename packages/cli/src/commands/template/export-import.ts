import chalk from 'chalk';
import * as fs from 'fs/promises';
import type { Template } from '@hodor/core';
import { prompt } from '../../utils/prompt.js';
import {
  askForFile,
  chooseTemplates,
  expandHome,
  fail,
  openTemplates,
} from '../../utils/shared.js';
import { t } from '../../i18n.js';

/**
 * Export one or more templates to a file. Without names, pick them from a list.
 */
export async function templateExportCommand(
  names: string[],
  options: { output?: string; multiple?: string[] }
): Promise<void> {
  try {
    const manager = await openTemplates();
    const wanted = [...names, ...(options.multiple ?? [])];
    let output = options.output;

    let templates: Template[];
    if (wanted.length === 0) {
      templates = await chooseTemplates(manager, t('templates.export.pick'));
    } else {
      templates = [];
      for (const name of wanted) {
        const template = manager.getByName(name);
        if (template) templates.push(template);
        else console.log(chalk.yellow(`⚠ ${t('templates.export.notFoundSkipping', { name })}`));
      }
      if (templates.length === 0) fail(t('templates.export.noneToExport'));
    }

    const suggested = templates.length === 1 ? `${templates[0].name}.json` : 'hodor-templates.json';
    if (!output && wanted.length === 0) {
      ({ output } = await prompt<{ output: string }>([
        {
          type: 'input',
          name: 'output',
          message: t('templates.export.askFile'),
          default: suggested,
          filter: (input: string) => expandHome(input.trim()),
        },
      ]));
    }
    const filename = output || suggested;

    const json =
      templates.length === 1
        ? manager.export(templates[0].id)
        : manager.exportMultiple(templates.map((template) => template.id));
    await fs.writeFile(filename, json, 'utf-8');

    console.log(
      chalk.green(
        `✓ ${t('templates.export.exported', { count: templates.length, file: filename })}`
      )
    );
  } catch (error: any) {
    fail(t('common.error', { error: error.message }));
  }
}

/**
 * Import a template
 */
export async function templateImportCommand(filePath?: string): Promise<void> {
  try {
    const manager = await openTemplates();
    filePath = filePath ? expandHome(filePath) : await askForFile(t('templates.import.askFile'));

    // Read file
    const json = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(json);

    // Check if single or multiple templates
    if (data.templates && Array.isArray(data.templates)) {
      // Multiple templates
      const templates = await manager.importMultiple(json);
      console.log(
        chalk.green(`✓ ${t('templates.import.importedMany', { count: templates.length })}`)
      );
      for (const template of templates) {
        console.log(chalk.dim(`  - ${template.name}`));
      }
    } else {
      // Single template
      const template = await manager.import(json);
      console.log(chalk.green(`✓ ${t('templates.import.imported', { name: template.name })}`));
      console.log(chalk.dim(`  ${t('templates.create.id', { id: template.id })}`));
      console.log(
        chalk.dim(`  ${t('templates.create.forwards', { count: template.forwards.length })}`)
      );
    }
  } catch (error: any) {
    console.error(chalk.red(`\n${t('common.error', { error: error.message })}`));
    process.exit(1);
  }
}
