import type { Phase } from '@src/shared/bindings';
import { alpha, Box } from '@mui/material';
import { commands } from '@src/shared/bindings';
import { logOnError, safeAwait } from '@src/shared/commands';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { CountdownRing } from './components/CountdownRing';
import { ExitButton } from './components/ExitButton';
import { WorkingView } from './components/WorkingView';
import { useTimerState } from './hooks/useTimerState';

export default function PanelApp() {
  const { isPaused, displayTime, progress, phase, togglePause, reset, manualBreak } = useTimerState();
  const hidingRef = useRef(false);
  const phaseRef = useRef<Phase>('working');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentWin = getCurrentWindow();
    const unlisten = currentWin.onFocusChanged(({ payload: focused }) => {
      if (!focused && !hidingRef.current && phaseRef.current !== 'alerting') {
        currentWin.hide();
      } else if (focused) {
        hidingRef.current = false;
      }
    });
    return () => {
      unlisten
        .then(fn => fn())
        .catch(err => console.warn('[onFocusChanged] unlisten failed:', err));
    };
  }, []);

  // phase 由 useTimerState 独占订阅，此处同步到 ref 供 onFocusChanged 闭包读取（避免 stale closure）。
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (rootRef.current) {
      const height = rootRef.current.offsetHeight;
      void logOnError(commands.fitPanel(height), 'fitPanel');
    }
  }, []);

  const handleSettings = useCallback(async () => {
    hidingRef.current = true;
    await logOnError(commands.showSettingsWindow(), 'showSettingsWindow');
  }, []);

  const handleExit = useCallback(async () => {
    await safeAwait(commands.exitApp(), 'exitApp');
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
      {phase === 'working'
        ? (
            <WorkingView
              displayTime={displayTime}
              progress={progress}
              isPaused={isPaused}
              onToggle={togglePause}
              onManualBreak={manualBreak}
              onSettings={handleSettings}
            />
          )
        : (
            <>
              <CountdownRing phase={phase} displayTime={displayTime} progress={progress} />
              <ActionButtons
                isPaused={isPaused}
                onToggle={togglePause}
                onReset={reset}
                onSettings={handleSettings}
              />
            </>
          )}
      <ExitButton onExit={handleExit} />
    </Box>
  );
}
