import type { TimerStatePayload } from '@src/shared/bindings';
import {
  BREAK_SKIP_MAX_KEY,
  decodeQuietHours,
  decodeSkipCountReminder,
  DEFAULT_BREAK_SKIP_MAX,
  DEFAULT_LONG_BREAK_ENABLED,
  DEFAULT_LONG_BREAK_INTERVAL,
  DEFAULT_QUIET_HOURS,
  DEFAULT_SKIP_BREAK_ALLOWED,
  DEFAULT_SKIP_COUNT_REMINDER,
  DEFAULT_WORK_ACTION_BAR,
  LONG_BREAK_ENABLED_KEY,
  LONG_BREAK_INTERVAL_KEY,
  MAX_BREAK_SKIP_MAX,
  MIN_BREAK_SKIP_MAX,
  parseYesNo,
  QUIET_HOURS_KEY,
  SKIP_BREAK_ALLOWED_KEY,
  SKIP_COUNT_REMINDER_KEY,
  WORK_ACTION_BAR_KEY,
  YES_NO,
} from '@src/shared/appConfig';
import { commands } from '@src/shared/bindings';
import { logOnError } from '@src/shared/commands';
import {
  EVENT_PHASE_CHANGED,
  EVENT_TIMER_TICK,
} from '@src/shared/events';
import { useAppConfigValue } from '@src/shared/useAppConfigValue';
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
  todaySkipCount: 0,
  completedCycles: 0,
  quietTriggered: false,
  breakPaused: false,
  resumedFromQuiet: false,
};

function formatDisplayTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 模块级 decode：稳定引用，避免 useAppConfigValue 每次渲染重复订阅。
// 与后端 read_break_skip_max 对齐：clamp 到 [MIN,MAX]，非有限数回落默认。
function decodeBreakSkipMax(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.min(MAX_BREAK_SKIP_MAX, Math.max(MIN_BREAK_SKIP_MAX, Math.trunc(n)))
    : DEFAULT_BREAK_SKIP_MAX;
}

// 长休息间隔（轮）。非法值回落默认 2（与后端 read_long_break_interval 容错一致；
// 后端不设上限，此处同样不 clamp 上限）。
function decodeLongBreakInterval(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : DEFAULT_LONG_BREAK_INTERVAL;
}

// 长休息开关（YesNo）。非法值 / 缺失回落默认开启（与后端 read_long_break_enabled 容错一致）。
function decodeLongBreakEnabled(v: string | null): boolean {
  return parseYesNo(v, DEFAULT_LONG_BREAK_ENABLED) === DEFAULT_LONG_BREAK_ENABLED;
}

// 是否允许跳过休息（YesNo）。非法值 / 缺失回落默认允许（与 DEFAULT_SKIP_BREAK_ALLOWED 一致）。
// No 时 Breaking/Alerting 视图的跳过按钮禁用（纯前端消费，后端 skip_break 不设守卫）。
function decodeSkipBreakAllowed(v: string | null): boolean {
  return parseYesNo(v, DEFAULT_SKIP_BREAK_ALLOWED) === YES_NO.YES;
}

// 工作窗口操作栏显隐（YesNo）。非法值 / 缺失回落默认展示（与 DEFAULT_WORK_ACTION_BAR 一致）。
// No 时 WorkingView 底部操作栏（含上方分隔线）不渲染（纯前端消费）。
function decodeWorkActionBar(v: string | null): boolean {
  return parseYesNo(v, DEFAULT_WORK_ACTION_BAR) === YES_NO.YES;
}

// 下一次休息是否为长休息的预判（WorkingView「休息」按钮文案依据）。
// 与后端 check_is_long_break 同公式同输入（递增前的 completed_cycles），
// 手动休息（manual_break）与自动到点的下一次判定均基于此值，预判天然一致。
function checkNextBreakIsLong(enabled: boolean, interval: number, completedCycles: number): boolean {
  return enabled && interval > 0 && completedCycles > 0 && completedCycles % interval === 0;
}

export function useTimerState() {
  const [state, setState] = useState<TimerStatePayload>(INITIAL_STATE);

  // break_skip_max / quiet_hours：经 useAppConfigValue 订阅（mount 读 + app-config-changed 实时刷新，
  // 用户在设置页改完后 panel 立即更新），解码在模块级 decode 函数中完成。
  // quiet_hours 供 PausedView 在 quietTriggered 时显示休息时段范围（如 "22:00:00 - 07:00:00"）。
  const breakSkipMax = useAppConfigValue(BREAK_SKIP_MAX_KEY, decodeBreakSkipMax, DEFAULT_BREAK_SKIP_MAX);
  const quietHours = useAppConfigValue(QUIET_HOURS_KEY, decodeQuietHours, DEFAULT_QUIET_HOURS);
  // 跳过次数提醒阈值（纯 UI 配置）：AlertingView 据此 + state.todaySkipCount 判断是否显示警示横幅。
  const skipCountReminder = useAppConfigValue(SKIP_COUNT_REMINDER_KEY, decodeSkipCountReminder, DEFAULT_SKIP_COUNT_REMINDER);
  // 长休息开关与间隔（「休息」按钮长休息文案预判输入；与 breakSkipMax 同订阅模式）。
  const longBreakEnabled = useAppConfigValue(LONG_BREAK_ENABLED_KEY, decodeLongBreakEnabled, true);
  const longBreakInterval = useAppConfigValue(LONG_BREAK_INTERVAL_KEY, decodeLongBreakInterval, DEFAULT_LONG_BREAK_INTERVAL);
  // 是否允许跳过（跳过按钮禁用输入；保存后经 app-config-changed 实时生效）。
  const skipBreakAllowed = useAppConfigValue(SKIP_BREAK_ALLOWED_KEY, decodeSkipBreakAllowed, true);
  // 工作窗口操作栏显隐（WorkingView 底部操作栏渲染输入；保存后实时生效）。
  const workActionBarVisible = useAppConfigValue(WORK_ACTION_BAR_KEY, decodeWorkActionBar, true);

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
  // 预判下一次休息类型：与后端判定同公式（递增前 completed_cycles），供按钮文案展示。
  const nextBreakIsLong = checkNextBreakIsLong(longBreakEnabled, longBreakInterval, state.completedCycles);

  return {
    phase,
    remainingSeconds,
    totalSeconds,
    currentWhisperReminder: state.currentWhisperReminder,
    currentHealthReminder: state.currentHealthReminder,
    isLongBreak: state.isLongBreak,
    nextBreakIsLong,
    breakSkipCount: state.breakSkipCount,
    todaySkipCount: state.todaySkipCount,
    breakPaused: state.breakPaused,
    breakSkipMax,
    skipBreakAllowed,
    workActionBarVisible,
    skipCountReminder,
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
