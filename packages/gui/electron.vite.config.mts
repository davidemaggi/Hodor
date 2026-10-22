import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { csp } from './csp.mjs';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), csp()],
    build: { target: 'chrome140' },
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  },
});
