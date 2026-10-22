import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Template } from '../types';
import { randomBytes } from 'crypto';

/**
 * Manages port-forward templates
 */
export class TemplateStorage {
  private templatesPath: string;
  private templates: Map<string, Template> = new Map();

  constructor(customPath?: string) {
    this.templatesPath =
      customPath || path.join(os.homedir(), '.hodor', 'templates.json');
  }

  /**
   * Initialize template storage
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      await this.load();
    } catch (error) {
      console.warn('Failed to load templates:', error);
      this.templates = new Map();
    }
  }

  /**
   * Load templates from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.templatesPath, 'utf-8');
      const data = JSON.parse(content);

      this.templates = new Map();
      for (const template of data.templates || []) {
        // Convert date strings back to Date objects
        template.createdAt = new Date(template.createdAt);
        template.updatedAt = new Date(template.updatedAt);
        this.templates.set(template.id, template);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, initialize empty
        this.templates = new Map();
        await this.save();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save templates to disk
   */
  async save(): Promise<void> {
    try {
      await this.ensureDirectoryExists();

      const data = {
        version: '1.0',
        templates: Array.from(this.templates.values()),
      };

      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(this.templatesPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save templates: ${error}`);
    }
  }

  /**
   * Create a new template
   */
  async create(
    template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Template> {
    const now = new Date();
    const newTemplate: Template = {
      ...template,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(newTemplate.id, newTemplate);
    await this.save();

    return newTemplate;
  }

  /**
   * Get a template by ID
   */
  get(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  getAll(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Update a template
   */
  async update(id: string, updates: Partial<Omit<Template, 'id'>>): Promise<Template> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    const updated: Template = {
      ...template,
      ...updates,
      id: template.id, // Preserve ID
      createdAt: template.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };

    this.templates.set(id, updated);
    await this.save();

    return updated;
  }

  /**
   * Delete a template
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.templates.delete(id);
    if (existed) {
      await this.save();
    }
    return existed;
  }

  /**
   * Search templates by name or tags
   */
  search(query: string): Template[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.templates.values()).filter((template) => {
      const nameMatch = template.name.toLowerCase().includes(lowerQuery);
      const descMatch = template.description?.toLowerCase().includes(lowerQuery);
      const tagMatch = template.tags.some((tag) => tag.toLowerCase().includes(lowerQuery));

      return nameMatch || descMatch || tagMatch;
    });
  }

  /**
   * Filter templates by tags
   */
  filterByTags(tags: string[]): Template[] {
    return Array.from(this.templates.values()).filter((template) =>
      tags.some((tag) => template.tags.includes(tag))
    );
  }

  /**
   * Get all unique tags
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();

    for (const template of this.templates.values()) {
      for (const tag of template.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  /**
   * Export a template to JSON
   */
  exportTemplate(id: string): string {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    return JSON.stringify(template, null, 2);
  }

  /**
   * Import a template from JSON
   */
  async importTemplate(json: string): Promise<Template> {
    try {
      const data = JSON.parse(json);

      // Generate new ID and timestamps
      const template: Template = {
        ...data,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.templates.set(template.id, template);
      await this.save();

      return template;
    } catch (error) {
      throw new Error(`Failed to import template: ${error}`);
    }
  }

  /**
   * Export multiple templates
   */
  exportMultiple(ids: string[]): string {
    const templates = ids
      .map((id) => this.templates.get(id))
      .filter((t): t is Template => t !== undefined);

    return JSON.stringify({ templates }, null, 2);
  }

  /**
   * Import multiple templates
   */
  async importMultiple(json: string): Promise<Template[]> {
    try {
      const data = JSON.parse(json);
      const imported: Template[] = [];

      for (const templateData of data.templates || []) {
        const template: Template = {
          ...templateData,
          id: this.generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.templates.set(template.id, template);
        imported.push(template);
      }

      await this.save();
      return imported;
    } catch (error) {
      throw new Error(`Failed to import templates: ${error}`);
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Ensure templates directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    const dir = path.dirname(this.templatesPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create templates directory: ${error}`);
    }
  }

  /**
   * Get storage file path
   */
  getStoragePath(): string {
    return this.templatesPath;
  }
}
