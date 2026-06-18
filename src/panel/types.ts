// 后端 timer.rs 契约镜像（timer-tick / phase-changed / get_timer_state 共用 payload）。
// Phase 与后端 #[serde(rename_all = "lowercase")] 对齐；TimerStatePayload 与 camelCase 字段一一对应。

export type Phase = 'working' | 'alerting' | 'breaking' | 'waiting' | 'paused';

export interface TimerStatePayload {
  phase: Phase;
  // 仅 phase-changed 事件中为切换前的 phase；timer-tick / get_timer_state 中为 null。
  prevPhase?: Phase | null;
  remainingSeconds: number;
  totalSeconds: number;
  currentReminder: string;
  isLongBreak: boolean;
  breakSkipCount: number;
  completedCycles: number;
  quietTriggered: boolean;
}
