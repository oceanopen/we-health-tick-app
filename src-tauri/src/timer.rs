use chrono::Local;
use rusqlite::Connection;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Listener, Manager, State};

use crate::config::{read_config_conn, ConfigState};
use crate::shared::types::{Phase, TimerStatePayload};

// ============================================================
// 内部状态
// ============================================================

struct TimerInner {
    /// 当前状态机阶段（FSM 5 状态之一）。
    phase: Phase,
    /// working 阶段的目标结束 epoch 秒。绝对时间机制：每秒 tick 时
    /// `remaining = target_epoch - now`，避免系统休眠 / 时钟跳变导致的累积漂移。
    /// 仅 working 阶段有意义（breaking 用 remaining_seconds 递减）。
    target_epoch: i64,
    /// 当前 phase 的剩余秒数（working 与 breaking 共用此字段）。
    /// - working 阶段：每秒 tick 时由 target_epoch 重算（不持久化）
    /// - breaking 阶段：递减（M2 实现）
    ///
    /// 是 emit 给前端的核心字段之一（圆环 + MM:SS）。
    remaining_seconds: i64,
    /// 本轮总秒数。working 阶段 = work_duration × 60；breaking 阶段 = break 或 long_break 时长。
    /// UI 圆环进度分母：progress = remaining_seconds / total_seconds。
    total_seconds: i64,
    /// 进入 Paused 前的阶段，恢复时回到这里（M2 toggle_pause 使用）。
    /// 例如 working → paused 时存 Working，恢复时回到 working。
    paused_phase: Option<Phase>,
    /// 当前 Paused 是否由 quietHours 静音触发（true）vs 用户手动暂停（false）。
    /// M3 quietHours 判断使用：
    ///   - 静音命中 → apply_enter_quiet_paused 设为 true；静音结束时自动 start_work 新一轮
    ///   - 用户手动 → apply_enter_paused 设为 false；不自动恢复，等用户点继续
    ///   - apply_resume 检测 true 时返回 false（静音期间忽略 toggle_pause）
    paused_by_quiet: bool,
    /// 已完成的工作-休息轮数。M3 长休息判定输入：
    /// `completed_cycles > 0 && completed_cycles % long_break_interval == 0`。
    /// 仅正常完成 on_break_done 才递增；跳过休息不计入。
    completed_cycles: u32,
    /// 跳过休息的累计点击次数。M2 skip_break 中递增，达到 3 才真正跳过；
    /// 每次 start_break 进入 breaking 时清零。前端按钮显示「跳过 (n/3)」。
    break_skip_count: u32,
    /// 当前随机抽取的提醒文案（来自 reminders 配置）。M2 的 on_work_done 中抽取；
    /// working / waiting / paused 阶段为空字符串。
    current_reminder: String,
    /// 本次休息是否为长休息。M3 的 start_break 中判定；前端 breaking UI 据此切换标签。
    is_long_break: bool,
    /// 当前状态对应的日期（yyyy-MM-dd，本地时区）。
    /// 运行时跨天判断：tick 中若 save_date != today，触发 fresh_working 开始新一轮。
    save_date: String,
}

// Tauri 全局状态容器：在 init 中通过 app.manage(TimerState) 注册，
// 之后 command 函数（如 get_timer_state）通过 State<'_, TimerState> 注入访问。
// 内部用 Arc<Mutex<TimerInner>> 而非直接 Mutex：因为 1Hz 定时器循环（spawn 的 async 任务）
// 和 config-changed handler（listen 闭包）都需要 owned 句柄跨上下文共享同一份状态。
// 与 ConfigState 的 newtype 风格保持一致。
pub struct TimerState {
    inner: Arc<Mutex<TimerInner>>,
}

// ============================================================
// 业务配置 key + 默认值
// ============================================================
//
// ⚠️ SSOT (Single Source of Truth)：src/shared/config.ts
//
// 下方 key 与默认值与前端 config.ts 一一对应（前端是可信源）。
// 修改任一项时，必须同步另一侧；否则会出现「DB 无值时前后端兜底不一致」的 bug
// （例：后端读 work_duration 默认 30，前端 UI 显示 25，用户首次进设置页看到错值）。
//
// 重复存在的根因：Tauri 跨语言边界（TS webview ↔ Rust native）不能共享内存常量，
// IPC 只传字符串；两边都需要 key 名 + 兜底默认值。这是结构性重复，非设计失误。
//
// 配对清单（修改时按此核对）：
//   KEY_WORK_DURATION          ↔ WORK_DURATION_KEY         / DEFAULT_WORK_DURATION
//   KEY_BREAK_DURATION         ↔ BREAK_DURATION_KEY        / DEFAULT_BREAK_DURATION
//   KEY_LONG_BREAK_ENABLED     ↔ LONG_BREAK_ENABLED_KEY    / DEFAULT_LONG_BREAK_ENABLED
//   KEY_LONG_BREAK_INTERVAL    ↔ LONG_BREAK_INTERVAL_KEY   / DEFAULT_LONG_BREAK_INTERVAL
//   KEY_LONG_BREAK_DURATION    ↔ LONG_BREAK_DURATION_KEY   / DEFAULT_LONG_BREAK_DURATION
//   KEY_REST_CONFIRM           ↔ REST_CONFIRM_KEY          / DEFAULT_REST_CONFIRM
//   KEY_REMINDERS              ↔ REMINDERS_KEY             / （无默认，运行时 decode/pick）

const KEY_WORK_DURATION: &str = "work_duration";
const DEFAULT_WORK_DURATION_MIN: u32 = 30;

const KEY_BREAK_DURATION: &str = "break_duration";
const DEFAULT_BREAK_DURATION_MIN: u32 = 1;

const KEY_LONG_BREAK_ENABLED: &str = "long_break_enabled";
const DEFAULT_LONG_BREAK_ENABLED: bool = true; // Y

const KEY_LONG_BREAK_INTERVAL: &str = "long_break_interval";
const DEFAULT_LONG_BREAK_INTERVAL: u32 = 2;

const KEY_LONG_BREAK_DURATION: &str = "long_break_duration";
const DEFAULT_LONG_BREAK_DURATION_MIN: u32 = 5;

const KEY_REST_CONFIRM: &str = "rest_confirm";
const DEFAULT_REST_CONFIRM: bool = true; // Y

const KEY_REMINDERS: &str = "reminders";

// quiet_hours：JSON 数组 [{start: "HH:mm", end: "HH:mm"}]，schema 与前端
// src/shared/config.ts 的 QuietHourPeriod 一致；支持跨午夜（start > end）。
const KEY_QUIET_HOURS: &str = "quiet_hours";

// ============================================================
// 时间辅助函数
// ============================================================

// 返回今天日期字符串（yyyy-MM-dd，本地时区）。
// 场景：与 TimerInner.save_date 比较，检测应用运行期间是否跨天；跨天则触发 fresh_working 重置。
fn today_string() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

// 返回当前 epoch 秒（本地时区）。
// 场景：working 阶段每秒重算 remaining_seconds = target_epoch - now；
//      fresh_working 与 on_config_changed 中设 target_epoch = now + duration。
fn now_epoch() -> i64 {
    Local::now().timestamp()
}

// 拿 TimerInner 锁，poisoned 时自动恢复（避免线程 panic 级联导致整个状态机死锁）。
// 场景：所有需要读写 TimerInner 的同步代码块入口。
fn lock_inner(inner: &Mutex<TimerInner>) -> MutexGuard<'_, TimerInner> {
    inner.lock().unwrap_or_else(|e| e.into_inner())
}

// ============================================================
// 配置读取
// ============================================================

// 从 DB 读 work_duration 配置（单位：分钟）。
// 容错：DB 无值 / 非数字 / 解析失败 → 回退默认 30 分钟（与 src/shared/config.ts 对齐）。
// 场景：fresh_working 初始化工作时长 + on_config_changed 响应配置变化时重新读取。
fn read_work_duration_minutes(conn: &Connection) -> u32 {
    read_config_conn(conn, KEY_WORK_DURATION)
        .ok()
        .flatten()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(DEFAULT_WORK_DURATION_MIN)
}

// 读 break_duration（分钟），同样容错回退。
fn read_break_duration_minutes(conn: &Connection) -> u32 {
    read_config_conn(conn, KEY_BREAK_DURATION)
        .ok()
        .flatten()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(DEFAULT_BREAK_DURATION_MIN)
}

// 读 long_break_enabled（Y/N），容错回退默认 Y。
fn read_long_break_enabled(conn: &Connection) -> bool {
    read_config_conn(conn, KEY_LONG_BREAK_ENABLED)
        .ok()
        .flatten()
        .map(|s| s == "Y")
        .unwrap_or(DEFAULT_LONG_BREAK_ENABLED)
}

// 读 long_break_interval（轮），容错回退 2。
fn read_long_break_interval(conn: &Connection) -> u32 {
    read_config_conn(conn, KEY_LONG_BREAK_INTERVAL)
        .ok()
        .flatten()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(DEFAULT_LONG_BREAK_INTERVAL)
}

// 读 long_break_duration（分钟），容错回退 5。
fn read_long_break_duration_minutes(conn: &Connection) -> u32 {
    read_config_conn(conn, KEY_LONG_BREAK_DURATION)
        .ok()
        .flatten()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(DEFAULT_LONG_BREAK_DURATION_MIN)
}

// 读 rest_confirm（Y/N），容错回退默认 Y。
// Y：工作结束时先进 Alerting 等用户确认；N：直接进 Breaking。
fn read_rest_confirm(conn: &Connection) -> bool {
    read_config_conn(conn, KEY_REST_CONFIRM)
        .ok()
        .flatten()
        .map(|s| s == "Y")
        .unwrap_or(DEFAULT_REST_CONFIRM)
}

// 读 quiet_hours：JSON 数组 [{start: "HH:mm", end: "HH:mm"}]，schema 与前端一致。
// 容错：DB 无值 / JSON 解析失败 / 字段缺失 → 空 vec，视为无静音时段。
// 每秒被 run_timer_loop 调用一次，开销可忽略（quiet_hours 通常 < 5 项）。
fn read_quiet_hours(conn: &Connection) -> Vec<(String, String)> {
    #[derive(serde::Deserialize)]
    struct Period {
        start: String,
        end: String,
    }
    let raw = read_config_conn(conn, KEY_QUIET_HOURS)
        .ok()
        .flatten()
        .unwrap_or_default();
    let periods: Vec<Period> = serde_json::from_str(&raw).unwrap_or_default();
    periods.into_iter().map(|p| (p.start, p.end)).collect()
}

// 返回当前本地时区的 "HH:mm" 字符串。
// 用于 quietHours 判断；每秒被调用一次。
fn now_hhmm() -> String {
    Local::now().format("%H:%M").to_string()
}

// 判断某 HH:mm 时刻是否落在任一静音时段内。
// - 同日时段（start ≤ end，如 12:00-14:00）：start <= hhmm && hhmm < end
// - 跨午夜时段（start > end，如 22:00-06:00）：hhmm >= start || hhmm < end
// 注：用字符串比较合法，因为 "HH:mm" 定长格式字典序等价于时间序（"09:00" < "12:00" < "22:00"）。
fn is_in_quiet_periods(periods: &[(String, String)], hhmm: &str) -> bool {
    periods.iter().any(|(start, end)| {
        if start <= end {
            // 同日时段：[start, end)
            hhmm >= start.as_str() && hhmm < end.as_str()
        } else {
            // 跨午夜时段：[start, 24:00) ∪ [00:00, end)
            hhmm >= start.as_str() || hhmm < end.as_str()
        }
    })
}

// 从 reminders JSON 数组随机抽一条，空数组/解析失败 → 空串。
// 伪随机源：本地时区纳秒精度（chrono），无需引入 rand crate。
// 调用频率：仅在每次 on_work_done（工作结束）时一次，纳秒粒度足够避免重复。
fn pick_random_reminder(conn: &Connection) -> String {
    let raw = read_config_conn(conn, KEY_REMINDERS)
        .ok()
        .flatten()
        .unwrap_or_default();
    let list: Vec<String> = serde_json::from_str(&raw).unwrap_or_default();
    if list.is_empty() {
        return String::new();
    }
    let idx = (Local::now().timestamp_nanos_opt().unwrap_or(0) as usize) % list.len();
    list.into_iter().nth(idx).unwrap_or_default()
}

// ============================================================
// 状态构造与序列化
// ============================================================

// 构造一个全新的 Working 阶段状态：按当前 work_duration 设 target_epoch = now + duration。
// 场景：应用启动初始化（init）+ 运行时跨天重置（run_timer_loop 检测到 save_date 变化）。
//      其他 phase（Alerting/Breaking/...）的构造逻辑在 M2（start_break 等）实现。
fn fresh_working(conn: &Connection) -> TimerInner {
    let minutes = read_work_duration_minutes(conn);
    let total_seconds = (minutes as i64) * 60;
    let target_epoch = now_epoch() + total_seconds;
    TimerInner {
        phase: Phase::Working,
        target_epoch,
        remaining_seconds: total_seconds,
        total_seconds,
        paused_phase: None,
        paused_by_quiet: false,
        completed_cycles: 0,
        break_skip_count: 0,
        current_reminder: String::new(),
        is_long_break: false,
        save_date: today_string(),
    }
}

// ============================================================
// 内部状态转移纯函数（操作 &mut TimerInner，不读 DB、不 emit）
// ============================================================
//
// 这些函数由 command（持有 State）与定时器循环（持有 Arc<Mutex>）共享调用，
// 确保状态修改规则集中、可测试。调用方负责：
//   1. 持有 TimerInner 锁
//   2. 临时锁 ConfigState 读 DB（按 inner → config 顺序避免死锁）
//   3. 锁外 emit phase-changed / timer-tick / show-panel

// 长休息判定（读取递增前的 completed_cycles）：
//   `enabled && interval > 0 && completed_cycles > 0 && completed_cycles % interval == 0`
// 关键：completed_cycles 在 on_break_done 中后置递增，第一次休息时 = 0，永不长休息。
fn check_is_long_break(enabled: bool, interval: u32, completed_cycles: u32) -> bool {
    enabled && interval > 0 && completed_cycles > 0 && completed_cycles % interval == 0
}

// 进入 Working 阶段：重设 target_epoch = now + work_total_secs + 清休息相关字段。
// 场景：start_work command / confirm_return / reset / 跳过休息。
fn apply_start_work(inner: &mut TimerInner, work_total_secs: i64, now: i64) {
    inner.phase = Phase::Working;
    inner.target_epoch = now + work_total_secs;
    inner.remaining_seconds = work_total_secs;
    inner.total_seconds = work_total_secs;
    inner.paused_phase = None;
    inner.paused_by_quiet = false;
    inner.break_skip_count = 0;
    inner.current_reminder = String::new();
    inner.is_long_break = false;
}

// 工作倒计时归零：抽取 reminder + 按 rest_confirm 分流。
// rest_confirm=true → 进 Alerting（等用户确认）；=false → 调用方继续 apply_start_break。
// 返回进入的下一个 phase，调用方据此决定是否继续 breaking 流程 / emit show-panel。
fn apply_on_work_done(inner: &mut TimerInner, reminder: String, rest_confirm: bool) -> Phase {
    inner.current_reminder = reminder;
    if rest_confirm {
        inner.phase = Phase::Alerting;
        inner.remaining_seconds = 0;
        inner.target_epoch = 0;
        Phase::Alerting
    } else {
        // 调用方继续：调 apply_start_break
        Phase::Breaking
    }
}

// 进入 Breaking 阶段：清 break_skip_count + 设剩余/总秒数。
// is_long 由调用方按 check_is_long_break 判定后传入（用递增前的 completed_cycles）。
fn apply_start_break(inner: &mut TimerInner, break_total_secs: i64, is_long: bool) {
    inner.phase = Phase::Breaking;
    inner.target_epoch = 0; // breaking 不用 target_epoch（递减模式）
    inner.remaining_seconds = break_total_secs;
    inner.total_seconds = break_total_secs;
    inner.is_long_break = is_long;
    inner.break_skip_count = 0;
    inner.paused_phase = None;
    inner.paused_by_quiet = false;
}

// 休息正常结束（on_break_done）：后置递增 completed_cycles + 进 Waiting。
// 关键：completedCycles 后置递增 → 下次 start_break 判定时读到递增后的值。
fn apply_on_break_done(inner: &mut TimerInner) {
    inner.completed_cycles += 1;
    inner.phase = Phase::Waiting;
    inner.remaining_seconds = 0;
    inner.target_epoch = 0;
}

// 进入 Paused：仅 Working / Breaking 可暂停；保存原 phase 到 paused_phase。
// 用户手动暂停（paused_by_quiet = false）：不自动恢复，等用户点继续。
fn apply_enter_paused(inner: &mut TimerInner) -> bool {
    if inner.phase != Phase::Working && inner.phase != Phase::Breaking {
        return false;
    }
    inner.paused_phase = Some(inner.phase);
    inner.paused_by_quiet = false;
    inner.phase = Phase::Paused;
    true
}

// 进入 Paused（静音触发）：任意非 Paused 阶段都强制进 Paused。
// 与 apply_enter_paused 区别：
//   - 适用阶段更广（Alerting / Waiting 也会被打断）
//   - paused_by_quiet = true；静音结束时由 tick 自动 start_work 新一轮（不恢复原进度）
fn apply_enter_quiet_paused(inner: &mut TimerInner) -> bool {
    if inner.phase == Phase::Paused {
        return false;
    }
    inner.paused_phase = Some(inner.phase);
    inner.paused_by_quiet = true;
    inner.phase = Phase::Paused;
    true
}

// 从 Paused 恢复：根据 paused_phase 重设（working 重设 target_epoch；breaking 保持 remaining 递减）。
// ⚠️ 静音触发的 paused（paused_by_quiet=true）不允许手动恢复：返回 false，toggle_pause 忽略；
//    等系统在 tick 中检测静音结束后自动 start_work。
fn apply_resume(inner: &mut TimerInner, now: i64) -> bool {
    if inner.phase != Phase::Paused {
        return false;
    }
    if inner.paused_by_quiet {
        // 静音期间，用户手动「继续」无效
        return false;
    }
    let prev = inner.paused_phase.unwrap_or(Phase::Working);
    inner.phase = prev;
    inner.paused_phase = None;
    if prev == Phase::Working && inner.remaining_seconds > 0 {
        // 重设 target_epoch = now + remaining，继续 working 倒计时
        inner.target_epoch = now + inner.remaining_seconds;
    }
    true
}

// 把 TimerInner 转成可序列化的 TimerStatePayload（前端能直接消费的形态）。
// prev_phase 取值：
//   - None：普通 tick 快照（timer-tick 事件、get_timer_state command 返回）
//   - Some(old)：刚从 old 切换到当前 phase（phase-changed 事件，前端用于切 UI 分支）
fn build_payload(inner: &TimerInner, prev_phase: Option<Phase>) -> TimerStatePayload {
    TimerStatePayload {
        phase: inner.phase,
        prev_phase,
        remaining_seconds: inner.remaining_seconds,
        total_seconds: inner.total_seconds,
        current_reminder: inner.current_reminder.clone(),
        is_long_break: inner.is_long_break,
        break_skip_count: inner.break_skip_count,
        completed_cycles: inner.completed_cycles,
        quiet_triggered: inner.paused_by_quiet,
    }
}

// ============================================================
// 事件 emit
// ============================================================

// emit "timer-tick"：每秒推送当前状态快照，前端 useTimerState（M5）订阅以更新圆环倒计时。
// emit 失败仅 log warn，不中断主循环（前端暂时少一帧不影响下秒恢复）。
fn emit_timer_tick(app: &AppHandle, payload: TimerStatePayload) {
    if let Err(e) = app.emit(crate::shared::events::EVENT_TIMER_TICK, payload) {
        log::warn!("emit timer-tick failed: {e}");
    }
}

// emit "phase-changed"：phase 切换时推送（带 prev_phase），前端 PanelApp（M4/M5）用于切换 UI 分支。
// M1 仅在跨天重置时触发；M2 的状态转移逻辑（on_work_done / start_break 等）会频繁触发。
fn emit_phase_changed(app: &AppHandle, payload: TimerStatePayload) {
    if let Err(e) = app.emit(crate::shared::events::EVENT_PHASE_CHANGED, payload) {
        log::warn!("emit phase-changed failed: {e}");
    }
}

// emit "show-panel"：进入 Alerting / Breaking 时触发，M4 的 panel.rs 监听后主动唤起 panel 窗口。
// M2 仅 emit 事件；具体 show/create panel 由 M4 在 listener 中实现。
fn emit_show_panel(app: &AppHandle) {
    if let Err(e) = app.emit(crate::shared::events::EVENT_SHOW_PANEL, ()) {
        log::warn!("emit show-panel failed: {e}");
    }
}

// ============================================================
// 1Hz 定时器循环
// ============================================================

// 1Hz 定时器主循环：在 init 中 spawn 一次，永久运行（与应用同生命周期）。
// 每秒执行：
//   1. 跨天判断（save_date != today → fresh_working + emit phase-changed）
//   2. M3 quietHours 静音判断（每秒检查）：
//      - 命中静音 + 非 Paused → apply_enter_quiet_paused + emit phase-changed
//      - 不命中 + paused_by_quiet=true → apply_start_work（新一轮，不恢复原进度）
//      - 其他组合（已 Paused / 用户手动 paused / 非 Paused 不命中）→ 不操作
//   3. 按当前 phase 推进（若未被 quiet 切换）：
//      - Working：按 target_epoch 重算 remaining；归零 → on_work_done → Alerting 或直接 Breaking
//      - Breaking：remaining -= 1；归零 → on_break_done → Waiting
//      - Alerting / Waiting / Paused：不递减、不切换
//   4. emit timer-tick；有 phase 切换则 emit phase-changed；进入 Alerting/Breaking 则 emit show-panel
// 关键约束：所有锁内操作必须不跨 .await（std::sync::Mutex 的 MutexGuard 不是 Send），
//          payload 构建在锁内完成，emit 在锁外执行。
async fn run_timer_loop(app: AppHandle, inner: Arc<Mutex<TimerInner>>) {
    let mut interval = tokio::time::interval(Duration::from_secs(1));

    loop {
        interval.tick().await;

        // 同步块：所有状态修改 + payload 构建在锁内完成，不跨 await 持锁
        let (tick_payload, phase_change_payload, show_panel) = {
            let mut state = lock_inner(&inner);
            let mut phase_change_payload = None;
            let mut show_panel = false;

            // 运行时跨天判断：长时间运行到次日，开始新一轮工作
            let today = today_string();
            if state.save_date != today {
                let prev = state.phase;
                let config_state = app.state::<ConfigState>();
                if let Ok(conn) = config_state.0.lock() {
                    *state = fresh_working(&conn);
                    phase_change_payload = Some(build_payload(&state, Some(prev)));
                } else {
                    log::warn!("config lock poisoned, skip cross-day reset");
                }
            }

            // 一次性读 quiet_hours + work_duration（M3 quiet 判断 + 自动 start_work 共用，
            // 避免在 quiet 分支里再锁一次 ConfigState）。
            // 锁失败时回退空 quiet_periods（视为无静音）+ 默认 work 时长。
            let (quiet_periods, work_min) = {
                let config_state = app.state::<ConfigState>();
                match config_state.0.lock() {
                    Ok(conn) => (
                        read_quiet_hours(&conn),
                        read_work_duration_minutes(&conn),
                    ),
                    Err(e) => {
                        log::warn!("config lock failed, skip quiet check: {e}");
                        (Vec::new(), DEFAULT_WORK_DURATION_MIN)
                    }
                }
            };

            // M3 quietHours 静音判断（每秒检查，开销可忽略）
            let now = now_epoch();
            let in_quiet = is_in_quiet_periods(&quiet_periods, &now_hhmm());
            if in_quiet {
                // 命中静音：任意非 Paused 阶段强制进 Paused（静音触发）
                if state.phase != Phase::Paused {
                    let prev = state.phase;
                    apply_enter_quiet_paused(&mut state);
                    phase_change_payload = Some(build_payload(&state, Some(prev)));
                }
                // 已 Paused 时无操作：静音触发则保持；用户手动 paused（paused_by_quiet=false）也保持
            } else if state.phase == Phase::Paused && state.paused_by_quiet {
                // 不命中 + 静音触发的 paused → 自动 start_work 新一轮（不恢复原进度，照搬参考项目）
                let prev = state.phase;
                apply_start_work(&mut state, (work_min as i64) * 60, now);
                state.save_date = today_string();
                phase_change_payload = Some(build_payload(&state, Some(prev)));
            }

            // phase 推进（若 quiet 切到了 Paused 或 Working，下方 match 会自然落到对应分支处理新 phase）
            match state.phase {
                Phase::Working => {
                    // 绝对时间机制：按 target_epoch 重算 remaining_seconds
                    state.remaining_seconds = if state.target_epoch > now {
                        state.target_epoch - now
                    } else {
                        0
                    };

                    // 工作倒计时归零 → on_work_done
                    if state.remaining_seconds == 0 {
                        let prev = state.phase;
                        let config_state = app.state::<ConfigState>();
                        match config_state.0.lock() {
                            Ok(conn) => {
                                let reminder = pick_random_reminder(&conn);
                                let rest_confirm = read_rest_confirm(&conn);
                                let next =
                                    apply_on_work_done(&mut state, reminder, rest_confirm);

                                if next == Phase::Breaking {
                                    // rest_confirm=N：直接进 Breaking
                                    let break_min = read_break_duration_minutes(&conn);
                                    let lb_enabled = read_long_break_enabled(&conn);
                                    let lb_interval = read_long_break_interval(&conn);
                                    let lb_duration_min =
                                        read_long_break_duration_minutes(&conn);
                                    let is_long = check_is_long_break(
                                        lb_enabled,
                                        lb_interval,
                                        state.completed_cycles,
                                    );
                                    let total_min = if is_long { lb_duration_min } else { break_min };
                                    apply_start_break(
                                        &mut state,
                                        (total_min as i64) * 60,
                                        is_long,
                                    );
                                }
                                // Alerting 与 Breaking 都需要唤起 panel（M4 监听）
                                show_panel = true;
                                phase_change_payload = Some(build_payload(&state, Some(prev)));
                            }
                            Err(e) => log::warn!("config lock poisoned, skip on_work_done: {e}"),
                        }
                    }
                }
                Phase::Breaking => {
                    // breaking 用递减模式（与参考项目一致；M3 活动检测可在此基础上扩展暂停）
                    if state.remaining_seconds > 0 {
                        state.remaining_seconds -= 1;
                    }
                    if state.remaining_seconds == 0 {
                        let prev = state.phase;
                        apply_on_break_done(&mut state);
                        phase_change_payload = Some(build_payload(&state, Some(prev)));
                    }
                }
                Phase::Alerting | Phase::Waiting | Phase::Paused => {
                    // 这些阶段 tick 中不推进：Alerting 等用户确认；Waiting 等用户回来；
                    // Paused 等用户恢复或 M3 quietHours 结束。remaining 保持当前值。
                }
            }

            (
                build_payload(&state, None),
                phase_change_payload,
                show_panel,
            )
        };

        emit_timer_tick(&app, tick_payload);

        if let Some(payload) = phase_change_payload {
            emit_phase_changed(&app, payload);
        }
        if show_panel {
            emit_show_panel(&app);
        }
    }
}

// ============================================================
// config-changed handler
// ============================================================

// 订阅 "config-changed" 事件的 handler：用户在设置页改配置后由 set_config 触发。
// M1 仅响应 work_duration：若当前在 Working 阶段，重算 target_epoch + total + remaining，
//   并立即 emit timer-tick 让前端看到新剩余时间（无需等下一秒）。
// 其他 key（break_duration / long_break_* / rest_confirm / quiet_hours / reminders）由 M2/M3 接管。
fn on_config_changed(app: AppHandle, inner: Arc<Mutex<TimerInner>>, event: tauri::Event) {
    let key = serde_json::from_str::<serde_json::Value>(event.payload())
        .ok()
        .and_then(|v| v.get("key").and_then(|k| k.as_str()).map(|s| s.to_string()));

    let Some(key) = key else {
        return;
    };

    match key.as_str() {
        KEY_WORK_DURATION => {
            // 仅 working 阶段响应（重算 target_epoch / total / remaining）
            let tick_payload = {
                let mut state = lock_inner(&inner);
                if state.phase != Phase::Working {
                    return;
                }
                let minutes = {
                    let config_state = app.state::<ConfigState>();
                    match config_state.0.lock() {
                        Ok(conn) => read_work_duration_minutes(&conn),
                        Err(e) => {
                            log::warn!("config lock failed: {e}");
                            return;
                        }
                    }
                };

                let total_seconds = (minutes as i64) * 60;
                state.total_seconds = total_seconds;
                state.target_epoch = now_epoch() + total_seconds;
                state.remaining_seconds = total_seconds;
                state.save_date = today_string();

                build_payload(&state, None)
            };

            // 立即推送 tick，前端立刻看到新剩余时间
            emit_timer_tick(&app, tick_payload);
        }
        _ => {
            // M2/M3 接管其他 key（break_duration / long_break_* / rest_confirm / quiet_hours / reminders）
        }
    }
}

// ============================================================
// 公开 API：init + get_timer_state
// ============================================================

// 模块初始化入口，在 lib.rs setup 中调用（必须在 config::init 之后，因为依赖 ConfigState）。
// 执行步骤：
//   1. fresh_working 创建初始 Working 状态（重启即重新计时，不读历史）
//   2. app.manage(TimerState) 注册全局状态供 command 访问
//   3. tauri::async_runtime::spawn 启动 1Hz 定时器循环
//   4. app.listen("config-changed", ...) 订阅配置变更事件
pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // 重启即重新计时：直接 fresh_working，不读历史状态
    let inner_state = {
        let config_state = app.state::<ConfigState>();
        let conn = config_state.0.lock().map_err(|e| e.to_string())?;
        fresh_working(&conn)
    };

    let inner = Arc::new(Mutex::new(inner_state));
    app.manage(TimerState {
        inner: inner.clone(),
    });

    let app_handle_loop = app.handle().clone();
    let inner_loop = inner.clone();
    tauri::async_runtime::spawn(async move {
        run_timer_loop(app_handle_loop, inner_loop).await;
    });

    let app_handle_listen = app.handle().clone();
    let inner_listen = inner.clone();
    app.handle()
        .listen(crate::shared::events::EVENT_CONFIG_CHANGED, move |event| {
            on_config_changed(app_handle_listen.clone(), inner_listen.clone(), event);
        });

    Ok(())
}

// Tauri command：返回当前完整状态快照。
// 场景：前端 panel/settings 初始化时 invoke("get_timer_state") 主动拉取一次，
//      避免 mount 后到下一秒 timer-tick 之间的 UI 空白；之后由 timer-tick 自动同步。
#[tauri::command]
#[specta::specta]
pub fn get_timer_state(state: State<'_, TimerState>) -> Result<TimerStatePayload, String> {
    let inner = lock_inner(&state.inner);
    Ok(build_payload(&inner, None))
}

// ============================================================
// 状态转移 commands（前端按钮 invoke 入口）
// ============================================================
//
// 共同模式：
//   1. 锁 inner（同步块）
//   2. 必要时锁 ConfigState 读配置（保持 inner → config 顺序避免死锁）
//   3. 调 apply_* 纯函数修改状态
//   4. 锁外 emit phase-changed / timer-tick / show-panel
// 错误策略：锁 poisoned → 返回 Err；读配置失败 → 回退默认值（不返回 Err）。

// 强制开始新一轮工作（任意 phase 都可调用）。
// 场景：用户在 UI 点「重置」之外主动 start，或托盘菜单 start。
#[tauri::command]
#[specta::specta]
pub fn start_work(app: AppHandle, state: State<'_, TimerState>) -> Result<(), String> {
    let payload = {
        let mut inner = lock_inner(&state.inner);
        let prev = inner.phase;
        let now = now_epoch();
        let work_min = {
            let config_state = app.state::<ConfigState>();
            let conn = config_state.0.lock().map_err(|e| e.to_string())?;
            read_work_duration_minutes(&conn)
        };
        apply_start_work(&mut inner, (work_min as i64) * 60, now);
        inner.save_date = today_string();
        build_payload(&inner, Some(prev))
    };
    emit_phase_changed(&app, payload);
    Ok(())
}

// Alerting → Breaking：用户在 alerting UI 点「开始休息」。
#[tauri::command]
#[specta::specta]
pub fn confirm_break(app: AppHandle, state: State<'_, TimerState>) -> Result<(), String> {
    let (phase_payload, show_panel) = {
        let mut inner = lock_inner(&state.inner);
        if inner.phase != Phase::Alerting {
            return Err("confirm_break only valid in Alerting phase".into());
        }
        let prev = inner.phase;
        let (total_secs, is_long) = {
            let config_state = app.state::<ConfigState>();
            let conn = config_state.0.lock().map_err(|e| e.to_string())?;
            let break_min = read_break_duration_minutes(&conn);
            let lb_enabled = read_long_break_enabled(&conn);
            let lb_interval = read_long_break_interval(&conn);
            let lb_duration_min = read_long_break_duration_minutes(&conn);
            let is_long =
                check_is_long_break(lb_enabled, lb_interval, inner.completed_cycles);
            let total_min = if is_long { lb_duration_min } else { break_min };
            ((total_min as i64) * 60, is_long)
        };
        apply_start_break(&mut inner, total_secs, is_long);
        (build_payload(&inner, Some(prev)), true)
    };
    emit_phase_changed(&app, phase_payload);
    if show_panel {
        emit_show_panel(&app);
    }
    Ok(())
}

// Waiting → Working：休息结束用户点「我回来了」，开始新一轮。
#[tauri::command]
#[specta::specta]
pub fn confirm_return(app: AppHandle, state: State<'_, TimerState>) -> Result<(), String> {
    let payload = {
        let mut inner = lock_inner(&state.inner);
        if inner.phase != Phase::Waiting {
            return Err("confirm_return only valid in Waiting phase".into());
        }
        let prev = inner.phase;
        let now = now_epoch();
        let work_min = {
            let config_state = app.state::<ConfigState>();
            let conn = config_state.0.lock().map_err(|e| e.to_string())?;
            read_work_duration_minutes(&conn)
        };
        apply_start_work(&mut inner, (work_min as i64) * 60, now);
        build_payload(&inner, Some(prev))
    };
    emit_phase_changed(&app, payload);
    Ok(())
}

// Working/Breaking ↔ Paused 切换。
// - Working 或 Breaking → Paused（保存 paused_phase）
// - Paused → 原 phase（working 重设 target_epoch = now + remaining；breaking 保持递减）
// - Alerting / Waiting：不操作（这两个阶段无「暂停」语义）
#[tauri::command]
#[specta::specta]
pub fn toggle_pause(app: AppHandle, state: State<'_, TimerState>) -> Result<(), String> {
    let payload_opt = {
        let mut inner = lock_inner(&state.inner);
        let prev = inner.phase;
        let changed = match inner.phase {
            Phase::Working | Phase::Breaking => apply_enter_paused(&mut inner),
            Phase::Paused => apply_resume(&mut inner, now_epoch()),
            _ => false,
        };
        if changed {
            Some(build_payload(&inner, Some(prev)))
        } else {
            None
        }
    };
    if let Some(payload) = payload_opt {
        emit_phase_changed(&app, payload);
    }
    Ok(())
}

// 重置：清 completed_cycles + 重新开始 Working（与参考项目 reset 一致）。
#[tauri::command]
#[specta::specta]
pub fn reset(app: AppHandle, state: State<'_, TimerState>) -> Result<(), String> {
    let payload = {
        let mut inner = lock_inner(&state.inner);
        let prev = inner.phase;
        let work_min = {
            let config_state = app.state::<ConfigState>();
            let conn = config_state.0.lock().map_err(|e| e.to_string())?;
            read_work_duration_minutes(&conn)
        };
        apply_start_work(&mut inner, (work_min as i64) * 60, now_epoch());
        inner.completed_cycles = 0;
        inner.save_date = today_string();
        build_payload(&inner, Some(prev))
    };
    emit_phase_changed(&app, payload);
    Ok(())
}

// 立即休息：Working → Breaking（用户主动「立即休息」按钮；不计 completed_cycles）。
#[tauri::command]
#[specta::specta]
pub fn manual_break(app: AppHandle, state: State<'_, TimerState>) -> Result<(), String> {
    let (phase_payload, show_panel) = {
        let mut inner = lock_inner(&state.inner);
        if inner.phase != Phase::Working {
            return Err("manual_break only valid in Working phase".into());
        }
        let prev = inner.phase;
        let (total_secs, is_long) = {
            let config_state = app.state::<ConfigState>();
            let conn = config_state.0.lock().map_err(|e| e.to_string())?;
            let break_min = read_break_duration_minutes(&conn);
            let lb_enabled = read_long_break_enabled(&conn);
            let lb_interval = read_long_break_interval(&conn);
            let lb_duration_min = read_long_break_duration_minutes(&conn);
            let is_long =
                check_is_long_break(lb_enabled, lb_interval, inner.completed_cycles);
            let total_min = if is_long { lb_duration_min } else { break_min };
            ((total_min as i64) * 60, is_long)
        };
        apply_start_break(&mut inner, total_secs, is_long);
        (build_payload(&inner, Some(prev)), true)
    };
    emit_phase_changed(&app, phase_payload);
    if show_panel {
        emit_show_panel(&app);
    }
    Ok(())
}

// 跳过休息（Breaking 阶段）：需连点 3 次才生效，防止误触。
// - < 3 次：break_skip_count += 1，emit timer-tick 让 UI 显示「跳过 (n/3)」
// - >= 3 次：跳过本次休息（不计入 completed_cycles），直接 start_work
#[tauri::command]
#[specta::specta]
pub fn skip_break(app: AppHandle, state: State<'_, TimerState>) -> Result<(), String> {
    let (tick_payload, phase_payload) = {
        let mut inner = lock_inner(&state.inner);
        if inner.phase != Phase::Breaking {
            return Err("skip_break only valid in Breaking phase".into());
        }
        inner.break_skip_count = inner.break_skip_count.saturating_add(1);
        if inner.break_skip_count < 3 {
            (Some(build_payload(&inner, None)), None)
        } else {
            let prev = inner.phase;
            let work_min = {
                let config_state = app.state::<ConfigState>();
                let conn = config_state.0.lock().map_err(|e| e.to_string())?;
                read_work_duration_minutes(&conn)
            };
            apply_start_work(&mut inner, (work_min as i64) * 60, now_epoch());
            (None, Some(build_payload(&inner, Some(prev))))
        }
    };
    if let Some(p) = tick_payload {
        emit_timer_tick(&app, p);
    }
    if let Some(p) = phase_payload {
        emit_phase_changed(&app, p);
    }
    Ok(())
}
