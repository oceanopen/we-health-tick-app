import type { Phase } from '@src/shared/bindings';
import { alpha, Box } from '@mui/material';
import { commands } from '@src/shared/bindings';
import { logOnError } from '@src/shared/commands';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useRef } from 'react';
import { AlertingView } from './components/AlertingView';
import { BreakingView } from './components/BreakingView';
import { PausedView } from './components/PausedView';
import { WaitingView } from './components/WaitingView';
import { WorkingView } from './components/WorkingView';
import { useTimerState } from './hooks/useTimerState';

export default function PanelApp() {
  const {
    isPaused,
    displayTime,
    progress,
    phase,
    currentWhisperReminder,
    currentHealthReminder,
    isLongBreak,
    breakSkipCount,
    breakSkipMax,
    breakPaused,
    quietHours,
    togglePause,
    reset,
    manualBreak,
    confirmBreak,
    confirmReturn,
    skipBreak,
    quietTriggered,
    remainingSeconds,
  } = useTimerState();
  const phaseRef = useRef<Phase>('working');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentWin = getCurrentWindow();
    const unlisten = currentWin.onFocusChanged(({ payload: focused }) => {
      // 仅 Working 阶段失焦隐藏；Alerting/Breaking/Waiting/Paused 常驻桌面，由后端 phase-changed 事件唤起。
      if (!focused && phaseRef.current === 'working') {
        currentWin.hide();
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

  // 任意 phase 切换 / reminder 变化导致 root 高度变化时，重新 fitPanel 让窗口高度跟随。
  // ResizeObserver 在 observe 后会异步触发一次首回调，等价于原 mount 即 fit 的语义。
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const height = root.offsetHeight;
        void logOnError(commands.fitPanel(height), 'fitPanel');
      });
    });
    observer.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <Box
      ref={rootRef}
      sx={theme => ({
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        px: 1.5,
        gap: 1.5,
        userSelect: 'none',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        bgcolor: alpha(theme.palette.background.default, 0.65),
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
              onReset={reset}
              onManualBreak={manualBreak}
            />
          )
        : phase === 'alerting'
          ? (
              <AlertingView
                whisperReminder={currentWhisperReminder}
                breakSkipCount={breakSkipCount}
                breakSkipMax={breakSkipMax}
                onStartBreak={confirmBreak}
                onSkip={skipBreak}
              />
            )
          : phase === 'breaking'
            ? (
                <BreakingView
                  displayTime={displayTime}
                  progress={progress}
                  whisperReminder={currentWhisperReminder}
                  healthReminder={currentHealthReminder}
                  isLongBreak={isLongBreak}
                  breakSkipCount={breakSkipCount}
                  breakSkipMax={breakSkipMax}
                  breakPaused={breakPaused}
                  onSkip={skipBreak}
                />
              )
            : phase === 'waiting'
              ? (
                  <WaitingView onReturn={confirmReturn} />
                )
              : phase === 'paused'
                ? (
                    <PausedView
                      remainingSeconds={remainingSeconds}
                      quietTriggered={quietTriggered}
                      quietHours={quietHours}
                      onResume={togglePause}
                    />
                  )
                : (
                    <Box sx={{ py: 4, color: 'error.main', fontSize: 14 }}>
                      未识别状态: {phase}
                    </Box>
                  )}
    </Box>
  );
}
