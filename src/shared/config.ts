import type { YesNo } from './bindings';
import { commands } from './bindings';
import { unwrap } from './commands';

// 本文件是所有配置项 key 命名 + 默认值的唯一可信源 (SSOT)。
//
// 后端 src-tauri/src/timer.rs 只对「计时逻辑需要读取」的 9 项建有对应常量副本
// （work/break_duration、break_skip_max、long_break_*、rest_confirm、quiet_hours、reminders）；
// appearance / rest_window / language / work_*_time 为纯 UI 配置，后端不读，仅前端使用。
// 修改这 9 项中任一 *KEY / DEFAULT_* 时必须同步后端（对照表见 timer.rs 顶部）。

// YES_NO 运行时常量：构造 / 比较 Y/N 字面量用。
// 类型来源：YesNo（来自 ./bindings，SSOT 为后端 shared/types.rs 的 YesNo enum）。
// specta 只导出类型不导出运行时 const，故字面量本地维护；satisfies 确保取值合法——
// 改 'Y'/'N' 为非 YesNo 字符时 tsc 在此报错兜底。改字符必须同步后端 enum 并重跑 gen:bindings。
export const YES_NO = {
  YES: 'Y',
  NO: 'N',
} as const satisfies Record<string, YesNo>;

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
export type LongBreakInterval = number;
export type LongBreakDuration = number;

export const WORK_DURATION_KEY = 'work_duration';
export const DEFAULT_WORK_DURATION: WorkDuration = 30;

export const BREAK_DURATION_KEY = 'break_duration';
export const DEFAULT_BREAK_DURATION: BreakDuration = 1;

export const BREAK_SKIP_MAX_KEY = 'break_skip_max';
export const DEFAULT_BREAK_SKIP_MAX = 1;
export const MIN_BREAK_SKIP_MAX = 1;
export const MAX_BREAK_SKIP_MAX = 3;

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
  { start: '18:00', end: '18:30' },
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

// 提醒文案配置：单 key 存储结构化对象 { health, whisper }。
//   - health：健康提醒（走动/喝水等），breaking 阶段绿色横幅展示；
//   - whisper：随笔心语（文学摘抄），breaking 阶段小字展示。
export type HealthReminders = string[];
export type WhisperReminders = string[];

export interface RemindersConfig {
  health: HealthReminders;
  whisper: WhisperReminders;
}

export const REMINDERS_KEY = 'reminders';

export const EMPTY_REMINDERS_CONFIG: RemindersConfig = { health: [], whisper: [] };

function filterStrings(arr: unknown): string[] {
  return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
}

export function encodeRemindersConfig(config: RemindersConfig): string {
  return JSON.stringify(config);
}

export function decodeRemindersConfig(value: string | null): RemindersConfig {
  if (!value) {
    return { ...EMPTY_REMINDERS_CONFIG };
  }
  try {
    // 值约定为 { health, whisper } 对象；filterStrings 对非数组/缺失字段兜底为 []。
    const obj = JSON.parse(value) as { health?: unknown; whisper?: unknown };
    return {
      health: filterStrings(obj?.health),
      whisper: filterStrings(obj?.whisper),
    };
  } catch {
    return { ...EMPTY_REMINDERS_CONFIG };
  }
}

// commands.xxx() 返回 tauri-specta 的 typedError 包装。unwrap 展开为 throw 风格，
// 保持 getConfig/setConfig 的对外 API 不变（错误时 throw）。
export async function getConfig(key: string): Promise<string | null> {
  return unwrap(commands.getConfig(key));
}

export async function setConfig(key: string, value: string): Promise<void> {
  await unwrap(commands.setConfig(key, value));
}
