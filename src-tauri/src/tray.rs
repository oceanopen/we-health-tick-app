use tauri::{
    Manager, WebviewUrl, WebviewWindowBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
        .expect("failed to load tray icon");

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("We Health Tick")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(panel) = app.get_webview_window("panel") {
                    if panel.is_visible().unwrap_or(false) {
                        let _ = panel.hide();
                    } else {
                        let _ = panel.show();
                        let _ = panel.set_focus();
                    }
                } else {
                    create_panel(app);
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn create_panel(app: &tauri::AppHandle) {
    let panel = WebviewWindowBuilder::new(app, "panel", WebviewUrl::App("panel.html".into()))
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .shadow(false)
        .focused(true)
        .inner_size(240.0, 320.0);

    if let Ok(w) = panel.build() {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
