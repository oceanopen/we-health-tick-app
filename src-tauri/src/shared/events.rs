// 所有 Tauri 事件名的 SSOT。修改时必须同步 src/shared/events.ts（前端镜像）。
// 这些事件名散落在 emit/listen 调用中，typo 不会编译报错，集中常量化降低漂移风险。

/// 每秒推送当前状态快照（TimerStatePayload）。前端 useTimer 订阅以更新圆环倒计时。
pub const EVENT_TIMER_TICK: &str = "timer-tick";

/// phase 切换时推送（TimerStatePayload，带 prev_phase）。前端 PanelApp 用于切换 UI 分支。
pub const EVENT_PHASE_CHANGED: &str = "phase-changed";

/// 配置项变更时广播（AppConfigChangedPayload）。订阅方据此响应配置变化。
pub const EVENT_APP_CONFIG_CHANGED: &str = "app-config-changed";

/// settings 窗口导航请求（payload = 分区 MenuKey 字符串）。窗口已存在（二次唤起）时由
/// show_settings_window 在 show 后 emit_to；首开深链走初始 URL，不走此事件（前端 listen 未注册）。
pub const EVENT_SETTINGS_NAVIGATE: &str = "settings:navigate";
