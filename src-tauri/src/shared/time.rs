use chrono::Local;

/// 本地时区今日日期字符串（`yyyy-MM-dd`）。
///
/// 场景：与持久化的 save_date 比较，检测应用运行期间是否跨天；跨天则触发新一轮重置。
pub fn today_string() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

/// 当前 epoch 秒（本地时区）。
///
/// 场景：按绝对时间重算剩余秒数（`target_epoch - now`），避免系统休眠 / 时钟跳变累积漂移；
///      也用于设置 `target_epoch = now + duration`。
pub fn now_epoch() -> i64 {
    Local::now().timestamp()
}

/// 当前本地时区 `HH:mm` 字符串。
///
/// 场景：quietHours 等按时刻区间判断的逻辑输入；定长 `HH:mm` 字典序等价时间序，可直接字符串比较。
pub fn now_hhmm() -> String {
    Local::now().format("%H:%M").to_string()
}
