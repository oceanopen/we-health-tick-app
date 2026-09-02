use tauri::{AppHandle, Listener, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::shared::app_config::{AppConfigState, LAUNCH_AT_LOGIN_KEY, write_app_config_raw};
use crate::shared::events::EVENT_APP_CONFIG_CHANGED;
use crate::shared::types::AppConfigChangedPayload;

/// 开机自启动：配置 `launch_at_login`（Y/N）与系统登录项的双向桥。
///
/// - 保存生效：监听 app-config-changed（同 panel.rs LANGUAGE_KEY 模式），key 命中
///   时按值显式分派 enable/disable；失败仅 log::warn，下次启动回写自愈。
/// - 启动对齐：init 时读系统登录项真实状态回写配置镜像（不 emit，此时无窗口）；
///   用户在系统设置里手动增删登录项，下次启动 app 后配置随之对齐（保存路径不会
///   复活手动删除——set_app_config 值未变时跳过 emit）。
///
/// 已知盲区：is_enabled 仅检查 plist 文件存在、不读 launchd 禁用标记，系统设置里
/// 关闭"允许在后台"时镜像仍为 "Y"（后续可迁 SMAppService 消除）。失败路径均仅 warn。
pub fn init(app: &AppHandle) {
    // —— 启动回写：系统登录项真实状态 → 配置镜像 ——
    let enabled = app.autolaunch().is_enabled().unwrap_or_else(|e| {
        log::warn!("read login item status failed, fallback to disabled: {e}");
        false
    });
    // DB 存储遵循 YesNo 约定（"Y"/"N"，同 shared/types.rs serde rename）。
    let value: &str = if enabled {
        "Y"
    } else {
        "N"
    };
    let state: tauri::State<AppConfigState> = app.state();
    if let Err(e) = write_app_config_raw(&state, LAUNCH_AT_LOGIN_KEY, value) {
        log::warn!("write launch_at_login mirror failed: {e}");
    }

    // —— 保存同步：配置变化 → 系统登录项 ——
    let sync_handle = app.clone();
    app.listen(EVENT_APP_CONFIG_CHANGED, move |event| {
        // 类型化载荷：AppConfigChangedPayload 是 set_app_config emit 的 SSOT 结构
        // （lib.rs 已 .typ 注册导出 bindings），字段名错误编译期即暴露。
        let Ok(payload) = serde_json::from_str::<AppConfigChangedPayload>(event.payload()) else {
            return;
        };
        if payload.key != LAUNCH_AT_LOGIN_KEY {
            return;
        }
        // 全取值显式分派（Y/N 之外不静默兜底），与 timer.rs 配置读取容错同构。
        let result = match payload.value.as_str() {
            "Y" => sync_handle.autolaunch().enable(),
            "N" => sync_handle.autolaunch().disable(),
            other => {
                log::warn!("unexpected launch_at_login value {other:?}, skip login item sync");
                return;
            }
        };
        if let Err(e) = result {
            log::warn!("sync login item failed: {e}");
        }
    });
}
