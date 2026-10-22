import { describe, it, expect, afterAll } from 'vitest';
import { SecureStorage } from '../../src/storage/secure-storage';

/** Touches the real OS keychain under a throwaway service name. Opt in with HODOR_KEYCHAIN_IT=1. */
describe.skipIf(!process.env.HODOR_KEYCHAIN_IT)('SecureStorage against the OS keychain', () => {
  const storage = new SecureStorage(`com.hodor.app.test.${process.pid}`);

  afterAll(() => storage.clearAll());

  it('stores, lists, reads and deletes secrets', async () => {
    await storage.setSecret('conn', 's3cr3t');
    expect(await storage.getSecret('conn')).toBe('s3cr3t');
    expect((await storage.findCredentials()).map((c) => c.account)).toContain('conn');
    expect(await storage.deleteSecret('conn')).toBe(true);
    expect(await storage.getSecret('conn')).toBeNull();
    expect(await storage.deleteSecret('conn')).toBe(false);
  });
});
