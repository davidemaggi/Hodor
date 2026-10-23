import { defineConfig } from 'vitest/config';

// Unit tests only; the Playwright suites in e2e/ run with `pnpm e2e`
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
