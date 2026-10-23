/**
 * Validation utilities
 */

/**
 * Validate port number
 */
export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate Kubernetes resource name
 */
export function validateResourceName(name: string): boolean {
  // Kubernetes resource names must match: [a-z0-9]([-a-z0-9]*[a-z0-9])?
  const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  return regex.test(name);
}

/**
 * Validate namespace name
 */
export function validateNamespace(namespace: string): boolean {
  return validateResourceName(namespace);
}

/**
 * Validate tag
 */
export function validateTag(tag: string): boolean {
  return tag.length > 0 && tag.length <= 50;
}

/**
 * Sanitize string for use as filename
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
}

/**
 * Check if string is empty or whitespace
 */
export function isEmpty(str: string | undefined | null): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Validate URL
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
