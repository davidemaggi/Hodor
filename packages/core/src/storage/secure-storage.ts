import { Entry, findCredentials } from '@napi-rs/keyring';

const SERVICE_NAME = 'com.hodor.app';

export class SecureStorageUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      `The system keychain is not available (${cause}). ` +
        'On Linux install and unlock a Secret Service provider such as gnome-keyring or KWallet.'
    );
    this.name = 'SecureStorageUnavailableError';
  }
}

/**
 * Secure storage for sensitive data, backed by the OS keychain
 * (macOS Keychain, Windows Credential Manager, Linux Secret Service).
 *
 * There is deliberately no plain-file fallback: if the keychain is missing we fail loudly
 * instead of silently writing secrets to disk.
 */
export class SecureStorage {
  constructor(private service: string = SERVICE_NAME) {}

  private entry(key: string): Entry {
    return new Entry(this.service, key);
  }

  private wrap<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error: any) {
      if (/no (matching )?entry|not found/i.test(String(error?.message))) {
        throw error;
      }
      throw new SecureStorageUnavailableError(error?.message || error);
    }
  }

  /**
   * Store a secret value
   */
  async setSecret(key: string, value: string): Promise<void> {
    this.wrap(() => this.entry(key).setPassword(value));
  }

  /**
   * Retrieve a secret value, or null if it does not exist
   */
  async getSecret(key: string): Promise<string | null> {
    try {
      return this.wrap(() => this.entry(key).getPassword()) ?? null;
    } catch (error) {
      if (error instanceof SecureStorageUnavailableError) throw error;
      return null;
    }
  }

  /**
   * Delete a secret. Returns false if it did not exist.
   */
  async deleteSecret(key: string): Promise<boolean> {
    try {
      return this.wrap(() => this.entry(key).deletePassword());
    } catch (error) {
      if (error instanceof SecureStorageUnavailableError) throw error;
      return false;
    }
  }

  /**
   * List the keys stored by Hodor
   */
  async findCredentials(): Promise<Array<{ account: string }>> {
    return this.wrap(() => findCredentials(this.service)).map((c) => ({ account: c.account }));
  }

  /**
   * Remove every secret stored by Hodor
   */
  async clearAll(): Promise<void> {
    for (const cred of await this.findCredentials()) {
      await this.deleteSecret(cred.account);
    }
  }
}
