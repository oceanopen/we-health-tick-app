import { invoke } from '@tauri-apps/api/core';

export const YES_NO = {
  YES: 'Y',
  NO: 'N',
} as const;

export type YesNo = (typeof YES_NO)[keyof typeof YES_NO];

export function isYes(value: string | null): boolean {
  return value === YES_NO.YES;
}

export function toYesNo(value: boolean): YesNo {
  return value ? YES_NO.YES : YES_NO.NO;
}

export function parseYesNo(value: string | null, fallback: YesNo): YesNo {
  return value === YES_NO.YES || value === YES_NO.NO ? value : fallback;
}

export type Appearance = 'system' | 'light' | 'dark';

export const APPEARANCE_KEY = 'appearance';
export const DEFAULT_APPEARANCE: Appearance = 'system';

export type RestWindow = 'tray' | 'topRight' | 'fullscreen';

export const REST_WINDOW_KEY = 'rest_window';
export const DEFAULT_REST_WINDOW: RestWindow = 'tray';

export type RestConfirm = YesNo;

export const REST_CONFIRM_KEY = 'rest_confirm';
export const DEFAULT_REST_CONFIRM: RestConfirm = YES_NO.YES;

export type Language = 'system' | 'zh-CN' | 'en';

export type ResolvedLanguage = Exclude<Language, 'system'>;

export const LANGUAGE_KEY = 'language';
export const DEFAULT_LANGUAGE: Language = 'system';

export type WorkDuration = number;
export type BreakDuration = number;
export type DailyGoal = number;
export type LongBreakInterval = number;
export type LongBreakDuration = number;

export const WORK_DURATION_KEY = 'work_duration';
export const DEFAULT_WORK_DURATION: WorkDuration = 30;

export const BREAK_DURATION_KEY = 'break_duration';
export const DEFAULT_BREAK_DURATION: BreakDuration = 1;

export const DAILY_GOAL_KEY = 'daily_goal';
export const DEFAULT_DAILY_GOAL: DailyGoal = 10;

export const LONG_BREAK_INTERVAL_KEY = 'long_break_interval';
export const DEFAULT_LONG_BREAK_INTERVAL: LongBreakInterval = 2;

export const LONG_BREAK_DURATION_KEY = 'long_break_duration';
export const DEFAULT_LONG_BREAK_DURATION: LongBreakDuration = 5;

export type LongBreakEnabled = YesNo;

export const LONG_BREAK_ENABLED_KEY = 'long_break_enabled';
export const DEFAULT_LONG_BREAK_ENABLED: LongBreakEnabled = YES_NO.YES;

export type WorkTime = string;

export const WORK_START_TIME_KEY = 'work_start_time';
export const DEFAULT_WORK_START_TIME: WorkTime = '09:00';

export const WORK_END_TIME_KEY = 'work_end_time';
export const DEFAULT_WORK_END_TIME: WorkTime = '20:00';

export interface QuietHourPeriod {
  start: string;
  end: string;
}

export type QuietHours = QuietHourPeriod[];

export const QUIET_HOURS_KEY = 'quiet_hours';
export const DEFAULT_QUIET_HOURS: QuietHours = [
  { start: '12:00', end: '14:00' },
  { start: '18:00', end: '19:00' },
];

export function encodeQuietHours(periods: QuietHours): string {
  return JSON.stringify(periods);
}

export function decodeQuietHours(value: string | null): QuietHours {
  if (!value) {
    return DEFAULT_QUIET_HOURS;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (p): p is QuietHourPeriod =>
          typeof p === 'object'
          && p !== null
          && typeof (p as QuietHourPeriod).start === 'string'
          && typeof (p as QuietHourPeriod).end === 'string',
      );
      if (valid.length > 0) {
        return valid;
      }
    }
  } catch {
    // ignore parse errors, fall through to default
  }
  return DEFAULT_QUIET_HOURS;
}

export type Reminders = string[];

export const REMINDERS_KEY = 'reminders';

export function encodeReminders(list: Reminders): string {
  return JSON.stringify(list);
}

export function decodeReminders(value: string | null): Reminders {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((s): s is string => typeof s === 'string');
      if (valid.length > 0) {
        return valid;
      }
    }
  } catch {
    // ignore parse errors, fall through to empty
  }
  return [];
}

export async function getConfig(key: string): Promise<string | null> {
  return invoke<string | null>('get_config', { key });
}

export async function setConfig(key: string, value: string): Promise<void> {
  await invoke('set_config', { key, value });
}
