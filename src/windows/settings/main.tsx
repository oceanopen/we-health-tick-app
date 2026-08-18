import AppI18nProvider from '@src/shared/AppI18nProvider';
import AppThemeProvider from '@src/shared/AppThemeProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import SettingsApp from './SettingsApp';
import './index.css';

// HashRouter：Tauri 生产环境走 tauri:// 自定义协议，path 路由会 404；hash 路由零后端改动，
// 且首开深链可直接拼 settings.html#/section 初始 URL。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <AppI18nProvider>
        <HashRouter>
          <SettingsApp />
        </HashRouter>
      </AppI18nProvider>
    </AppThemeProvider>
  </StrictMode>,
);
