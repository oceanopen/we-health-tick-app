use chrono::Local;
use rusqlite::Connection;
use serde::Serialize;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Listener, Manager, State};

use crate::config::{read_config_conn, ConfigState};

// ============================================================
// Phase 枚举（5 状态 FSM）
// ============================================================

#[allow(dead_code)] // Alerting/Breaking/Waiting/Paused 由 M2/M3 状态转移逻辑使用
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Working,
    Alerting,
    Breaking,
    Waiting,
    Paused,
}

// ============================================================
// Payload（timer-tick / phase-changed 共用）
// ============================================================

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerStatePayload {
    /// 当前状态机阶段。前端 PanelApp（M5）据此切换 5 种 UI 分支
    /// （Working/Alerting/Breaking/Waiting/Paused 各一个视图）。
    pub phase: Phase,
    /// 切换前的阶段。仅在 phase-changed 事件中有意义（前端做过渡动画 / 判断进入 vs 离开）；
    /// timer-tick 与 get_timer_state 中恒为 None。
    pub prev_phase: Option<Phase>,
    /// 本阶段剩余秒数。working / breaking 阶段倒计时核心字段：
    /// 前端圆环进度 = remaining / total，中央显示 MM:SS。
    pub remaining_seconds: i64,
    /// 本轮总秒数（work_duration 或 break_duration / long_break_duration 换算成秒）。
    /// UI 圆环进度分母，与 remaining_seconds 配合算百分比。
    pub total_seconds: i64,
    /// 当前随机抽取的提醒文案。alerting 阶段大字显示唤起注意，breaking 阶段小字辅助；
    /// working / waiting / paused 阶段为空字符串。M2 的 on_work_done 中抽取。
    pub current_reminder: String,
    /// 本次休息是否为长休息。前端 breaking UI 据此显示「休息中」/「长休息中」标签与不同配色；
    /// M3 的 start_break 中按 completed_cycles % interval 判定。
    pub is_long_break: bool,
    /// 跳过休息的累计点击次数。前端 breaking 阶段按钮显示「跳过 (n/3)」；
    /// 达到 3 才真正跳过（M2 skip_break 实现，防止误触）。进入 breaking 时清零。
    pub break_skip_count: u32,
    /// 已完成的工作-休息轮数。M3 长休息判定输入：
    /// `completed_cycles > 0 && completed_cycles % interval == 0`；
    /// 仅正常完成 on_break_done 才递增，跳过休息不计入。
    pub completed_cycles: u32,
}

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
    /// 是 emit 给前端的核心字段之一（圆环 + MM:SS）。
    remaining_seconds: i64,
    /// 本轮总秒数。working 阶段 = work_duration × 60；breaking 阶段 = break 或 long_break 时长。
    /// UI 圆环进度分母：progress = remaining_seconds / total_seconds。
    total_seconds: i64,
    /// 进入 Paused 前的阶段，恢复时回到这里（M2 toggle_pause 使用）。
    /// 例如 working → paused 时存 Working，恢复时回到 working。
    #[allow(dead_code)]
    paused_phase: Option<Phase>,
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
// 常量：业务配置 key + 默认值
// ============================================================

const KEY_WORK_DURATION: &str = "work_duration";
const DEFAULT_WORK_DURATION_MIN: u32 = 30;

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
        completed_cycles: 0,
        break_skip_count: 0,
        current_reminder: String::new(),
        is_long_break: false,
        save_date: today_string(),
    }
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
    }
}

// ============================================================
// 事件 emit
// ============================================================

// emit "timer-tick"：每秒推送当前状态快照，前端 useTimerState（M5）订阅以更新圆环倒计时。
// emit 失败仅 log warn，不中断主循环（前端暂时少一帧不影响下秒恢复）。
fn emit_timer_tick(app: &AppHandle, payload: TimerStatePayload) {
    if let Err(e) = app.emit("timer-tick", payload) {
        log::warn!("emit timer-tick failed: {e}");
    }
}

// emit "phase-changed"：phase 切换时推送（带 prev_phase），前端 PanelApp（M4/M5）用于切换 UI 分支。
// M1 仅在跨天重置时触发；M2 的状态转移逻辑（on_work_done / start_break 等）会频繁触发。
fn emit_phase_changed(app: &AppHandle, payload: TimerStatePayload) {
    if let Err(e) = app.emit("phase-changed", payload) {
        log::warn!("emit phase-changed failed: {e}");
    }
}

// ============================================================
// 1Hz 定时器循环
// ============================================================

// 1Hz 定时器主循环：在 init 中 spawn 一次，永久运行（与应用同生命周期）。
// 每秒执行：
//   1. 跨天判断（save_date != today → fresh_working + emit phase-changed）
//   2. working 阶段按 target_epoch 重算 remaining_seconds（绝对时间机制，防时钟漂移）
//   3. emit timer-tick
// 关键约束：所有锁内操作必须不跨 .await（std::sync::Mutex 的 MutexGuard 不是 Send），
//          payload 构建在锁内完成，emit 在锁外执行。
async fn run_timer_loop(app: AppHandle, inner: Arc<Mutex<TimerInner>>) {
    let mut interval = tokio::time::interval(Duration::from_secs(1));

    loop {
        interval.tick().await;

        // 同步块：所有状态修改 + payload 构建在锁内完成，不跨 await 持锁
        let (tick_payload, phase_change_payload) = {
            let mut state = lock_inner(&inner);
            let mut phase_change_payload = None;

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

            // working 阶段：根据 target_epoch 重算 remaining_seconds（绝对时间机制）
            if state.phase == Phase::Working {
                let now = now_epoch();
                state.remaining_seconds = if state.target_epoch > now {
                    state.target_epoch - now
                } else {
                    0
                };
                // M1 不实现 on_work_done 转移，留给 M2 接管
            }

            (build_payload(&state, None), phase_change_payload)
        };

        emit_timer_tick(&app, tick_payload);

        if let Some(payload) = phase_change_payload {
            emit_phase_changed(&app, payload);
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
        .listen("config-changed", move |event| {
            on_config_changed(app_handle_listen.clone(), inner_listen.clone(), event);
        });

    Ok(())
}

// Tauri command：返回当前完整状态快照。
// 场景：前端 panel/settings 初始化时 invoke("get_timer_state") 主动拉取一次，
//      避免 mount 后到下一秒 timer-tick 之间的 UI 空白；之后由 timer-tick 自动同步。
#[tauri::command]
pub fn get_timer_state(state: State<'_, TimerState>) -> Result<TimerStatePayload, String> {
    let inner = lock_inner(&state.inner);
    Ok(build_payload(&inner, None))
}
