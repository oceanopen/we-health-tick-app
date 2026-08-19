import type { Phase } from '@src/shared/bindings';
import { alpha, Box } from '@mui/material';
import { commands } from '@src/shared/bindings';
import { logOnError } from '@src/shared/commands';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AlertingView } from './components/AlertingView';
import { BreakingView } from './components/BreakingView';
import { PausedView } from './components/PausedView';
import { WaitingView } from './components/WaitingView';
import { WorkingView } from './components/WorkingView';
import { usePhaseRoute } from './hooks/usePhaseRoute';
import { useTimerState } from './hooks/useTimerState';
import { PHASE_PATHS, phaseToPath } from './routes';

export default function PanelApp() {
  const {
    isPaused,
    displayTime,
    progress,
    phase,
    currentWhisperReminder,
    currentHealthReminder,
    isLongBreak,
    nextBreakIsLong,
    breakSkipCount,
    breakSkipMax,
    skipCountReminder,
    todaySkipCount,
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
  // 镜像层：phase → URL 单向同步（replace-only，见 hook 头注释）。useTimerState 留在本组件
  // 顶层且不进 Routes——路由元素以 props 内联接收，phase 切换不重挂 hook、不闪 INITIAL_STATE。
  usePhaseRoute(phase);
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
      {/* 声明式路由：path 是后端 Phase 状态机的单向镜像（usePhaseRoute 纠偏）。
          root Box（ResizeObserver 挂载体）保持在 Routes 外部且永不卸载，高度自适应链路不受路由影响。
          '/' 与未知路径 replace 归一到当前 phase（Phase 为闭集，无额外兜底分支需求）。 */}
      <Routes>
        <Route path="/" element={<Navigate to={phaseToPath(phase)} replace />} />
        <Route
          path={PHASE_PATHS.working}
          element={(
            <WorkingView
              displayTime={displayTime}
              progress={progress}
              isPaused={isPaused}
              nextBreakIsLong={nextBreakIsLong}
              onToggle={togglePause}
              onReset={reset}
              onManualBreak={manualBreak}
            />
          )}
        />
        <Route
          path={PHASE_PATHS.alerting}
          element={(
            <AlertingView
              whisperReminder={currentWhisperReminder}
              isLongBreak={isLongBreak}
              breakSkipCount={breakSkipCount}
              breakSkipMax={breakSkipMax}
              todaySkipCount={todaySkipCount}
              skipCountReminder={skipCountReminder}
              onStartBreak={confirmBreak}
              onSkip={skipBreak}
            />
          )}
        />
        <Route
          path={PHASE_PATHS.breaking}
          element={(
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
          )}
        />
        <Route
          path={PHASE_PATHS.waiting}
          element={(
            <WaitingView
              isLongBreak={isLongBreak}
              onReturn={confirmReturn}
            />
          )}
        />
        <Route
          path={PHASE_PATHS.paused}
          element={(
            <PausedView
              remainingSeconds={remainingSeconds}
              quietTriggered={quietTriggered}
              quietHours={quietHours}
              onResume={togglePause}
            />
          )}
        />
        <Route path="*" element={<Navigate to={phaseToPath(phase)} replace />} />
      </Routes>
    </Box>
  );
}
