import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import aboutEn from './locales/en/about.json';
import commonEn from './locales/en/common.json';
import panelEn from './locales/en/panel.json';
import planEn from './locales/en/plan.json';
import settingsEn from './locales/en/settings.json';
import aboutZhCN from './locales/zh-CN/about.json';
import commonZhCN from './locales/zh-CN/common.json';
import panelZhCN from './locales/zh-CN/panel.json';
import planZhCN from './locales/zh-CN/plan.json';
import settingsZhCN from './locales/zh-CN/settings.json';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en'] as const;

export const NAMESPACES = ['common', 'settings', 'plan', 'about', 'panel'] as const;

void i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  lng: 'zh-CN',
  defaultNS: 'common',
  ns: NAMESPACES,
  resources: {
    'zh-CN': {
      common: commonZhCN,
      settings: settingsZhCN,
      plan: planZhCN,
      about: aboutZhCN,
      panel: panelZhCN,
    },
    'en': {
      common: commonEn,
      settings: settingsEn,
      plan: planEn,
      about: aboutEn,
      panel: panelEn,
    },
  },
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
