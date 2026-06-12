import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SettingsApp from './SettingsApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>,
);
