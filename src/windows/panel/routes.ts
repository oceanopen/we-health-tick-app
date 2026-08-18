import type { Phase } from '@src/shared/bindings';

// panel 窗口路由 SSOT（对齐 we-claude-terminal-app 的 routes.ts 模式，phase 版）。
// 与 settings 的「用户菜单导航」不同：path 是后端 Phase 状态机的单向镜像——
// 无用户导航语义，'/' 与 '*' 兜底一律重定向到「当前 phase」（phaseToPath(phase)，见 PanelApp），
// 所有 navigate 由 usePhaseRoute 以 replace 执行（栈深恒 1，见 hooks/usePhaseRoute.ts）。

// phase → path 映射：同时供 PanelApp 的 <Route path> 声明与 matchPhasePath 派生消费。
export const PHASE_PATHS: Record<Phase, string> = {
  working: '/working',
  alerting: '/alerting',
  breaking: '/breaking',
  waiting: '/waiting',
  paused: '/paused',
};

// phase → path（不含 query；panel 无子状态）。
export function phaseToPath(phase: Phase): string {
  return PHASE_PATHS[phase];
}

// pathname → phase。精确/前缀匹配；未知返回 null 供 usePhaseRoute 区分「需纠偏」与「已一致」。
export function matchPhasePath(pathname: string): Phase | null {
  for (const [phase, prefix] of Object.entries(PHASE_PATHS)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return phase as Phase;
    }
  }
  return null;
}
