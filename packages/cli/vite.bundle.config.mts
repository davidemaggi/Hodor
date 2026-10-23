import { defineConfig } from 'vite';

/**
 * One-file CLI for the desktop app (packages/gui ships it as resources/cli/hodor.mjs and runs it on
 * Electron's Node). Every dependency is bundled; the keychain binding is native and never used by the CLI.
 */
export default defineConfig({
  build: {
    ssr: 'src/index.ts',
    outDir: 'bundle',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: ['@napi-rs/keyring'],
      output: {
        format: 'es',
        entryFileNames: 'hodor.mjs',
        inlineDynamicImports: true,
        // A transitive dependency of the Kubernetes client uses Node's deprecated punycode: keep that noise off the terminal
        banner: '#!/usr/bin/env node\nprocess.noDeprecation = true;',
      },
    },
  },
  ssr: { noExternal: true, target: 'node' },
});
