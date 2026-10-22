import { Template, PortForwardConfig } from '../types';
import { TemplateStorage } from '../storage/template-storage';

/**
 * Manages port-forward templates
 */
export class TemplateManager {
  private storage: TemplateStorage;

  constructor(storage?: TemplateStorage) {
    this.storage = storage || new TemplateStorage();
  }

  /**
   * Initialize the template manager
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  /**
   * Create a new template
   */
  async create(data: {
    name: string;
    description?: string;
    forwards: PortForwardConfig[];
    tags?: string[];
  }): Promise<Template> {
    // Validate template data
    this.validateTemplate(data);

    return await this.storage.create({
      name: data.name,
      description: data.description,
      forwards: data.forwards,
      tags: data.tags || [],
    });
  }

  /**
   * Get a template by ID
   */
  get(id: string): Template | undefined {
    return this.storage.get(id);
  }

  /**
   * Get a template by name
   */
  getByName(name: string): Template | undefined {
    const templates = this.storage.getAll();
    return templates.find((t) => t.name === name);
  }

  /**
   * Get all templates
   */
  getAll(): Template[] {
    return this.storage.getAll();
  }

  /**
   * Update a template
   */
  async update(
    id: string,
    updates: {
      name?: string;
      description?: string;
      forwards?: PortForwardConfig[];
      tags?: string[];
    }
  ): Promise<Template> {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    // Validate if forwards are being updated
    if (updates.forwards) {
      this.validateTemplate({ ...template, ...updates });
    }

    return await this.storage.update(id, updates);
  }

  /**
   * Delete a template
   */
  async delete(id: string): Promise<boolean> {
    return await this.storage.delete(id);
  }

  /**
   * Search templates
   */
  search(query: string): Template[] {
    return this.storage.search(query);
  }

  /**
   * Filter templates by tags
   */
  filterByTags(tags: string[]): Template[] {
    return this.storage.filterByTags(tags);
  }

  /**
   * Get all unique tags
   */
  getAllTags(): string[] {
    return this.storage.getAllTags();
  }

  /**
   * Add a port-forward to a template
   */
  async addForward(id: string, forward: PortForwardConfig): Promise<Template> {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    const forwards = [...template.forwards, forward];
    return await this.storage.update(id, { forwards });
  }

  /**
   * Remove a port-forward from a template
   */
  async removeForward(id: string, forwardIndex: number): Promise<Template> {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    if (forwardIndex < 0 || forwardIndex >= template.forwards.length) {
      throw new Error(`Invalid forward index: ${forwardIndex}`);
    }

    const forwards = template.forwards.filter((_, i) => i !== forwardIndex);
    return await this.storage.update(id, { forwards });
  }

  /**
   * Update a port-forward in a template
   */
  async updateForward(
    id: string,
    forwardIndex: number,
    updates: Partial<PortForwardConfig>
  ): Promise<Template> {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    if (forwardIndex < 0 || forwardIndex >= template.forwards.length) {
      throw new Error(`Invalid forward index: ${forwardIndex}`);
    }

    const forwards = [...template.forwards];
    forwards[forwardIndex] = { ...forwards[forwardIndex], ...updates };

    return await this.storage.update(id, { forwards });
  }

  /**
   * Reorder port-forwards in a template
   */
  async reorderForwards(id: string, newOrder: number[]): Promise<Template> {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    if (newOrder.length !== template.forwards.length) {
      throw new Error('New order must include all forwards');
    }

    // Validate that all indices are present
    const sortedOrder = [...newOrder].sort((a, b) => a - b);
    for (let i = 0; i < sortedOrder.length; i++) {
      if (sortedOrder[i] !== i) {
        throw new Error('Invalid order: missing or duplicate indices');
      }
    }

    const forwards = newOrder.map((index) => template.forwards[index]);
    return await this.storage.update(id, { forwards });
  }

  /**
   * Add tags to a template
   */
  async addTags(id: string, tags: string[]): Promise<Template> {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    const uniqueTags = Array.from(new Set([...template.tags, ...tags]));
    return await this.storage.update(id, { tags: uniqueTags });
  }

  /**
   * Remove tags from a template
   */
  async removeTags(id: string, tags: string[]): Promise<Template> {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    const remainingTags = template.tags.filter((tag) => !tags.includes(tag));
    return await this.storage.update(id, { tags: remainingTags });
  }

  /**
   * Export a template
   */
  export(id: string): string {
    return this.storage.exportTemplate(id);
  }

  /**
   * Export multiple templates
   */
  exportMultiple(ids: string[]): string {
    return this.storage.exportMultiple(ids);
  }

  /**
   * Import a template
   */
  async import(json: string): Promise<Template> {
    return await this.storage.importTemplate(json);
  }

  /**
   * Import multiple templates
   */
  async importMultiple(json: string): Promise<Template[]> {
    return await this.storage.importMultiple(json);
  }

  /**
   * Validate template data
   */
  private validateTemplate(data: {
    name: string;
    forwards: PortForwardConfig[];
  }): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Template name is required');
    }

    if (!data.forwards || data.forwards.length === 0) {
      throw new Error('Template must have at least one port-forward');
    }

    // Validate each forward
    for (const forward of data.forwards) {
      if (!forward.name || forward.name.trim().length === 0) {
        throw new Error('Port-forward name is required');
      }

      if (!forward.namespace || forward.namespace.trim().length === 0) {
        throw new Error('Port-forward namespace is required');
      }

      if (!forward.resourceName || forward.resourceName.trim().length === 0) {
        throw new Error('Port-forward resource name is required');
      }

      if (!forward.resourceType) {
        throw new Error('Port-forward resource type is required');
      }

      if (!forward.localPort || forward.localPort < 1 || forward.localPort > 65535) {
        throw new Error('Invalid local port number');
      }

      if (!forward.remotePort || forward.remotePort < 1 || forward.remotePort > 65535) {
        throw new Error('Invalid remote port number');
      }
    }

    // Check for duplicate forward names
    const names = data.forwards.map((f) => f.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate forward names: ${duplicates.join(', ')}`);
    }
  }

  /**
   * Duplicate a template
   */
  async duplicate(id: string, newName?: string): Promise<Template> {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template with id '${id}' not found`);
    }

    return await this.create({
      name: newName || `${template.name} (copy)`,
      description: template.description,
      forwards: template.forwards,
      tags: template.tags,
    });
  }

  /**
   * Get template count
   */
  getCount(): number {
    return this.storage.getAll().length;
  }

  /**
   * Check if a template name exists
   */
  nameExists(name: string, excludeId?: string): boolean {
    const templates = this.storage.getAll();
    return templates.some((t) => t.name === name && t.id !== excludeId);
  }
}
