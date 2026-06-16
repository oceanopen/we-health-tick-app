import { alpha, Box } from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { CountdownRing } from './components/CountdownRing';
import { ExitButton } from './components/ExitButton';
import { useTimer } from './hooks/useTimer';

export default function PanelApp() {
  const { isPaused, isExpired, displayTime, progress, toggle, reset } = useTimer();
  const hidingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentWin = getCurrentWindow();
    const unlisten = currentWin.onFocusChanged(({ payload: focused }) => {
      if (!focused && !hidingRef.current) {
        currentWin.hide();
      } else if (focused) {
        hidingRef.current = false;
      }
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    if (rootRef.current) {
      const height = rootRef.current.offsetHeight;
      invoke('fit_panel', { height });
    }
  }, []);

  const handleSettings = useCallback(async () => {
    hidingRef.current = true;
    await invoke('show_settings_window');
  }, []);

  const handleExit = useCallback(async () => {
    await invoke('exit_app');
  }, []);

  return (
    <Box
      ref={rootRef}
      data-tauri-drag-region
      sx={theme => ({
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        px: 1.5,
        gap: 1.5,
        userSelect: 'none',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        bgcolor: alpha(theme.palette.background.default, 0.5),
        borderRadius: '12px',
        border: 1,
        borderColor: 'divider',
      })}
    >
      <CountdownRing displayTime={displayTime} progress={progress} isExpired={isExpired} />
      <ActionButtons
        isPaused={isPaused}
        onToggle={toggle}
        onReset={reset}
        onSettings={handleSettings}
      />
      <ExitButton onExit={handleExit} />
    </Box>
  );
}
