import * as keytar from 'keytar';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const SERVICE_NAME = 'com.hodor.app';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Secure storage for sensitive data using the system keychain
 */
export class SecureStorage {
  private fallbackEncryption: boolean = false;
  private masterKey: Buffer | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize secure storage
   */
  private async initialize(): Promise<void> {
    try {
      // Test if keytar is available
      await keytar.getPassword(SERVICE_NAME, 'test');
      this.fallbackEncryption = false;
    } catch (error) {
      console.warn('Keytar not available, falling back to encrypted storage');
      this.fallbackEncryption = true;
      await this.initializeMasterKey();
    }
  }

  /**
   * Initialize master key for fallback encryption
   */
  private async initializeMasterKey(): Promise<void> {
    // In fallback mode, we generate a master key
    // In production, this should be stored more securely or derived from user input
    this.masterKey = randomBytes(32);
  }

  /**
   * Store a secret value
   */
  async setSecret(key: string, value: string): Promise<void> {
    try {
      if (this.fallbackEncryption) {
        await this.setSecretEncrypted(key, value);
      } else {
        await keytar.setPassword(SERVICE_NAME, key, value);
      }
    } catch (error) {
      throw new Error(`Failed to store secret '${key}': ${error}`);
    }
  }

  /**
   * Retrieve a secret value
   */
  async getSecret(key: string): Promise<string | null> {
    try {
      if (this.fallbackEncryption) {
        return await this.getSecretEncrypted(key);
      } else {
        return await keytar.getPassword(SERVICE_NAME, key);
      }
    } catch (error) {
      throw new Error(`Failed to retrieve secret '${key}': ${error}`);
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(key: string): Promise<boolean> {
    try {
      if (this.fallbackEncryption) {
        return await this.deleteSecretEncrypted(key);
      } else {
        return await keytar.deletePassword(SERVICE_NAME, key);
      }
    } catch (error) {
      throw new Error(`Failed to delete secret '${key}': ${error}`);
    }
  }

  /**
   * Find all stored credentials
   */
  async findCredentials(): Promise<Array<{ account: string }>> {
    try {
      if (this.fallbackEncryption) {
        // In fallback mode, we can't easily list all keys
        return [];
      } else {
        return await keytar.findCredentials(SERVICE_NAME);
      }
    } catch (error) {
      throw new Error(`Failed to find credentials: ${error}`);
    }
  }

  /**
   * Store encrypted secret (fallback method)
   */
  private async setSecretEncrypted(key: string, value: string): Promise<void> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.masterKey, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const stored = JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted,
    });

    // Store in a simple file-based storage (for fallback only)
    // In production, you might want to use electron-store or similar
    global.hodorSecureStorage = global.hodorSecureStorage || {};
    global.hodorSecureStorage[key] = stored;
  }

  /**
   * Retrieve encrypted secret (fallback method)
   */
  private async getSecretEncrypted(key: string): Promise<string | null> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    global.hodorSecureStorage = global.hodorSecureStorage || {};
    const stored = global.hodorSecureStorage[key];

    if (!stored) {
      return null;
    }

    const { iv, authTag, encrypted } = JSON.parse(stored);

    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.masterKey,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Delete encrypted secret (fallback method)
   */
  private async deleteSecretEncrypted(key: string): Promise<boolean> {
    global.hodorSecureStorage = global.hodorSecureStorage || {};

    if (global.hodorSecureStorage[key]) {
      delete global.hodorSecureStorage[key];
      return true;
    }

    return false;
  }

  /**
   * Clear all secrets (use with caution!)
   */
  async clearAll(): Promise<void> {
    if (this.fallbackEncryption) {
      global.hodorSecureStorage = {};
    } else {
      const credentials = await this.findCredentials();
      for (const cred of credentials) {
        await this.deleteSecret(cred.account);
      }
    }
  }
}

// Type augmentation for global storage
declare global {
  var hodorSecureStorage: Record<string, string>;
}
