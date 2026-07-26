use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::shared::screen::{
    DEFAULT_SIZE, SETTINGS_RATIO, find_monitor_for_tray, ratio_size, work_area_center,
};
use crate::shared::types::Phase;

// async：WebviewWindowBuilder::build() 在 Windows 上于同步 #[tauri::command] 中会触发 wry#583
// 死锁（白屏 + 主线程卡死）；改 async 让 IPC 线程不阻塞消息泵。macOS 无此问题（WKWebView 无 COM 模型）。
#[tauri::command]
#[specta::specta]
pub async fn show_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    // 按 tray.rect() 所在屏算尺寸；探测失败用 DEFAULT_SIZE 兜底，后续 set_position 也跳过。
    let monitor = find_monitor_for_tray(&app, "tray");
    let (width, height) = monitor
        .as_ref()
        .map(|m| ratio_size(m, SETTINGS_RATIO))
        .unwrap_or(DEFAULT_SIZE);

    let settings_win = match app.get_webview_window("settings") {
        Some(w) => {
            // 二次唤起：显式重置尺寸，避免窗口实例首次建好后跨分辨率屏固化。
            let _ = w.set_size(LogicalSize::new(width, height));
            w
        }
        None => {
            let product = app
                .config()
                .product_name
                .as_deref()
                .unwrap_or("We Health Tick");
            let win = WebviewWindowBuilder::new(
                &app,
                "settings",
                WebviewUrl::App("settings.html".into()),
            )
            .title(format!("{product} - 系统设置"))
            .inner_size(width, height)
            // 默认在主屏居中；下方 set_position 修正到 tray 所在屏，探测失败保持主屏。
            .center()
            // 窗口不进任务栏与 Alt+Tab（Windows/Linux），macOS 上为 no-op（Dock 由 ActivationPolicy 控制）。
            .skip_taskbar(true)
            .build()
            .map_err(|e| e.to_string())?;

            let w = win.clone();
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = w.hide();
                    // show_settings_window 打开时主动 hide 了 panel；非 Working 阶段需恢复常驻。
                    let app = w.app_handle();
                    if crate::timer::current_phase(app) != Phase::Working {
                        crate::windows::panel::show_panel(app);
                    }
                }
            });

            win
        }
    };

    // 新建和二次唤起都按 tray 所在屏的 work_area 居中；在 show 之前调用，无视觉跳跃。
    if let Some(m) = &monitor {
        let (x, y) = work_area_center(m, width, height);
        let _ = settings_win.set_position(LogicalPosition::new(x, y));
    }

    if let Some(panel) = app.get_webview_window("panel") {
        let _ = panel.hide();
    }

    let _ = settings_win.show();
    let _ = settings_win.unminimize();
    let _ = settings_win.set_focus();

    Ok(())
}
