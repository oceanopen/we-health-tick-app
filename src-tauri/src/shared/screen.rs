use tauri::{AppHandle, Monitor, Position, Rect};

/// 显示器逻辑化几何：把 Tauri 物理像素几何 + work_area 除以 scale_factor 转成逻辑像素，
/// 供窗口定位算法统一消费，避免各调用方重复 `/ sf`。
///
/// 字段全 pub：detect_taskbar_edge / compute_panel_position / work_area_center
/// 等几何工具跨模块读取。
pub struct MonitorInfo {
    pub scale_factor: f64,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub wa_x: f64,
    pub wa_y: f64,
    pub wa_width: f64,
    pub wa_height: f64,
}

impl MonitorInfo {
    /// 从 Tauri Monitor 构造逻辑化几何（position/size + work_area 均除以 scale_factor）。
    pub fn from_monitor(m: &Monitor) -> Self {
        let sf = m.scale_factor();
        let mp = m.position();
        let ms = m.size();
        let wa = m.work_area();
        MonitorInfo {
            scale_factor: sf,
            x: mp.x as f64 / sf,
            y: mp.y as f64 / sf,
            width: ms.width as f64 / sf,
            height: ms.height as f64 / sf,
            wa_x: wa.position.x as f64 / sf,
            wa_y: wa.position.y as f64 / sf,
            wa_width: wa.size.width as f64 / sf,
            wa_height: wa.size.height as f64 / sf,
        }
    }
}

/// 任务栏所在屏幕边（用于贴边窗口定位）。
pub enum TaskbarEdge {
    Top,
    Bottom,
    Left,
    Right,
}

/// 用 rect（通常是 tray.rect()）的物理坐标定位所在显示器，返回逻辑化几何。
/// 多屏 / DPI 不一致时用矩形包含判断绕开 monitor_from_point 的识别坑；
/// 找不到（rect 为 Logical 或不在任何屏内）返回 None，调用方自行兜底。
pub fn find_monitor_for_rect(app: &AppHandle, rect: &Rect) -> Option<MonitorInfo> {
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
            return Some(MonitorInfo::from_monitor(&m));
        }
    }
    None
}

/// 检测图标（通常是托盘图标）落在显示器的哪条边——即任务栏朝向。
/// 原理：算图标中心到显示器四边的距离，取最小者。纯几何，不读任何窗口状态。
pub fn detect_taskbar_edge(
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

/// 在目标显示器的 work_area（扣除任务栏 / Dock）内按窗口尺寸算居中逻辑坐标。
/// `max(0.0)` 防止窗口大于 work_area 时偏移跑出可用区域（贴 work_area 左上角）。
pub fn work_area_center(monitor: &MonitorInfo, width: f64, height: f64) -> (f64, f64) {
    let x = monitor.wa_x + ((monitor.wa_width - width) / 2.0).max(0.0);
    let y = monitor.wa_y + ((monitor.wa_height - height) / 2.0).max(0.0);
    (x, y)
}
