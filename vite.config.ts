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
  server: {
    // strictPort 必须为 true —— tauri.conf.json 的 devUrl 固定指向此端口，端口被占时必须报错而非递增，
    // 否则 vite 跳到 7102 会导致 tauri webview 连不上 dev server。
    port: 7101,
    strictPort: true,
  },
});
