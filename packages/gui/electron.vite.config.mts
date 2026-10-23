import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { csp } from './csp.mjs';

// The packaged app ships no node_modules: main and preload are bundled with every dependency.
// The keychain binding is native and loaded lazily by @hodor/core; nothing in 1.0 uses it, so it isn't shipped.
const NATIVE = ['@napi-rs/keyring'];

export default defineConfig({
  main: {
    build: { externalizeDeps: false, rollupOptions: { external: NATIVE } },
  },
  preload: {
    build: { externalizeDeps: false },
  },
  renderer: {
    plugins: [react(), csp()],
    build: { target: 'chrome140' },
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  },
});
