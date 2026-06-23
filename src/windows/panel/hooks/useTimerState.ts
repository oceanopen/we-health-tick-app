import type { TimerStatePayload } from '@src/shared/bindings';
import { commands } from '@src/shared/bindings';
import { logOnError } from '@src/shared/commands';
import { EVENT_PHASE_CHANGED, EVENT_TIMER_TICK } from '@src/shared/events';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';

// 与后端 DEFAULT_WORK_DURATION=30 分钟对齐；mount 后立即被 get_timer_state 覆盖。
const INITIAL_STATE: TimerStatePayload = {
  phase: 'working',
  prevPhase: null,
  remainingSeconds: 30 * 60,
  totalSeconds: 30 * 60,
  currentReminder: '',
  isLongBreak: false,
  breakSkipCount: 0,
  completedCycles: 0,
  quietTriggered: false,
};

function formatDisplayTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useTimerState() {
  const [state, setState] = useState<TimerStatePayload>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await commands.getTimerState();
      if (cancelled) {
        return;
      }
      if (r.status === 'ok') {
        setState(r.data);
      } else {
        console.warn('[getTimerState]', r.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tickPromise = listen<TimerStatePayload>(EVENT_TIMER_TICK, e => setState(e.payload));
    const phasePromise = listen<TimerStatePayload>(EVENT_PHASE_CHANGED, e => setState(e.payload));
    return () => {
      const safeUnlisten = (p: Promise<() => void>) => {
        p
          .then(fn => fn())
          .catch(err => console.warn('[timer] unlisten failed:', err));
      };

      void safeUnlisten(tickPromise);
      void safeUnlisten(phasePromise);
    };
  }, []);

  const togglePause = useCallback(() => logOnError(commands.togglePause(), 'togglePause'), []);
  const reset = useCallback(() => logOnError(commands.reset(), 'reset'), []);
  const manualBreak = useCallback(() => logOnError(commands.manualBreak(), 'manualBreak'), []);
  const skipBreak = useCallback(() => logOnError(commands.skipBreak(), 'skipBreak'), []);

  const { remainingSeconds, totalSeconds, phase } = state;
  const displayTime = formatDisplayTime(remainingSeconds);
  const progress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;
  const isPaused = phase === 'paused';
  const isExpired = remainingSeconds === 0;

  return {
    phase,
    remainingSeconds,
    totalSeconds,
    currentReminder: state.currentReminder,
    isLongBreak: state.isLongBreak,
    breakSkipCount: state.breakSkipCount,
    completedCycles: state.completedCycles,
    quietTriggered: state.quietTriggered,
    displayTime,
    progress,
    isPaused,
    isExpired,
    togglePause,
    reset,
    manualBreak,
    skipBreak,
  };
}
