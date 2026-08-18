import AppI18nProvider from '@src/shared/AppI18nProvider';
import AppThemeProvider from '@src/shared/AppThemeProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import PanelApp from './PanelApp';
import './index.css';

// HashRouter：Tauri 生产环境走 tauri:// 自定义协议，path 路由会 404；hash 路由零后端改动。
// panel 的 path 由 usePhaseRoute 镜像后端 Phase 状态机（单向、replace-only）。
createRoot(document.getElementById('panel-root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <AppI18nProvider>
        <HashRouter>
          <PanelApp />
        </HashRouter>
      </AppI18nProvider>
    </AppThemeProvider>
  </StrictMode>,
);
