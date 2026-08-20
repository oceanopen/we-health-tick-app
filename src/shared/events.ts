// 所有 Tauri 事件名：SSOT 为后端 src-tauri/src/shared/events.rs，
// 经 Builder.constant 自动导出到 ./bindings（`export const ... as const`），
// 本文件仅作 re-export 桥接，保持消费方 import 路径稳定。
// 新增事件：先在后端定义 const，再到 lib.rs build_specta_builder 注册 constant，
// 最后跑 `pnpm gen:bindings`。

export {
  EVENT_APP_CONFIG_CHANGED,
  EVENT_PANEL_FORM_CHANGED,
  EVENT_PHASE_CHANGED,
  EVENT_SETTINGS_NAVIGATE,
  EVENT_TIMER_TICK,
} from './bindings';
