use std::sync::Mutex;

use tauri::{
    AppHandle, Listener, LogicalPosition, LogicalSize, Manager, Position, WebviewUrl,
    WebviewWindowBuilder,
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::shared::config::{read_config_raw, ConfigState, LANGUAGE_KEY};
use crate::shared::i18n::{menu_text, resolve, ResolvedLanguage};
use crate::shared::screen::{
    detect_taskbar_edge, find_monitor_for_rect, MonitorInfo, TaskbarEdge,
};
use crate::shared::types::{Phase, TimerStatePayload};

const PANEL_WIDTH: f64 = 240.0;
const DEFAULT_PANEL_HEIGHT: f64 = 320.0;

// dev build（pnpm tauri dev）tooltip 带 [DEV] 后缀，肉眼即可区分 dev/prod 产物。
const TOOLTIP: &str = if cfg!(debug_assertions) {
    "We Health Tick [DEV]"
} else {
    "We Health Tick"
};

// 已构建的托盘菜单项引用，用于语言切换时动态更新文案（MenuItem::set_text）。
struct TrayMenuItems {
    settings: MenuItem<tauri::Wry>,
    restart: MenuItem<tauri::Wry>,
    exit: MenuItem<tauri::Wry>,
}

// 读取当前语言偏好（config 的 language key）并解析为具体语言。
// 三态：zh-CN/en 直接映射，缺失或 "system" 走系统 locale 探测（默认英文）。
fn current_language(app: &AppHandle) -> ResolvedLanguage {
    let Some(state) = app.try_state::<ConfigState>() else {
        return resolve(None);
    };
    let raw = read_config_raw(state.inner(), LANGUAGE_KEY).unwrap_or(None);
    resolve(raw.as_deref())
}

// 语言切换时原地刷新托盘菜单文案，无需重建菜单或重启应用。
// 由 setup 末尾的 config-changed 监听器在 LANGUAGE_KEY 变化时调用。
pub fn refresh_menu_texts(app: &AppHandle) {
    let Some(state) = app.try_state::<Mutex<TrayMenuItems>>() else {
        return;
    };
    let Ok(items) = state.lock() else {
        return;
    };
    let lang = current_language(app);
    let _ = items.settings.set_text(menu_text(lang, "settings"));
    let _ = items.restart.set_text(menu_text(lang, "restart"));
    let _ = items.exit.set_text(menu_text(lang, "exit"));
}

/// 查询当前 Control 键是否被按下。
///
/// 用于托盘 Ctrl+左键单击：Tauri 2.11.2 的 TrayIconEvent::Click 不携带修饰键信息，
/// 故在左键单击触发瞬间主动查询键盘状态（查询式 API，与 shared/idle.rs 一致）。
///
/// 平台说明：
/// - macOS：CGEventSourceFlagsState 读取硬件级修饰键状态（CoreGraphics，无需辅助功能权限）。
/// - Windows：GetAsyncKeyState 异步读取按键状态，最高位为 1 表示当前按下（user32，无需权限）。
/// - Linux 等：托盘 show_menu 本就不支持，返回 false，维持原左键 toggle 行为。
fn control_key_pressed() -> bool {
    #[cfg(target_os = "macos")]
    {
        // kCGEventSourceStateHIDSystemState = 1（硬件级状态，最即时）；
        // kCGEventFlagMaskControl = 1 << 18 = 0x40000。
        #[link(name = "CoreGraphics", kind = "framework")]
        unsafe extern "C" {
            fn CGEventSourceFlagsState(state_id: i32, flags: u64) -> u64;
        }
        const STATE_HID: i32 = 1;
        const MASK_CONTROL: u64 = 1 << 18;
        unsafe { CGEventSourceFlagsState(STATE_HID, MASK_CONTROL) & MASK_CONTROL != 0 }
    }
    #[cfg(target_os = "windows")]
    {
        unsafe extern "system" {
            fn GetAsyncKeyState(v_key: i32) -> i16;
        }
        const VK_CONTROL: i32 = 0x11;
        // 返回值最高位（bit 15）为 1 表示按键当前处于按下状态，i16 解读即为负数。
        unsafe { GetAsyncKeyState(VK_CONTROL) < 0 }
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // CARGO_MANIFEST_DIR 在编译期由 cargo 注入，指向 src-tauri/ 根目录的绝对路径。
    // 用 concat!() 拼成 include_bytes! 的路径，让 icon 资源路径与 panel.rs 当前所在目录解耦。
    let icon = tauri::image::Image::from_bytes(include_bytes!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/icons/32x32.png"
    )))
    .expect("failed to load tray icon");

    // 右键菜单：系统设置 / 重启 / 退出。文案随当前语言偏好（config language，三态）。
    let lang = current_language(app.handle());
    let settings_item =
        MenuItem::with_id(app, "settings", menu_text(lang, "settings"), true, None::<&str>)?;
    let restart_item =
        MenuItem::with_id(app, "restart", menu_text(lang, "restart"), true, None::<&str>)?;
    let exit_item =
        MenuItem::with_id(app, "exit", menu_text(lang, "exit"), true, None::<&str>)?;
    let menu = MenuBuilder::new(app)
        .items(&[&settings_item, &restart_item, &exit_item])
        .build()?;

    TrayIconBuilder::with_id("tray")
        .icon(icon)
        .tooltip(TOOLTIP)
        .menu(&menu)
        // 关键：禁用左键弹菜单，保持左键 toggle panel 的现有行为（跨平台统一）。
        // macOS 默认左键会弹菜单，此处显式关闭；Linux 上为 no-op（左键本就触发 event）。
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "settings" => {
                let app = app.clone();
                // show_settings_window 是 async（Windows 上同步调用会触发 wry#583 死锁），
                // 在同步的 menu event 闭包里用 async_runtime::spawn 调度。
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = crate::windows::settings::show_settings_window(app).await {
                        log::warn!("show_settings_window from tray menu failed: {e}");
                    }
                });
            }
            "restart" => app.request_restart(),
            "exit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                // Ctrl+左键单击：与原生右键效果一致，弹出托盘菜单。Click 事件本身不带修饰键，
                // 故在触发瞬间查询 Control 键状态：按下则走弹菜单分支，否则走 toggle panel。
                if control_key_pressed() {
                    // with_inner_tray_icon → show_menu 是弹菜单的唯一入口；其内部用
                    // run_on_main_thread + 同步阻塞等待结果。本回调可能在主线程触发，
                    // 直接调用会死锁。故 clone 后在独立后台线程触发：后台线程阻塞等待，
                    // 主线程不被阻塞即可正常派发 show_menu。
                    let tray = tray.clone();
                    std::thread::spawn(move || {
                        if let Err(e) = tray.with_inner_tray_icon(|inner| {
                            inner.show_menu();
                        }) {
                            log::warn!("failed to show tray menu: {e}");
                        }
                    });
                    return;
                }
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

    // 保存菜单项句柄，供 refresh_menu_texts 在语言切换时动态更新文案。
    app.manage(Mutex::new(TrayMenuItems {
        settings: settings_item,
        restart: restart_item,
        exit: exit_item,
    }));

    let app_handle = app.handle().clone();
    // 启动即 fresh_working（L1），初始恒为 Working；显式设置一次避免启动瞬间显示默认 32x32.png（G3）。
    set_tray_icon_by_phase(&app_handle, Phase::Working);

    // 订阅 phase-changed：phase 切换时同步切换托盘图标（G2），
    // 并在进入非 Working 阶段时主动唤起 panel 窗口（常驻提醒）。
    // 闭包持有 owned AppHandle（Clone + Send + Sync），满足 Listener 要求的 'static。
    app.handle()
        .listen(crate::shared::events::EVENT_PHASE_CHANGED, move |event| {
        let phase = serde_json::from_str::<TimerStatePayload>(event.payload())
            .ok()
            .map(|p| p.phase);
        match phase {
            Some(phase) => {
                set_tray_icon_by_phase(&app_handle, phase);
                if phase != Phase::Working {
                    show_panel(&app_handle);
                }
            }
            None => log::warn!("phase-changed payload parse failed, skip tray icon update"),
        }
    });

    // 监听 config-changed：语言偏好变化时刷新托盘菜单文案（运行时切换，无需重启）。
    let lang_handle = app.handle().clone();
    app.listen(crate::shared::events::EVENT_CONFIG_CHANGED, move |event| {
        let Ok(value) = serde_json::from_str::<serde_json::Value>(event.payload()) else {
            return;
        };
        if value.get("key").and_then(|v| v.as_str()) == Some(LANGUAGE_KEY) {
            refresh_menu_texts(&lang_handle);
        }
    });

    Ok(())
}

// 按 phase 选托盘图标字节。dev build（pnpm tauri dev）用带红色 DEV 圆点的 -dev 变体，
// release build 用原图标。用 #[cfg] 而非 cfg!() 运行时分支：include_bytes! 是编译期展开，
// cfg!() 会把两套 PNG 都编进二进制；#[cfg] 在编译期二选一，release 产物完全不含 dev 资源。
#[cfg(debug_assertions)]
fn phase_icon_bytes(phase: Phase) -> &'static [u8] {
    match phase {
        Phase::Working => include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/icons/tray/working-dev.png")),
        Phase::Alerting | Phase::Breaking | Phase::Waiting | Phase::Paused => include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/icons/tray/nonworking-dev.png")),
    }
}

#[cfg(not(debug_assertions))]
fn phase_icon_bytes(phase: Phase) -> &'static [u8] {
    match phase {
        Phase::Working => include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/icons/tray/working.png")),
        Phase::Alerting | Phase::Breaking | Phase::Waiting | Phase::Paused => include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/icons/tray/nonworking.png")),
    }
}

// 按 phase 切换托盘图标（G2）。在 setup 末尾订阅 phase-changed 时调用；
// G3 落地后启动时也会显式调一次（Phase::Working）。
// 失败容错：图片解码 / tray 缺失 / set_icon 失败均 log::warn! 并返回，不 panic
// （托盘图标切换是非关键路径，不应阻塞状态机主流程）。
pub fn set_tray_icon_by_phase(app: &AppHandle, phase: Phase) {
    let icon = match tauri::image::Image::from_bytes(phase_icon_bytes(phase)) {
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
// phase-changed 监听器在进入非 Working 阶段时调用此函数唤起窗口。
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
