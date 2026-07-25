import type { Appearance } from './appConfig';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { useMemo } from 'react';
import { APPEARANCE_KEY, DEFAULT_APPEARANCE } from './appConfig';
import { useAppConfigValue } from './useAppConfigValue';
import { useSystemThemeMode } from './useSystemTheme';

interface Props {
  children: React.ReactNode;
}

function isAppearance(v: string | null): v is Appearance {
  return v === 'system' || v === 'light' || v === 'dark';
}

// 模块级 decode：稳定引用，避免 useAppConfigValue 每次渲染重复订阅。
function decodeAppearance(v: string | null): Appearance {
  return isAppearance(v) ? v : DEFAULT_APPEARANCE;
}

export default function AppThemeProvider({ children }: Props) {
  const appearance = useAppConfigValue(APPEARANCE_KEY, decodeAppearance, DEFAULT_APPEARANCE);
  const systemMode = useSystemThemeMode();

  const resolvedMode = appearance === 'system' ? systemMode : appearance;

  const theme = useMemo(
    () => createTheme({ palette: { mode: resolvedMode } }),
    [resolvedMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
