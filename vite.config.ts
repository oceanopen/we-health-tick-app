import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@src': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        settings: resolve(__dirname, 'settings.html'),
        panel: resolve(__dirname, 'panel.html'),
      },
    },
  },
});
