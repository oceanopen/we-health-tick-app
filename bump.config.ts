import { defineConfig } from 'bumpp';

export default defineConfig({
  files: [
    'package.json',
    'src-tauri/Cargo.toml',
    'src-tauri/tauri.conf.json',
  ],
  execute: 'cargo generate-lockfile --manifest-path src-tauri/Cargo.toml',
});
