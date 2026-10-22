import chalk from 'chalk';
import * as fs from 'fs/promises';
import { TemplateManager, TemplateStorage } from '@hodor/core';

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

    if (options.multiple && options.multiple.length > 0) {
      // Export multiple templates
      const templateIds: string[] = [];

      for (const name of options.multiple) {
        const template = manager.getByName(name);
        if (!template) {
          console.log(chalk.yellow(`⚠ Template '${name}' not found, skipping...`));
          continue;
        }
        templateIds.push(template.id);
      }

      if (templateIds.length === 0) {
        console.log(chalk.red('No templates found to export.'));
        process.exit(1);
      }

      json = manager.exportMultiple(templateIds);
      filename = options.output || 'hodor-templates.json';

      console.log(chalk.green(`✓ Exporting ${templateIds.length} templates...`));
    } else {
      // Export single template
      const template = manager.getByName(templateName);
      if (!template) {
        console.log(chalk.red(`\nTemplate '${templateName}' not found.`));
        process.exit(1);
      }

      json = manager.export(template.id);
      filename = options.output || `${templateName}.json`;

      console.log(chalk.green(`✓ Exporting template '${template.name}'...`));
    }

    // Write to file
    await fs.writeFile(filename, json, 'utf-8');

    console.log(chalk.green(`✓ Template(s) exported to: ${filename}`));
  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
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
      console.log(chalk.green(`✓ Imported ${templates.length} template(s):`));
      for (const template of templates) {
        console.log(chalk.dim(`  - ${template.name}`));
      }
    } else {
      // Single template
      const template = await manager.import(json);
      console.log(chalk.green(`✓ Template '${template.name}' imported successfully!`));
      console.log(chalk.dim(`  ID: ${template.id}`));
      console.log(chalk.dim(`  Forwards: ${template.forwards.length}`));
    }
  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}
