import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        settings: resolve(__dirname, 'settings.html'),
        panel: resolve(__dirname, 'panel.html'),
      },
    },
  },
});
