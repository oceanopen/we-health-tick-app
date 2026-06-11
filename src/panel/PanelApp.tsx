import { Box } from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { CountdownRing } from './components/CountdownRing';
import { ExitButton } from './components/ExitButton';
import { useTimer } from './hooks/useTimer';

export default function PanelApp() {
  const { isPaused, isExpired, displayTime, progress, toggle, reset } = useTimer();

  useEffect(() => {
    const currentWin = getCurrentWindow();
    const unlisten = currentWin.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        currentWin.hide();
      }
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleSettings = useCallback(async () => {
    const mainWin = await WebviewWindow.getByLabel('main');
    if (mainWin) {
      await mainWin.show();
      await mainWin.setFocus();
    }
  }, []);

  const handleExit = useCallback(async () => {
    await invoke('exit_app');
  }, []);

  return (
    <Box
      data-tauri-drag-region
      sx={{
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        px: 1.5,
        gap: 1.5,
        userSelect: 'none',
      }}
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
