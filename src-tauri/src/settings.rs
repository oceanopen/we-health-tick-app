use tauri::{LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
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
            let sf = monitor.scale_factor();
            let wa = monitor.work_area();
            let wa_w = wa.size.width as f64 / sf;
            let wa_h = wa.size.height as f64 / sf;
            let wa_x = wa.position.x as f64 / sf;
            let wa_y = wa.position.y as f64 / sf;

            let settings_sf = settings_win.scale_factor().unwrap_or(sf);
            let settings_size = settings_win
                .inner_size()
                .map(|s| s.to_logical::<f64>(settings_sf))
                .unwrap_or_else(|_| tauri::LogicalSize::new(800.0, 600.0));

            let x = wa_x + (wa_w - settings_size.width) / 2.0;
            let y = wa_y + (wa_h - settings_size.height) / 2.0;

            let _ = settings_win.set_position(LogicalPosition::new(x, y));
        }
        let _ = panel.hide();
    }

    let _ = settings_win.show();
    let _ = settings_win.unminimize();
    let _ = settings_win.set_focus();

    Ok(())
}
