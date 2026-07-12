import type { TimerStatePayload } from '@src/shared/bindings';
import { commands } from '@src/shared/bindings';
import { logOnError } from '@src/shared/commands';
import {
  BREAK_SKIP_MAX_KEY,
  decodeQuietHours,
  DEFAULT_BREAK_SKIP_MAX,
  DEFAULT_QUIET_HOURS,
  MAX_BREAK_SKIP_MAX,
  MIN_BREAK_SKIP_MAX,
  QUIET_HOURS_KEY,
} from '@src/shared/config';
import {
  EVENT_PHASE_CHANGED,
  EVENT_TIMER_TICK,
} from '@src/shared/events';
import { useConfigValue } from '@src/shared/useConfigValue';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';

// 与后端 DEFAULT_WORK_DURATION=30 分钟对齐；mount 后立即被 get_timer_state 覆盖。
const INITIAL_STATE: TimerStatePayload = {
  phase: 'working',
  prevPhase: null,
  remainingSeconds: 30 * 60,
  totalSeconds: 30 * 60,
  currentWhisperReminder: '',
  currentHealthReminder: '',
  isLongBreak: false,
  breakSkipCount: 0,
  completedCycles: 0,
  quietTriggered: false,
  breakPaused: false,
};

function formatDisplayTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 模块级 decode：稳定引用，避免 useConfigValue 每次渲染重复订阅。
// 与后端 read_break_skip_max 对齐：clamp 到 [MIN,MAX]，非有限数回落默认。
function decodeBreakSkipMax(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.min(MAX_BREAK_SKIP_MAX, Math.max(MIN_BREAK_SKIP_MAX, Math.trunc(n)))
    : DEFAULT_BREAK_SKIP_MAX;
}

export function useTimerState() {
  const [state, setState] = useState<TimerStatePayload>(INITIAL_STATE);

  // break_skip_max / quiet_hours：经 useConfigValue 订阅（mount 读 + config-changed 实时刷新，
  // 用户在设置页改完后 panel 立即更新），解码在模块级 decode 函数中完成。
  // quiet_hours 供 PausedView 在 quietTriggered 时显示休息时段范围（如 "22:00:00 - 07:00:00"）。
  const breakSkipMax = useConfigValue(BREAK_SKIP_MAX_KEY, decodeBreakSkipMax, DEFAULT_BREAK_SKIP_MAX);
  const quietHours = useConfigValue(QUIET_HOURS_KEY, decodeQuietHours, DEFAULT_QUIET_HOURS);

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
  const confirmBreak = useCallback(() => logOnError(commands.confirmBreak(), 'confirmBreak'), []);
  const confirmReturn = useCallback(() => logOnError(commands.confirmReturn(), 'confirmReturn'), []);
  const skipBreak = useCallback(() => logOnError(commands.skipBreak(), 'skipBreak'), []);

  const { remainingSeconds, totalSeconds, phase } = state;
  const displayTime = formatDisplayTime(remainingSeconds);
  const progress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;
  const isPaused = phase === 'paused';

  return {
    phase,
    remainingSeconds,
    totalSeconds,
    currentWhisperReminder: state.currentWhisperReminder,
    currentHealthReminder: state.currentHealthReminder,
    isLongBreak: state.isLongBreak,
    breakSkipCount: state.breakSkipCount,
    breakPaused: state.breakPaused,
    breakSkipMax,
    quietHours,
    completedCycles: state.completedCycles,
    quietTriggered: state.quietTriggered,
    displayTime,
    progress,
    isPaused,
    togglePause,
    reset,
    manualBreak,
    confirmBreak,
    confirmReturn,
    skipBreak,
  };
}
