import chalk from 'chalk';
import * as fs from 'fs/promises';
import { TemplateManager, TemplateStorage } from '@hodor/core';
import { t } from '../../i18n.js';

/**
 * Export a template
 */
export async function templateExportCommand(
  templateName: string,
  options: { output?: string; multiple?: string[] }
): Promise<void> {
  try {
    const storage = new TemplateStorage();
    await storage.initialize();
    const manager = new TemplateManager(storage);

    let json: string;
    let filename: string;
    let count = 1;

    if (options.multiple && options.multiple.length > 0) {
      // Export multiple templates
      const templateIds: string[] = [];

      for (const name of options.multiple) {
        const template = manager.getByName(name);
        if (!template) {
          console.log(chalk.yellow(`⚠ ${t('templates.export.notFoundSkipping', { name })}`));
          continue;
        }
        templateIds.push(template.id);
      }

      if (templateIds.length === 0) {
        console.log(chalk.red(t('templates.export.noneToExport')));
        process.exit(1);
      }

      json = manager.exportMultiple(templateIds);
      count = templateIds.length;
      filename = options.output || 'hodor-templates.json';

      console.log(
        chalk.green(`✓ ${t('templates.export.exportingMany', { count: templateIds.length })}`)
      );
    } else {
      // Export single template
      const template = manager.getByName(templateName);
      if (!template) {
        console.log(chalk.red(`\n${t('templates.delete.notFound', { name: templateName })}`));
        process.exit(1);
      }

      json = manager.export(template.id);
      filename = options.output || `${templateName}.json`;

      console.log(chalk.green(`✓ ${t('templates.export.exportingOne', { name: template.name })}`));
    }

    // Write to file
    await fs.writeFile(filename, json, 'utf-8');

    console.log(chalk.green(`✓ ${t('templates.export.exported', { count, file: filename })}`));
  } catch (error: any) {
    console.error(chalk.red(`\n${t('common.error', { error: error.message })}`));
    process.exit(1);
  }
}

/**
 * Import a template
 */
export async function templateImportCommand(filePath: string): Promise<void> {
  try {
    const storage = new TemplateStorage();
    await storage.initialize();
    const manager = new TemplateManager(storage);

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
