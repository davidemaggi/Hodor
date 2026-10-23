import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { csp } from './csp.mjs';

/**
 * Browser-only preview with sample data, for design reviews (Taste/Impeccable) and screenshots.
 * Never used for the real app.
 */
export default defineConfig({
  root: 'src/renderer',
  mode: 'fixtures',
  plugins: [react(), csp()],
  server: { port: 5199, strictPort: true },
  build: { target: 'esnext', outDir: '../../out/fixtures', emptyOutDir: true },
});
