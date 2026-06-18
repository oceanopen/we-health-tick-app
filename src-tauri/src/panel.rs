use tauri::{
    AppHandle, Listener, LogicalPosition, LogicalSize, Manager, Position, WebviewUrl,
    WebviewWindowBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::shared::types::{Phase, TimerStatePayload};

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

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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
                match app.get_webview_window("panel") {
                    Some(panel) if panel.is_visible().unwrap_or(false) => {
                        let _ = panel.hide();
                    }
                    _ => show_panel(app),
                }
            }
        })
        .build(app)?;

    let app_handle = app.handle().clone();
    // 启动即 fresh_working（L1），初始恒为 Working；显式设置一次避免启动瞬间显示默认 32x32.png（G3）。
    set_tray_icon_by_phase(&app_handle, Phase::Working);

    // 订阅 phase-changed：phase 切换时同步切换托盘图标（G2）。
    // 闭包持有 owned AppHandle（Clone + Send + Sync），满足 Listener 要求的 'static。
    app.handle()
        .listen(crate::shared::events::EVENT_PHASE_CHANGED, move |event| {
        let phase = serde_json::from_str::<TimerStatePayload>(event.payload())
            .ok()
            .map(|p| p.phase);
        match phase {
            Some(phase) => set_tray_icon_by_phase(&app_handle, phase),
            None => log::warn!("phase-changed payload parse failed, skip tray icon update"),
        }
    });

    // 订阅 show-panel：进入 Alerting / Breaking 时 timer.rs emit 此事件（B4），
    // 此处主动唤起 panel 窗口（H5）。payload 为 unit，无需解析。
    let show_panel_handle = app.handle().clone();
    app.handle()
        .listen(
            crate::shared::events::EVENT_SHOW_PANEL,
            move |_| show_panel(&show_panel_handle),
        );

    Ok(())
}

// 按 phase 切换托盘图标（G2）。在 setup 末尾订阅 phase-changed 时调用；
// G3 落地后启动时也会显式调一次（Phase::Working）。
// 失败容错：图片解码 / tray 缺失 / set_icon 失败均 log::warn! 并返回，不 panic
// （托盘图标切换是非关键路径，不应阻塞状态机主流程）。
pub fn set_tray_icon_by_phase(app: &AppHandle, phase: Phase) {
    let bytes: &[u8] = match phase {
        Phase::Working => include_bytes!("../icons/tray/working.png"),
        Phase::Alerting => include_bytes!("../icons/tray/alerting.png"),
        Phase::Breaking => include_bytes!("../icons/tray/breaking.png"),
        Phase::Waiting => include_bytes!("../icons/tray/waiting.png"),
        Phase::Paused => include_bytes!("../icons/tray/paused.png"),
    };
    let icon = match tauri::image::Image::from_bytes(bytes) {
        Ok(img) => img,
        Err(e) => {
            log::warn!("decode tray icon failed for {:?}: {e}", phase);
            return;
        }
    };
    let Some(tray) = app.tray_by_id("tray") else {
        log::warn!("tray not found when set_tray_icon_by_phase({:?})", phase);
        return;
    };
    if let Err(e) = tray.set_icon(Some(icon)) {
        log::warn!("set_icon failed for {:?}: {e}", phase);
    }
}

// 强制显示 panel（H4）：panel 不存在 → create；存在 → position + show + set_focus。
// pub 是为 H5（show-panel 事件订阅）预留统一入口，避免调用方重复实现两分支逻辑。
pub fn show_panel(app: &AppHandle) {
    let Some(tray) = app.tray_by_id("tray") else {
        log::warn!("tray not found when show_panel");
        return;
    };
    if let Some(panel) = app.get_webview_window("panel") {
        position_panel(&tray, &panel);
        let _ = panel.show();
        let _ = panel.set_focus();
    } else {
        create_panel(app, &tray);
    }
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
#[specta::specta]
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
        // 窗口不进任务栏与 Alt+Tab（Windows/Linux），macOS 上为 no-op（Dock 由 ActivationPolicy 控制）。
        .skip_taskbar(true)
        .focused(true)
        .inner_size(240.0, DEFAULT_PANEL_HEIGHT);

    if let Ok(w) = panel.build() {
        position_panel(tray, &w);
        let _ = w.show();
        let _ = w.set_focus();
    }
}
