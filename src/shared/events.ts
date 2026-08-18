// 所有 Tauri 事件名的 SSOT。修改时必须同步 src-tauri/src/shared/events.rs（后端镜像）。
// 与后端 const EVENT_XXX 一一对应；specta 不自动导出 const &str，走双份维护。

export const EVENT_TIMER_TICK = 'timer-tick';

export const EVENT_PHASE_CHANGED = 'phase-changed';

export const EVENT_APP_CONFIG_CHANGED = 'app-config-changed';

// settings 窗口导航请求（payload = 分区 MenuKey 字符串）。show_settings_window 在 show 后
// emit_to("settings")；首开深链走初始 URL settings.html#/section，不走此事件。
// Rust 侧 Option<String> 不校验，由前端 isMenuKey 守卫。
export const EVENT_SETTINGS_NAVIGATE = 'settings:navigate';
