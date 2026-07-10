// 跨 IPC 边界的共享类型（Rust ↔ TypeScript）。
// 通过 tauri-specta 自动导出到 src/shared/bindings.ts（运行 `pnpm gen:bindings`）。
// 修改本文件后必须重新生成 bindings.ts，否则前后端类型会漂移。

use serde::{Deserialize, Serialize};
use specta::Type;
// Number 用于把 i64 等 BigInt-style 类型在 specta 导出时映射为 TS `number`。
// 我们的 remaining_seconds / total_seconds 是秒数（远小于 2^53），精度安全。
use specta_typescript::Number;

// ============================================================
// Phase：5 状态机枚举
// ============================================================

/// 当前状态机阶段。前端 PanelApp 据此切换 5 种 UI 分支
/// （Working/Alerting/Breaking/Waiting/Paused 各一个视图）。
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Working,
    Alerting,
    Breaking,
    Waiting,
    Paused,
}

// ============================================================
// TimerStatePayload：timer-tick / phase-changed / get_timer_state 共用
// ============================================================

/// timer-tick / phase-changed 事件 + get_timer_state 命令的统一 payload。
#[derive(Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimerStatePayload {
    /// 当前状态机阶段。
    pub phase: Phase,
    /// 切换前的阶段。仅在 phase-changed 事件中有意义（前端做过渡动画 / 判断进入 vs 离开）；
    /// timer-tick 与 get_timer_state 中恒为 None。
    pub prev_phase: Option<Phase>,
    /// 本阶段剩余秒数。working / breaking 阶段倒计时核心字段：
    /// 前端圆环进度 = remaining / total，中央显示 MM:SS。
    #[specta(type = Number)]
    pub remaining_seconds: i64,
    /// 本轮总秒数（work_duration 或 break_duration / long_break_duration 换算成秒）。
    /// UI 圆环进度分母，与 remaining_seconds 配合算百分比。
    #[specta(type = Number)]
    pub total_seconds: i64,
    /// 当前随机抽取的提醒文案。alerting 阶段大字显示唤起注意，breaking 阶段小字辅助；
    /// working / waiting / paused 阶段为空字符串。
    pub current_reminder: String,
    /// 本次休息是否为长休息。前端 breaking UI 据此显示「休息中」/「长休息中」标签与不同配色。
    pub is_long_break: bool,
    /// 跳过休息的累计点击次数。前端 breaking 阶段按钮显示「跳过 (n/max)」；
    /// 达到 break_skip_max 配置门槛才真正跳过。进入 breaking 时清零。
    pub break_skip_count: u32,
    /// 已完成的工作-休息轮数。长休息判定输入：
    /// `completed_cycles > 0 && completed_cycles % interval == 0`；
    /// 仅正常完成 on_break_done 才递增，跳过休息不计入。
    pub completed_cycles: u32,
    /// 当前 Paused 是否由 quietHours 静音时段触发（vs 用户手动暂停）。
    pub quiet_triggered: bool,
    /// Breaking 阶段是否因检测到鼠标活动而软暂停（不切 phase，仅冻结倒计时）。
    /// 前端 BreakingView 据此显隐「检测到操作，倒计时已暂停」横幅。
    pub break_paused: bool,
}

// ============================================================
// ConfigChangedPayload：config-changed 事件
// ============================================================

/// set_config 命令成功后通过 `config-changed` 事件广播给所有窗口的载荷。
/// 订阅方（AppThemeProvider / AppI18nProvider）据此响应配置变化。
#[derive(Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConfigChangedPayload {
    /// 变更的配置 key（与 src/shared/config.ts 中的 *_KEY 常量对齐）。
    pub key: String,
    /// 新值（配置统一以字符串形式存储，订阅方按 key 自行 decode）。
    pub value: String,
}

// ============================================================
// YesNo：Y/N 布尔约定（rest_confirm / long_break_enabled）
// ============================================================

/// Y/N 布尔约定的 SSOT。
///
/// serde rename 决定 DB 存储格式（"Y"/"N"）+ 前端 bindings.ts 字面量联合类型。
/// 前端 src/shared/config.ts 的 YES_NO 运行时对象受此类型约束
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize, Type)]
pub enum YesNo {
    #[serde(rename = "Y")]
    Yes,
    #[serde(rename = "N")]
    No,
}

impl YesNo {
    pub fn is_yes(self) -> bool {
        matches!(self, Self::Yes)
    }
}

impl std::str::FromStr for YesNo {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Y" => Ok(Self::Yes),
            "N" => Ok(Self::No),
            _ => Err(()),
        }
    }
}
