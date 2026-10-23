import type * as Keyring from '@napi-rs/keyring';

import { APP_ID } from '../app-id';

const SERVICE_NAME = APP_ID;

let keyringModule: typeof Keyring | undefined;

/**
 * Load the native keychain binding on first use, so tools that never touch secrets (the CLI, an app
 * build that doesn't ship it) don't need the native module at all.
 */
function keyring(): typeof Keyring {
  if (!keyringModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      keyringModule = require('@napi-rs/keyring') as typeof Keyring;
    } catch (error) {
      throw new SecureStorageUnavailableError(`native keychain module not available: ${error}`);
    }
  }
  return keyringModule;
}

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

  private entry(key: string): Keyring.Entry {
    return new (keyring().Entry)(this.service, key);
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
    return this.wrap(() => keyring().findCredentials(this.service)).map((c) => ({
      account: c.account,
    }));
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
