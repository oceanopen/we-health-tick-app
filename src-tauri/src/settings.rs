use tauri::{LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::shared::screen::{work_area_center, MonitorInfo};

#[tauri::command]
#[specta::specta]
pub fn show_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    let settings_win = match app.get_webview_window("settings") {
        Some(w) => w,
        None => {
            let win =
                WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("settings.html".into()))
                    .title("We Health Tick")
                    .inner_size(800.0, 600.0)
                    // 窗口不进任务栏与 Alt+Tab（Windows/Linux），macOS 上为 no-op（Dock 由 ActivationPolicy 控制）。
                    .skip_taskbar(true)
                    .build()
                    .map_err(|e| e.to_string())?;

            let w = win.clone();
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = w.hide();
                }
            });

            win
        }
    };

    if let Some(panel) = app.get_webview_window("panel") {
        if let Ok(Some(monitor)) = panel.current_monitor() {
            let monitor = MonitorInfo::from_monitor(&monitor);
            let settings_sf = settings_win.scale_factor().unwrap_or(monitor.scale_factor);
            let settings_size = settings_win
                .inner_size()
                .map(|s| s.to_logical::<f64>(settings_sf))
                .unwrap_or_else(|_| tauri::LogicalSize::new(800.0, 600.0));

            let (x, y) = work_area_center(&monitor, settings_size.width, settings_size.height);
            let _ = settings_win.set_position(LogicalPosition::new(x, y));
        }
        let _ = panel.hide();
    }

    let _ = settings_win.show();
    let _ = settings_win.unminimize();
    let _ = settings_win.set_focus();

    Ok(())
}
