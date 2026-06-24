import type { Appearance, Language, LongBreakInterval, RestWindow } from './config';

export interface LanguageOption {
  value: Language;
  labelKey: string;
}

export const languageOptions: LanguageOption[] = [
  { value: 'system', labelKey: 'settings:option.followSystem' },
  { value: 'zh-CN', labelKey: 'settings:option.chinese' },
  { value: 'en', labelKey: 'settings:option.english' },
];

export interface AppearanceOption {
  value: Appearance;
  labelKey: string;
}

export const appearanceOptions: AppearanceOption[] = [
  { value: 'system', labelKey: 'settings:option.followSystem' },
  { value: 'light', labelKey: 'settings:option.light' },
  { value: 'dark', labelKey: 'settings:option.dark' },
];

export interface LongBreakIntervalOption {
  value: LongBreakInterval;
  labelKey: string;
}

export const longBreakIntervalOptions: LongBreakIntervalOption[] = [
  { value: 2, labelKey: 'plan:option.longBreakEveryN' },
  { value: 3, labelKey: 'plan:option.longBreakEveryN' },
  { value: 4, labelKey: 'plan:option.longBreakEveryN' },
  { value: 5, labelKey: 'plan:option.longBreakEveryN' },
  { value: 6, labelKey: 'plan:option.longBreakEveryN' },
  { value: 7, labelKey: 'plan:option.longBreakEveryN' },
  { value: 8, labelKey: 'plan:option.longBreakEveryN' },
];

export interface RestWindowOption {
  value: RestWindow;
  labelKey: string;
  disabled?: boolean;
}

export const restWindowOptions: RestWindowOption[] = [
  { value: 'tray', labelKey: 'rest:option.tray' },
  { value: 'topRight', labelKey: 'rest:option.topRight', disabled: true },
  { value: 'fullscreen', labelKey: 'rest:option.fullscreen', disabled: true },
];
