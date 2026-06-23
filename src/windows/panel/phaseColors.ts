import type { Phase } from '@src/shared/bindings';

// CountdownRing 进度圈及未来 J3-J7 各 phase View 复用的统一色表。
// 色值与 src-tauri/icons/tray/*.svg（域 G1 托盘图标）对齐：
// working/alerting/breaking/waiting/paused 的 light 分支即托盘底色；
// dark 分支按 Tailwind 惯例提亮一档（-300/-400），保证暗底下可读。
export const PHASE_RING_COLORS: Record<Phase, { light: string; dark: string }> = {
  working: { light: '#16A34A', dark: '#4ADE80' },
  alerting: { light: '#F59E0B', dark: '#FBBF24' },
  breaking: { light: '#B45309', dark: '#D97706' },
  waiting: { light: '#EF4444', dark: '#F87171' },
  paused: { light: '#9CA3AF', dark: '#D1D5DB' },
};
