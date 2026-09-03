import type { QuietHourPeriod as QuietHourPeriodImport, YesNo } from './bindings';
// —— 以下常量 re-export 自 ./bindings（Rust SSOT）——
// 本文件内 decode/encode 函数也直接消费这些常量，故除 re-export 外另 import 一份。
// YesNo 语义的布尔默认（REST_CONFIRM 等）Rust 侧是 bool，经 boolToYesNo 适配为 Y/N。
import {
  commands,
  DEFAULT_DND_HOURS_ENABLED as DEFAULT_DND_HOURS_ENABLED_IMPORT,
  DEFAULT_DND_HOURS as DEFAULT_DND_HOURS_IMPORT,
  DEFAULT_IDLE_PAUSE_THRESHOLD as DEFAULT_IDLE_PAUSE_THRESHOLD_IMPORT,
  DEFAULT_LAUNCH_AT_LOGIN as DEFAULT_LAUNCH_AT_LOGIN_IMPORT,
  DEFAULT_LONG_BREAK_ENABLED as DEFAULT_LONG_BREAK_ENABLED_IMPORT,
  DEFAULT_PAUSE_ON_IDLE as DEFAULT_PAUSE_ON_IDLE_IMPORT,
  DEFAULT_QUIET_HOURS_ENABLED as DEFAULT_QUIET_HOURS_ENABLED_IMPORT,
  DEFAULT_QUIET_HOURS as DEFAULT_QUIET_HOURS_IMPORT,
  DEFAULT_REST_CONFIRM as DEFAULT_REST_CONFIRM_IMPORT,
  DEFAULT_REST_END_CONFIRM as DEFAULT_REST_END_CONFIRM_IMPORT,
  MAX_IDLE_PAUSE_THRESHOLD as MAX_IDLE_PAUSE_THRESHOLD_IMPORT,
  MIN_IDLE_PAUSE_THRESHOLD as MIN_IDLE_PAUSE_THRESHOLD_IMPORT,
} from './bindings';

// 本文件是前端配置项编解码 + 读写包装层。
//
// ⚠️ 常量 SSOT 迁移说明（2026-08）：
// 配置 key 名、默认值、MIN/MAX 范围的唯一可信源已迁至 Rust 侧——
//   - timer.rs 业务项（work/break_duration、break_skip_max、long_break_*、rest_confirm、
//     rest_end_confirm、pause_on_idle、idle_pause_threshold、quiet_hours(+enabled)、
//     dnd_hours(+enabled)、reminders；清单以 lib.rs 注册列表为准）
//   - shared/app_config.rs 5 项（language、rest_window、long_break_window、quiet_window、launch_at_login）
//   - shared/events.rs 事件名、shared/reminder_texts.rs 默认文案
// 经 lib.rs build_specta_builder().constant() 自动导出到 ./bindings（as const），
// 本文件 re-export 保持消费方 import 路径稳定。修改常量值：改 Rust → `pnpm gen:bindings`，
// CI verify:bindings 拦截漂移。
//
// 仍在本文件维护（纯前端消费，后端不读）：appearance、skip_break_allowed、
// skip_count_reminder 及其默认值/范围；IDLE_PAUSE_THRESHOLD_STEP（仅 Slider UI 用）。

import { unwrap } from './commands';

function boolToYesNo(v: boolean): YesNo {
  return toYesNo(v);
}

export {
  BREAK_DURATION_KEY,
  BREAK_SKIP_MAX_KEY,
  DEFAULT_BREAK_DURATION,
  DEFAULT_BREAK_SKIP_MAX,
  DEFAULT_DND_HOURS,
  DEFAULT_IDLE_PAUSE_THRESHOLD,
  DEFAULT_LANGUAGE,
  DEFAULT_LONG_BREAK_DURATION,
  DEFAULT_LONG_BREAK_INTERVAL,
  DEFAULT_LONG_BREAK_WINDOW,
  DEFAULT_QUIET_HOURS,
  DEFAULT_QUIET_WINDOW,
  DEFAULT_REST_WINDOW,
  DEFAULT_WORK_DURATION,
  DND_HOURS_ENABLED_KEY,
  DND_HOURS_KEY,
  IDLE_PAUSE_THRESHOLD_KEY,
  LANGUAGE_KEY,
  LAUNCH_AT_LOGIN_KEY,
  LONG_BREAK_DURATION_KEY,
  LONG_BREAK_ENABLED_KEY,
  LONG_BREAK_INTERVAL_KEY,
  LONG_BREAK_WINDOW_KEY,
  MAX_BREAK_SKIP_MAX,
  MAX_IDLE_PAUSE_THRESHOLD,
  MIN_BREAK_SKIP_MAX,
  MIN_IDLE_PAUSE_THRESHOLD,
  PAUSE_ON_IDLE_KEY,
  QUIET_HOURS_ENABLED_KEY,
  QUIET_HOURS_KEY,
  QUIET_WINDOW_KEY,
  REMINDERS_KEY,
  REST_CONFIRM_KEY,
  REST_END_CONFIRM_KEY,
  REST_WINDOW_KEY,
  WORK_DURATION_KEY,
} from './bindings';

// YES_NO 运行时常量：构造 / 比较 Y/N 字面量用。
// 类型来源：YesNo（来自 ./bindings，SSOT 为后端 shared/types.rs 的 YesNo enum）。
// 前端需 isYes/toYesNo/parseYesNo 工具函数配套，保持本地 satisfies 模式；
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

export type RestConfirm = YesNo;

// 休息后确认：Yes 休息结束进 Waiting 等用户点「我回来了」；No 休息结束自动进入 Working
// （跳过 Waiting）。后端 timer.rs 在 Breaking 归零时刻现读分流；时段暂停优先（不会自动进 Working）。
export type RestEndConfirm = YesNo;

// 离开暂停：锁屏 / 休眠 / 长时间无操作时冻结工作倒计时（idle 检测，复用 idle.rs）。
// YesNo 配置，后端 timer.rs 每秒现读（同 quiet_hours），改设置 ≤1s 生效。
export type PauseOnIdle = YesNo;

// 开机自启动：系统登录项状态的本地镜像（系统优先：启动时后端 autostart 模块以系统
// 真实状态回写本配置；保存时经事件监听同步系统登录项）。YesNo 配置。
export type LaunchAtLogin = YesNo;

// YesNo 语义配置的默认值适配层：Rust SSOT 导出 bool，DB 存储 Y/N，
// 消费方（RestPage/PlanPage/useTimerState 等）统一拿 YesNo。
export const DEFAULT_REST_CONFIRM: YesNo = boolToYesNo(DEFAULT_REST_CONFIRM_IMPORT);
export const DEFAULT_REST_END_CONFIRM: YesNo = boolToYesNo(DEFAULT_REST_END_CONFIRM_IMPORT);
export const DEFAULT_PAUSE_ON_IDLE: YesNo = boolToYesNo(DEFAULT_PAUSE_ON_IDLE_IMPORT);
export const DEFAULT_LAUNCH_AT_LOGIN: YesNo = boolToYesNo(DEFAULT_LAUNCH_AT_LOGIN_IMPORT);

// 离开暂停的空闲阈值（秒）：idle 超该值且 pause_on_idle 开启 → 冻结工作倒计时。
// number 配置，后端 timer.rs 每秒现读（同 quiet_hours）。STEP 仅前端 Slider 用，后端不校验。
export type IdlePauseThreshold = number;

// Slider 步长（30s）：纯前端 UI 常量，后端无对应，故留在此处。
export const IDLE_PAUSE_THRESHOLD_STEP = 30;

// 模块级 decode：稳定引用，供 useAppConfigValue / PlanPage 订阅与初始化。
// clamp 到 [MIN,MAX]，非有限数 / 缺失回落默认（与 decodeSkipCountReminder 同构）。
export function decodeIdlePauseThreshold(v: string | null): IdlePauseThreshold {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.min(MAX_IDLE_PAUSE_THRESHOLD_IMPORT, Math.max(MIN_IDLE_PAUSE_THRESHOLD_IMPORT, Math.trunc(n)))
    : DEFAULT_IDLE_PAUSE_THRESHOLD_IMPORT;
}

export type Language = 'system' | 'zh-CN' | 'en';

export type ResolvedLanguage = Exclude<Language, 'system'>;

// Language 类型守卫：DEFAULT_LANGUAGE 来自 bindings 的字面量 "system"，
// 消费方需要 Language 宽类型时经此收窄校验（AppI18nProvider / AppConfigPage 用）。
export function isLanguage(v: string | null): v is Language {
  return v === 'system' || v === 'zh-CN' || v === 'en';
}

export type WorkDuration = number;
export type BreakDuration = number;
export type LongBreakInterval = number;
export type LongBreakDuration = number;

// 是否允许跳过休息：No 时 Breaking/Alerting 视图的跳过按钮全部禁用。
// 纯前端消费（后端 skip_break 不设守卫）；YesNo 配置，经 app-config-changed 实时热更新。
export type SkipBreakAllowed = YesNo;

export const SKIP_BREAK_ALLOWED_KEY = 'skip_break_allowed';
export const DEFAULT_SKIP_BREAK_ALLOWED: SkipBreakAllowed = YES_NO.YES;

// 工作窗口操作栏显隐：No 时 WorkingView 底部操作栏（暂停/重置/休息，含上方横向分隔线）
// 不渲染，窗口高度经 RO→fitPanel 链路自动收缩。纯前端消费（后端不读）；YesNo 配置，
// 经 app-config-changed 实时热更新。
export type WorkActionBar = YesNo;

export const WORK_ACTION_BAR_KEY = 'work_action_bar';
export const DEFAULT_WORK_ACTION_BAR: WorkActionBar = YES_NO.YES;

// 跳过次数提醒阈值：今日累计「真正跳过休息」≥ 该值时，休息提醒弹窗（AlertingView）显示警示横幅。
// 纯 UI 配置：后端不读取（与 appearance / rest_window 同类），仅前端 AlertingView 判断显隐。
// 0 = 关闭提醒。与 BREAK_SKIP_MAX（单次休息防误触点击门槛）语义不同，勿混用。
export type SkipCountReminder = number;

export const SKIP_COUNT_REMINDER_KEY = 'skip_count_reminder';
export const DEFAULT_SKIP_COUNT_REMINDER: SkipCountReminder = 3;
export const MIN_SKIP_COUNT_REMINDER = 0;
export const MAX_SKIP_COUNT_REMINDER = 20;

// 模块级 decode：稳定引用，供 useAppConfigValue 订阅（避免每次渲染重订阅）。
// clamp 到 [MIN,MAX]，非有限数 / 缺失回落默认（与 decodeBreakSkipMax 同构，但范围不同）。
export function decodeSkipCountReminder(v: string | null): SkipCountReminder {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.min(MAX_SKIP_COUNT_REMINDER, Math.max(MIN_SKIP_COUNT_REMINDER, Math.trunc(n)))
    : DEFAULT_SKIP_COUNT_REMINDER;
}

export type LongBreakEnabled = YesNo;

export const DEFAULT_LONG_BREAK_ENABLED: YesNo = boolToYesNo(DEFAULT_LONG_BREAK_ENABLED_IMPORT);

// 休息时段总开关：No 时 quiet_hours 列表不参与暂停判定（列表配置保留）。
// YesNo 配置，后端 timer.rs 每秒现读，改设置 ≤1s 生效；默认 Y（存量行为不变）。
export type QuietHoursEnabled = YesNo;

export const DEFAULT_QUIET_HOURS_ENABLED: YesNo = boolToYesNo(DEFAULT_QUIET_HOURS_ENABLED_IMPORT);

// 免打扰时段总开关：No 时 dnd_hours 列表不参与暂停判定。命中为非打断式暂停
// （不弹窗、已有窗口收起、点托盘可查看），时段结束自动恢复。默认 N。
export type DndHoursEnabled = YesNo;

export const DEFAULT_DND_HOURS_ENABLED: YesNo = boolToYesNo(DEFAULT_DND_HOURS_ENABLED_IMPORT);

// 时段条目类型：SSOT 为后端 shared/types.rs QuietHourPeriod（随 bindings 导出）。
export type { QuietHourPeriod } from './bindings';

export type QuietHours = readonly QuietHourPeriodImport[];

// 免打扰时段列表：与 quiet_hours 同 schema（QuietHourPeriod 数组），默认空。
export type DndHours = readonly QuietHourPeriodImport[];

// 时段列表编码（quiet_hours / dnd_hours 共用，结构无关的序列化）。
export function encodePeriods(periods: QuietHours | DndHours): string {
  return JSON.stringify(periods);
}

// 时段列表解析核心（decodeQuietHours / decodeDndHours 共用）。四个显式分支：
//   1) 无值（从未配置）→ fallback
//   2) JSON.parse 失败 / 非数组 → fallback
//   3) 数组非空但全部条目非法（start/end 非 string）→ 视为损坏，fallback
//      （区别于「用户显式清空」——那种情况存的是字面 "[]"）
//   4) 合法数组（含空数组 []）→ 原样返回过滤后条目；空数组 = 用户显式清空，不回退默认
function parsePeriods(value: string | null, fallback: QuietHours): QuietHours {
  if (!value) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (p): p is QuietHourPeriodImport =>
          typeof p === 'object'
          && p !== null
          && typeof (p as QuietHourPeriodImport).start === 'string'
          && typeof (p as QuietHourPeriodImport).end === 'string',
      );
      if (parsed.length === 0 || valid.length > 0) {
        return valid;
      }
    }
  } catch {
    // ignore parse errors, fall through to fallback
  }
  return fallback;
}

// 与后端 read_quiet_hours 容错对齐：null / 损坏 → 默认 2 项；"[]" → 空数组（尊重用户清空）。
export function decodeQuietHours(value: string | null): QuietHours {
  return parsePeriods(value, DEFAULT_QUIET_HOURS_IMPORT);
}

// 与后端 read_dnd_hours 容错对齐：null / 损坏 / "[]" 均为空数组（免打扰无内置默认时段）。
export function decodeDndHours(value: string | null): DndHours {
  return parsePeriods(value, DEFAULT_DND_HOURS_IMPORT);
}

// 提醒文案配置：单 key 存储结构化对象 { health, whisper }。
//   - health：健康提醒（走动/喝水等），breaking 阶段绿色横幅展示；
//   - whisper：随笔心语（文学摘抄），breaking 阶段小字展示。
export type HealthReminders = string[];
export type WhisperReminders = string[];

export interface AppRemindersConfig {
  health: HealthReminders;
  whisper: WhisperReminders;
}

export const EMPTY_APP_REMINDERS_CONFIG: AppRemindersConfig = { health: [], whisper: [] };

function filterStrings(arr: unknown): string[] {
  return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
}

export function encodeAppRemindersConfig(config: AppRemindersConfig): string {
  return JSON.stringify(config);
}

export function decodeAppRemindersConfig(value: string | null): AppRemindersConfig {
  if (!value) {
    return { ...EMPTY_APP_REMINDERS_CONFIG };
  }
  try {
    // 值约定为 { health, whisper } 对象；filterStrings 对非数组/缺失字段兜底为 []。
    const obj = JSON.parse(value) as { health?: unknown; whisper?: unknown };
    return {
      health: filterStrings(obj?.health),
      whisper: filterStrings(obj?.whisper),
    };
  } catch {
    return { ...EMPTY_APP_REMINDERS_CONFIG };
  }
}

// commands.xxx() 返回 tauri-specta 的 typedError 包装。unwrap 展开为 throw 风格，
// 保持 getAppConfig/setAppConfig 的对外 API 不变（错误时 throw）。
export async function getAppConfig(key: string): Promise<string | null> {
  return unwrap(commands.getAppConfig(key));
}

export async function setAppConfig(key: string, value: string): Promise<void> {
  await unwrap(commands.setAppConfig(key, value));
}
