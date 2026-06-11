use tauri::{
    LogicalPosition, Manager, Position, WebviewUrl, WebviewWindowBuilder,
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
                        position_panel(tray, &panel);
                        let _ = panel.show();
                        let _ = panel.set_focus();
                    }
                } else {
                    create_panel(app, tray);
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn position_panel(tray: &tauri::tray::TrayIcon, panel: &tauri::WebviewWindow) {
    if let Ok(Some(rect)) = tray.rect() {
        let sf = monitor_scale_for_rect(tray.app_handle(), &rect)
            .unwrap_or_else(|| panel.scale_factor().unwrap_or(1.0));

        let pos = rect.position.to_logical::<f64>(sf);
        let size = rect.size.to_logical::<f64>(sf);
        let _ = panel.set_position(Position::Logical(LogicalPosition::new(
            pos.x,
            pos.y + size.height,
        )));
    }
}

fn monitor_scale_for_rect(app: &tauri::AppHandle, rect: &tauri::Rect) -> Option<f64> {
    let (x, y) = match &rect.position {
        Position::Physical(p) => (p.x, p.y),
        Position::Logical(_) => return None,
    };

    for m in app.available_monitors().ok()? {
        let mp = m.position();
        let ms = m.size();
        if x >= mp.x
            && x < mp.x + ms.width as i32
            && y >= mp.y
            && y < mp.y + ms.height as i32
        {
            return Some(m.scale_factor());
        }
    }
    None
}

fn create_panel(app: &tauri::AppHandle, tray: &tauri::tray::TrayIcon) {
    let panel = WebviewWindowBuilder::new(app, "panel", WebviewUrl::App("panel.html".into()))
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .shadow(false)
        .focused(true)
        .inner_size(240.0, 320.0);

    if let Ok(w) = panel.build() {
        position_panel(tray, &w);
        let _ = w.show();
        let _ = w.set_focus();
    }
}
