import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppThemeProvider from '../shared/AppThemeProvider';
import PanelApp from './PanelApp';
import './PanelApp.css';

createRoot(document.getElementById('panel-root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <PanelApp />
    </AppThemeProvider>
  </StrictMode>,
);
