import type { ConfigChangedPayload, TimerStatePayload } from '@src/shared/bindings';
import { commands } from '@src/shared/bindings';
import { logOnError } from '@src/shared/commands';
import {
  BREAK_SKIP_MAX_KEY,
  DEFAULT_BREAK_SKIP_MAX,
  getConfig,
  MAX_BREAK_SKIP_MAX,
  MIN_BREAK_SKIP_MAX,
} from '@src/shared/config';
import {
  EVENT_CONFIG_CHANGED,
  EVENT_PHASE_CHANGED,
  EVENT_TIMER_TICK,
} from '@src/shared/events';
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
  const [breakSkipMax, setBreakSkipMax] = useState(DEFAULT_BREAK_SKIP_MAX);

  // 读取休息跳过门槛（break_skip_max 配置）：mount 读一次 + 监听 config-changed 实时刷新
  // （用户在设置页改完后 panel 立即更新分母）。值 clamp 到 [MIN,MAX]，与后端 read_break_skip_max 对齐。
  useEffect(() => {
    const apply = (raw: string | null) => {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        setBreakSkipMax(Math.min(MAX_BREAK_SKIP_MAX, Math.max(MIN_BREAK_SKIP_MAX, Math.trunc(n))));
      }
    };
    let cancelled = false;
    void (async () => {
      const v = await getConfig(BREAK_SKIP_MAX_KEY);
      if (!cancelled) {
        apply(v);
      }
    })();
    const promise = listen<ConfigChangedPayload>(EVENT_CONFIG_CHANGED, (e) => {
      if (e.payload.key === BREAK_SKIP_MAX_KEY) {
        apply(e.payload.value);
      }
    });
    return () => {
      cancelled = true;
      promise
        .then(fn => fn())
        .catch(err => console.warn('[breakSkipMax] unlisten failed:', err));
    };
  }, []);

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
    currentReminder: state.currentReminder,
    isLongBreak: state.isLongBreak,
    breakSkipCount: state.breakSkipCount,
    breakSkipMax,
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
