// 所有 Tauri 事件名的 SSOT。修改时必须同步 src-tauri/src/shared/events.rs（后端镜像）。
// 与后端 const EVENT_XXX 一一对应；tauri-specta rc.25 的 Builder.constant 仅支持
// Serialize+Type 的值常量，事件名不在其列，仍走双份维护。

export const EVENT_TIMER_TICK = 'timer-tick';

export const EVENT_PHASE_CHANGED = 'phase-changed';

export const EVENT_APP_CONFIG_CHANGED = 'app-config-changed';

// settings 窗口导航请求（payload = 分区 MenuKey 字符串）。show_settings_window 在 show 后
// emit_to("settings")；首开深链走初始 URL settings.html#/section，不走此事件。
// Rust 侧 Option<String> 不校验，由前端 isMenuKey 守卫。
export const EVENT_SETTINGS_NAVIGATE = 'settings:navigate';

// panel 窗口形态变化（payload = PanelForm 联合类型，bindings.ts 导出）。
// 后端 sync_panel_form 全屏进出副作用完成后 emit_to("panel")；usePanelForm 订阅切换布局。
export const EVENT_PANEL_FORM_CHANGED = 'panel-form-changed';
