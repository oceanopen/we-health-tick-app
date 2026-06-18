import type { Phase, TimerStatePayload } from '@src/shared/bindings';
import { alpha, Box } from '@mui/material';
import { commands } from '@src/shared/bindings';
import { logOnError, safeAwait } from '@src/shared/commands';
import { EVENT_PHASE_CHANGED } from '@src/shared/events';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { CountdownRing } from './components/CountdownRing';
import { ExitButton } from './components/ExitButton';
import { useTimer } from './hooks/useTimer';

export default function PanelApp() {
  const { isPaused, isExpired, displayTime, progress, toggle, reset } = useTimer();
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
      unlisten.then(fn => fn());
    };
  }, []);

  // 订阅 phase-changed：把最新 phase 写入 phaseRef，避免 onFocusChanged 闭包读到旧值（I2 已消费此 ref）。
  useEffect(() => {
    const unlistenPromise = listen<TimerStatePayload>(EVENT_PHASE_CHANGED, (e) => {
      phaseRef.current = e.payload.phase;
      console.log('[PanelApp] phase →', e.payload.phase);
    });
    return () => {
      unlistenPromise.then(fn => fn());
    };
  }, []);

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
