import { execSync } from 'node:child_process';
import { defineConfig } from 'bumpp';

export default defineConfig({
  files: [
    'package.json',
    'src-tauri/Cargo.toml',
    'src-tauri/tauri.conf.json',
  ],
  execute: () => {
    execSync('cargo generate-lockfile --manifest-path src-tauri/Cargo.toml', { stdio: 'inherit' });
    execSync('git add src-tauri/Cargo.lock', { stdio: 'inherit' });
  },
});
