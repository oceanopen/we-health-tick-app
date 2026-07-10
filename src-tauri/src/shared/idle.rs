// 跨平台用户输入空闲时间查询。
//
// 用于 Breaking 阶段的「鼠标活动检测」：每秒由 run_timer_loop 调用一次，
// 返回距上次输入（鼠标移动 + 键盘按键取最小值）的秒数。
// idle < 阈值 → 用户在用电脑 → 暂停 break 倒计时（不切 phase，仅 Breaking 内部软暂停）。
//
// 选型：查询式 API（非事件订阅），与参考项目 health-tick-release 一致。
//   - macOS：CGEventSourceSecondsSinceLastEventType（CoreGraphics，只读聚合统计，无需任何权限）
//   - Windows：GetLastInputInfo + GetTickCount（user32/kernel32，无需权限，任意输入）
//   - 其他平台：返回 0.0（视为始终静止，不影响计时）

#[cfg(target_os = "macos")]
mod platform {
    // CGEventSourceStateID 底层是 CFIndex（macOS 64 位 = c_long = i64）。
    // kCGEventSourceStateCombinedSessionState = 0（合并所有登录会话的事件，全局跨应用）。
    const COMBINED_SESSION_STATE: i64 = 0;
    // CGEventType 底层是 uint32_t。kCGEventMouseMoved = 5，kCGEventKeyDown = 10。
    const MOUSE_MOVED: u32 = 5;
    const KEY_DOWN: u32 = 10;

    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(stateID: i64, eventType: u32) -> f64;
    }

    pub fn idle_seconds() -> f64 {
        unsafe {
            let mouse = CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION_STATE, MOUSE_MOVED);
            let key = CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION_STATE, KEY_DOWN);
            mouse.min(key)
        }
    }
}

#[cfg(target_os = "windows")]
mod platform {
    // LASTINPUTINFO：cbSize 是结构体字节数，dwTime 是上次输入时的 GetTickCount 值。
    #[repr(C)]
    struct LastInputInfo {
        cb_size: u32,
        dw_time: u32,
    }

    unsafe extern "system" {
        fn GetLastInputInfo(plii: *mut LastInputInfo) -> i32;
        fn GetTickCount() -> u32;
    }

    pub fn idle_seconds() -> f64 {
        unsafe {
            let mut info = LastInputInfo {
                cb_size: core::mem::size_of::<LastInputInfo>() as u32,
                dw_time: 0,
            };
            if GetLastInputInfo(&mut info) == 0 {
                return 0.0;
            }
            let now = GetTickCount();
            // wrapping_sub 处理 GetTickCount 49.7 天周期溢出。
            now.wrapping_sub(info.dw_time) as f64 / 1000.0
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod platform {
    pub fn idle_seconds() -> f64 {
        0.0
    }
}

/// 返回距上次用户输入的秒数（鼠标移动 + 键盘按键取最小值；Windows 为任意输入）。
pub fn get_idle_seconds() -> f64 {
    platform::idle_seconds()
}
