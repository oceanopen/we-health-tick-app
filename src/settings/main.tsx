import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppThemeProvider from '../shared/AppThemeProvider';
import SettingsApp from './SettingsApp';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <SettingsApp />
    </AppThemeProvider>
  </StrictMode>,
);
