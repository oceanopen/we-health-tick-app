use tauri::{
    LogicalPosition, LogicalSize, Manager, Position, WebviewUrl, WebviewWindowBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const PANEL_WIDTH: f64 = 240.0;
const DEFAULT_PANEL_HEIGHT: f64 = 320.0;

struct MonitorInfo {
    scale_factor: f64,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    wa_x: f64,
    wa_y: f64,
    wa_width: f64,
    wa_height: f64,
}

enum TaskbarEdge {
    Top,
    Bottom,
    Left,
    Right,
}

pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
        .expect("failed to load tray icon");

    TrayIconBuilder::with_id("tray")
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
        let sf = panel.scale_factor().unwrap_or(1.0);

        let monitor = find_monitor_for_rect(tray.app_handle(), &rect);
        let sf = monitor.as_ref().map_or(sf, |m| m.scale_factor);

        let pos = rect.position.to_logical::<f64>(sf);
        let size = rect.size.to_logical::<f64>(sf);

        let panel_height = panel
            .inner_size()
            .map(|s| s.to_logical::<f64>(sf).height)
            .unwrap_or(DEFAULT_PANEL_HEIGHT);

        let (x, y) = if let Some(m) = &monitor {
            compute_panel_position(m, pos.x, pos.y, size.width, size.height, panel_height)
        } else {
            (pos.x, pos.y + size.height)
        };

        let _ = panel.set_position(Position::Logical(LogicalPosition::new(x, y)));
    }
}

fn find_monitor_for_rect(app: &tauri::AppHandle, rect: &tauri::Rect) -> Option<MonitorInfo> {
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
            let sf = m.scale_factor();
            let wa = m.work_area();
            return Some(MonitorInfo {
                scale_factor: sf,
                x: mp.x as f64 / sf,
                y: mp.y as f64 / sf,
                width: ms.width as f64 / sf,
                height: ms.height as f64 / sf,
                wa_x: wa.position.x as f64 / sf,
                wa_y: wa.position.y as f64 / sf,
                wa_width: wa.size.width as f64 / sf,
                wa_height: wa.size.height as f64 / sf,
            });
        }
    }
    None
}

fn detect_taskbar_edge(
    monitor: &MonitorInfo,
    icon_x: f64,
    icon_y: f64,
    icon_w: f64,
    icon_h: f64,
) -> TaskbarEdge {
    let cx = icon_x + icon_w / 2.0;
    let cy = icon_y + icon_h / 2.0;

    let d_top = (cy - monitor.y).abs();
    let d_bottom = (monitor.y + monitor.height - cy).abs();
    let d_left = (cx - monitor.x).abs();
    let d_right = (monitor.x + monitor.width - cx).abs();

    let min = d_top.min(d_bottom).min(d_left).min(d_right);
    if (d_top - min).abs() < f64::EPSILON {
        TaskbarEdge::Top
    } else if (d_bottom - min).abs() < f64::EPSILON {
        TaskbarEdge::Bottom
    } else if (d_left - min).abs() < f64::EPSILON {
        TaskbarEdge::Left
    } else {
        TaskbarEdge::Right
    }
}

fn compute_panel_position(
    monitor: &MonitorInfo,
    icon_x: f64,
    icon_y: f64,
    icon_w: f64,
    icon_h: f64,
    panel_height: f64,
) -> (f64, f64) {
    let (x, y) = match detect_taskbar_edge(monitor, icon_x, icon_y, icon_w, icon_h) {
        TaskbarEdge::Top => (icon_x, icon_y + icon_h),
        TaskbarEdge::Bottom => (icon_x, icon_y - panel_height),
        TaskbarEdge::Left => (icon_x + icon_w, icon_y),
        TaskbarEdge::Right => (icon_x - PANEL_WIDTH, icon_y),
    };

    let x = x.clamp(monitor.wa_x, monitor.wa_x + monitor.wa_width - PANEL_WIDTH);
    let y = y.clamp(monitor.wa_y, monitor.wa_y + monitor.wa_height - panel_height);

    (x, y)
}

#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let main_win = match app.get_webview_window("main") {
        Some(w) => w,
        None => {
            let win =
                WebviewWindowBuilder::new(&app, "main", WebviewUrl::App("index.html".into()))
                    .title("We Health Tick")
                    .inner_size(800.0, 600.0)
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

            let main_sf = main_win.scale_factor().unwrap_or(sf);
            let main_size = main_win
                .inner_size()
                .map(|s| s.to_logical::<f64>(main_sf))
                .unwrap_or_else(|_| tauri::LogicalSize::new(800.0, 600.0));

            let x = wa_x + (wa_w - main_size.width) / 2.0;
            let y = wa_y + (wa_h - main_size.height) / 2.0;

            let _ = main_win.set_position(LogicalPosition::new(x, y));
        }
        let _ = panel.hide();
    }

    let _ = main_win.show();
    let _ = main_win.unminimize();
    let _ = main_win.set_focus();

    Ok(())
}

#[tauri::command]
pub fn fit_panel(app: tauri::AppHandle, height: f64) -> Result<(), String> {
    let panel = app.get_webview_window("panel").ok_or("panel not found")?;
    let tray = app.tray_by_id("tray").ok_or("tray not found")?;

    let _ = panel.set_size(LogicalSize::new(PANEL_WIDTH, height));
    position_panel(&tray, &panel);

    Ok(())
}

fn create_panel(app: &tauri::AppHandle, tray: &tauri::tray::TrayIcon) {
    let panel = WebviewWindowBuilder::new(app, "panel", WebviewUrl::App("panel.html".into()))
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .shadow(false)
        .focused(true)
        .inner_size(240.0, DEFAULT_PANEL_HEIGHT);

    if let Ok(w) = panel.build() {
        position_panel(tray, &w);
        let _ = w.show();
        let _ = w.set_focus();
    }
}
