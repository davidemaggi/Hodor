import { Template, PortForwardConfig } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates templates and their configuration
 */
export class TemplateValidator {
  /**
   * Validate a template
   */
  validate(template: Template): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic fields
    if (!template.id) {
      errors.push('Template ID is missing');
    }

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (template.name && template.name.length > 100) {
      warnings.push('Template name is very long (>100 characters)');
    }

    if (!template.forwards || template.forwards.length === 0) {
      errors.push('Template must have at least one port-forward');
    }

    if (template.forwards && template.forwards.length > 50) {
      warnings.push('Template has many port-forwards (>50), this might be slow');
    }

    // Validate forwards
    if (template.forwards) {
      for (let i = 0; i < template.forwards.length; i++) {
        const forwardErrors = this.validateForward(template.forwards[i], i);
        errors.push(...forwardErrors);
      }
    }

    // Check for duplicate forward names
    if (template.forwards) {
      const names = template.forwards.map((f) => f.name);
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
      if (duplicates.length > 0) {
        errors.push(`Duplicate forward names: ${[...new Set(duplicates)].join(', ')}`);
      }
    }

    // Check for port conflicts
    if (template.forwards) {
      const localPorts = template.forwards.map((f) => f.localPort);
      const duplicatePorts = localPorts.filter((port, index) => localPorts.indexOf(port) !== index);
      if (duplicatePorts.length > 0) {
        errors.push(`Duplicate local ports: ${[...new Set(duplicatePorts)].join(', ')}`);
      }
    }

    // Validate tags
    if (template.tags) {
      for (const tag of template.tags) {
        if (tag.length > 50) {
          warnings.push(`Tag '${tag}' is very long (>50 characters)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a port-forward configuration
   */
  validateForward(forward: PortForwardConfig, index?: number): string[] {
    const errors: string[] = [];
    const prefix = index !== undefined ? `Forward #${index + 1}` : 'Forward';

    if (!forward.name || forward.name.trim().length === 0) {
      errors.push(`${prefix}: Name is required`);
    }

    if (!forward.namespace || forward.namespace.trim().length === 0) {
      errors.push(`${prefix}: Namespace is required`);
    }

    if (!forward.resourceName || forward.resourceName.trim().length === 0) {
      errors.push(`${prefix}: Resource name is required`);
    }

    if (!forward.resourceType) {
      errors.push(`${prefix}: Resource type is required`);
    } else if (!['pod', 'service', 'deployment'].includes(forward.resourceType)) {
      errors.push(`${prefix}: Invalid resource type '${forward.resourceType}'`);
    }

    if (!forward.localPort || forward.localPort < 1 || forward.localPort > 65535) {
      errors.push(`${prefix}: Invalid local port number`);
    }

    if (!forward.remotePort || forward.remotePort < 1 || forward.remotePort > 65535) {
      errors.push(`${prefix}: Invalid remote port number`);
    }

    // Well-known ports check
    if (forward.localPort && forward.localPort < 1024) {
      errors.push(
        `${prefix}: Local port ${forward.localPort} is a privileged port (<1024), may require root`
      );
    }

    return errors;
  }

  /**
   * Check if a template can be executed on a cluster
   */
  async validateForExecution(template: Template): Promise<ValidationResult> {
    const result = this.validate(template);

    // Additional checks for execution
    if (result.valid) {
      // Check for common port conflicts
      const commonPorts = [22, 80, 443, 3000, 8080];
      for (const forward of template.forwards) {
        if (commonPorts.includes(forward.localPort)) {
          result.warnings.push(
            `Forward '${forward.name}' uses common port ${forward.localPort}, it might be already in use`
          );
        }
      }
    }

    return result;
  }
}
