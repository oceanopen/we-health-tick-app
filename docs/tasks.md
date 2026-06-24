# 健康提醒功能 - 原子功能点清单

> **目的**：本文件是「健康提醒功能」开发的断点续传文档。功能被拆成**尽可能细的原子功能点**，每个点能独立、直观地验证；开发节奏为「**一次只做一个功能点**」，做完即在本文勾选。
>
> **创建日期**：2026-06-17（初版）/ 2026-06-18（重构为原子功能点）
> **参考项目**：`/Users/gaopan/MyFiles/Project/health-tick-release`（macOS Swift 原生应用）
> **当前项目**：`/Users/gaopan/MyFiles/Project/we-health-tick-app`（Tauri 2 + React 19 + MUI 9）
>
> **图例**：✅ 已完成 ｜ ❌ 待实施 ｜ ⚠️ 可优化（非阻塞，留作后续可选任务）

---

## 一、需求与范围

### 1.1 目标
完美复制参考项目（health-tick-release）的**健康提醒功能**到当前 Tauri + React 项目，仅保留**托盘提醒**模式（对应参考项目的 `breakPosition = menuWindow`）。

### 1.2 范围边界

| 类别 | 说明 |
|------|------|
| ✅ 纳入实现 | 核心工作-休息循环、休息确认、长休息、静音时段（quietHours）、托盘图标状态切换、状态持久化（崩溃恢复） |
| ⚠️ 简化处理 | 休息期间不做「活动检测」（倒计时按墙钟正常进行）；声音提示暂不实现 |
| ❌ 不实现 | 打卡/统计/成就/徽章、节假日同步、工作时间窗口+工作日、数据导出、更新检查、浮动窗口/全屏覆盖层、护眼模式、全局快捷键、多屏支持 |

### 1.3 核心决策（已与用户确认）

| 决策项 | 选定方案 | 理由 |
|--------|----------|------|
| 状态机承载位置 | **后端 Rust 主导** | 定时器在后端 tokio interval，panel 关闭/隐藏时计时照常；托盘图标后端切换；崩溃可恢复；跨窗口一致 |
| panel 可见性 | **alerting 强制可见，breaking/waiting 允许隐藏** | 工作倒计时归零时强制用户确认；休息中可手动关闭 panel，倒计时在后端继续 |
| 复杂细节取舍 | **全部简化** | 不做活动检测；声音暂不做 |

---

## 二、参考项目核心机制（必读）

### 2.1 状态机（5 状态 FSM）

```
working ─(倒计时≤0)─→ onWorkDone
                        ├─ breakConfirm=true  → alerting ─(用户确认)─→ breaking
                        └─ breakConfirm=false → breaking（直接进入）

breaking ─(倒计时≤0)─→ waiting ─(用户确认)─→ working（新一轮）

任意阶段 ─→ paused（手动暂停 / 静音触发）
paused   ─→ working/breaking（用户恢复 / 静音结束）
```

### 2.2 关键设计要点

- **targetTime 绝对时间机制**：working 阶段用 `targetTime = now + duration`，每秒 tick 时重算 `remaining = max(0, targetTime - now)`，避免系统休眠/时钟跳变累积漂移
- **breakConfirm 字段**：决定 alerting 阶段是否被跳过（false 时直接进入 breaking）
- **completedCycles 后置递增**：在 onBreakDone 中递增，长休息判定读取「本次休息前已完成轮数」，第一次休息永不长休息
- **长休息判定**：`longBreakEnabled && interval > 0 && completedCycles > 0 && completedCycles % interval == 0`
- **跳过机制**：需连点 3 次「跳过」按钮才生效（`breakSkipCount >= 3`），跳过不计入 completedCycles
- **静音时段**：每秒检查 quietHours，命中则强制进入 paused（任何阶段都会被打断），静音结束后开始新一轮工作（不恢复原进度）
- **不使用系统通知**：仅靠托盘图标 + 面板（本项目暂不做声音）

### 2.3 配置字段清单

| 业务含义 | 参考项目 key | 当前项目 key | 默认值 | 状态 |
|---------|-------------|-------------|--------|---------|
| 工作时长（分钟） | `work_minutes` | `work_duration` | 30 | ✅ UI+存储+消费 |
| 休息时长（分钟） | `break_seconds`（秒） | `break_duration`（分钟） | 1 | ✅ UI+存储+消费 |
| 长休息开关 | `long_break_enabled` | `long_break_enabled` | N | ✅ UI+存储+消费 |
| 长休息间隔（轮） | `long_break_interval` | `long_break_interval` | 2 | ✅ UI+存储+消费 |
| 长休息时长（分钟） | `long_break_seconds`（秒） | `long_break_duration`（分钟） | 5 | ✅ UI+存储+消费 |
| 静音时段 | `quiet_hours` (JSON) | `quiet_hours` (JSON) | `[{12:00-14:00},{18:00-19:00}]` | ✅ UI+存储+消费 |
| 休息窗口模式 | `break_position` | `rest_window` | `tray` | ✅ UI+存储（仅 tray 生效） |
| 休息前确认 | `break_confirm` | `rest_confirm` | Y | ✅ UI+存储+消费 |
| 提醒文案列表 | `reminders` (JSON) | `reminders` (JSON) | `[]` | ✅ UI+存储+消费 |
| 每日目标 | `daily_goal` | `daily_goal` | 10 | ⚠️ UI+存储有，**不实现消费**（K3 将隐藏 UI） |

> **注意**：当前项目用分钟存储（`work_duration`/`break_duration`），参考项目用秒；后端读取时按当前项目的分钟单位处理。

---

## 三、原子功能点清单

### 进度总览

| 域 | 关注点 | 点数 | ✅ 已完成 | ❌ 待实施 |
|----|--------|-----:|--------:|--------:|
| A | 后端状态机基础设施 | 8 | 8 | 0 |
| B | 工作→休息 核心转移 | 9 | 9 | 0 |
| C | 长休息机制 | 4 | 4 | 0 |
| D | 暂停/恢复/重置/立即休息/跳过 | 5 | 5 | 0 |
| E | 静音时段 quietHours | 4 | 4 | 0 |
| F | config-changed 订阅 | 2 | 2 | 0 |
| G | 托盘图标状态切换 | 3 | 3 | 0 |
| H | panel 窗口管理 | 5 | 5 | 0 |
| I | panel 失焦行为 | 3 | 3 | 0 |
| J | panel UI 多状态重构 | 8 | 8 | 0 |
| K | i18n 与配置收尾 | 5 | 0 | 5 |
| L | 状态持久化 | 1 | 1 | 0 |
| M | 端到端验证清单 | 10 | 0 | 10 |
| **合计** | | **67** | **52** | **15** |

> ⚠️ 可优化标注共 3 处（见 F、I、L 域），非阻塞，留作后续可选任务。

### 域间依赖

```
A（状态机基础）─┬─→ B（核心转移）─┬─→ G（托盘图标）
                │                  ├─→ H4/H5（panel 唤起）
                ├─→ C（长休息）    ├─→ I（失焦行为）
                ├─→ D（控制命令）  └─→ J（panel UI）─→ K（i18n 收尾）
                ├─→ E（静音）
                └─→ F（config 订阅）
                                                        ↓
                                              M（端到端验证）
```

---

### 域 A · 后端状态机基础设施（8 点，全 ✅）

#### A1 · Phase 枚举与 TimerState 结构 ✅
**开发任务**：
- [x] `src-tauri/src/timer.rs` 定义 `Phase` 枚举（Working/Alerting/Breaking/Waiting/Paused，`#[serde(rename_all = "lowercase")]`）
- [x] 定义 `TimerInner` 结构（`app.manage` 注册，内部 `Arc<Mutex<TimerInner>>` 保护）
- [x] 字段：`phase` / `target_epoch` / `remaining_seconds` / `total_seconds` / `paused_phase` / `completed_cycles` / `break_skip_count` / `current_reminder` / `is_long_break` / `save_date` / `paused_by_quiet`

**验证**：应用启动无 panic；`timer-tick` 事件 payload 含上述全部字段（前端 console 可见）。

#### A2 · 1Hz tokio interval 定时循环 ✅
**开发任务**：
- [x] `timer.rs` 的 `init` 中 `tauri::async_runtime::spawn` 启动 `tokio::time::interval` 1Hz 循环
- [x] 循环内加锁 `TimerInner`，按当前 phase 推进状态（working 重算 remaining / breaking 递减 / 跨天检查 / 静音检查）

**验证**：应用运行时每秒 emit 一次 `timer-tick`（前端 `listen` 计数 = 每秒 +1）。

#### A3 · timer-tick 事件每秒 emit ✅
**开发任务**：
- [x] `emit_timer_tick(app, payload)`：每秒 emit `"timer-tick"`，payload 为 `TimerStatePayload`，其中 `prev_phase = None`

**验证**：前端 `listen("timer-tick")` 每秒收到事件，payload.prevPhase === null。

#### A4 · phase-changed 事件（切换时 emit）✅
**开发任务**：
- [x] `emit_phase_changed(app, payload)`：phase 变化时 emit `"phase-changed"`，payload 的 `prev_phase = Some(旧 phase)`
- [x] 所有 phase 切换点（run_timer_loop 跨天/静音/归零分支 + 7 个 command）均调用

**验证**：触发任意 phase 切换（如倒计时归零），前端 `listen("phase-changed")` 收到事件且 prevPhase 为切换前的 phase。

#### A5 · get_timer_state command ✅
**开发任务**：
- [x] `#[command] get_timer_state(app) -> TimerStatePayload`：返回当前完整状态（前端初始化拉取用）
- [x] 在 `lib.rs` invoke_handler 注册

**验证**：前端 `invoke("get_timer_state")` 返回含 phase/remainingSeconds/totalSeconds 等字段的对象。

#### A6 · working 阶段 targetTime 绝对时间机制 ✅
**开发任务**：
- [x] 进入 Working 时设 `target_epoch = now + work_duration * 60`
- [x] 每秒 tick 重算 `remaining_seconds = max(0, target_epoch - now)`，防系统休眠/时钟跳变累积漂移

**验证**：work_duration=1，启动后让系统休眠 30 秒再唤醒，remaining 仍按墙钟推进（不会多扣或少扣）。

#### A7 · save_date 跨天检测 + fresh_working 重置 ✅
**开发任务**：
- [x] `TimerInner.save_date` 存本地时区 yyyy-MM-dd
- [x] 1Hz tick 中检测 `save_date != today` → fresh_working 重置（清 cycles/skip_count，start_work，更新 save_date）

**验证**：修改系统时间到次日，下一秒 tick 触发状态重置为全新 Working（completedCycles=0）。

#### A8 · timer 模块注册与启动 ✅
**开发任务**：
- [x] `lib.rs` setup 中调用 `timer::init(app)?`
- [x] invoke_handler 注册全部 timer command

**验证**：应用启动后后端日志无 error；前端可调用所有 timer command。

---

### 域 B · 工作→休息 核心转移（9 点，全 ✅）

#### B1 · working 倒计时归零触发 on_work_done ✅
**开发任务**：
- [x] run_timer_loop 中检测 `phase == Working && remaining_seconds == 0` → 调用 `apply_on_work_done`

**验证**：work_duration=1，1 分钟后 phase 从 working 跳到 alerting 或 breaking。

#### B2 · on_work_done 随机抽取 reminder ✅
**开发任务**：
- [x] `pick_random_reminder(conn)`：读 `reminders` JSON 数组，随机抽一条写入 `current_reminder`；列表空时用兜底文案

**验证**：配置 reminders=["喝水","站立"]，多次触发 on_work_done，currentReminder 在两条间随机分布。

#### B3 · on_work_done 读 rest_confirm 分流 ✅
**开发任务**：
- [x] 读 `rest_confirm`：`=Y` → phase=Alerting；`=N` → 直接 `apply_start_break`
- [x] 进入 Alerting/Breaking 均触发 B4 的 show-panel

**验证**：rest_confirm=Y 时归零进入 alerting；=N 时归零直接进入 breaking（跳过 alerting）。

#### B4 · 进入 Alerting/Breaking 时 emit show-panel ✅
**开发任务**：
- [x] `emit_show_panel(app)`：emit `"show-panel"` 事件（payload 为 unit）
- [x] 调用点：run_timer_loop 的 working 归零分支、`confirm_break`、`manual_break`

**验证**：前端 `listen("show-panel")` 在进入 alerting/breaking 瞬间收到事件（H5 落地后表现为 panel 自动弹出）。

#### B5 · confirm_break command（Alerting→Breaking）✅
**开发任务**：
- [x] `#[command] confirm_break(app)`：Alerting → `apply_start_break`，emit phase-changed + show-panel
- [x] invoke_handler 注册

**验证**：alerting 阶段前端 `invoke("confirm_break")` 后 phase 变 breaking。

#### B6 · start_break 内部函数 ✅
**开发任务**：
- [x] `apply_start_break`：判长休息（见 C1/C2）→ phase=Breaking，设 remaining = isLongBreak ? long_break_duration : break_duration（分钟→秒）
- [x] breakSkipCount 清零（见 D5）；emit phase-changed + show-panel

**验证**：进入 breaking 时 remainingSeconds 等于配置的 break_duration*60（或长休息时长）。

#### B7 · breaking 倒计时归零 → on_break_done → Waiting ✅
**开发任务**：
- [x] run_timer_loop 中检测 `phase == Breaking && remaining_seconds == 0` → `apply_on_break_done`：递增 completed_cycles（见 C3），phase=Waiting，emit phase-changed

**验证**：break_duration=1，休息 1 分钟后 phase 变 waiting，completedCycles +1。

#### B8 · confirm_return command（Waiting→新一轮 Working）✅
**开发任务**：
- [x] `#[command] confirm_return(app)`：Waiting → `apply_start_work`（新一轮）
- [x] invoke_handler 注册

**验证**：waiting 阶段前端 `invoke("confirm_return")` 后 phase 变 working，开始新一轮倒计时。

#### B9 · start_work command ✅
**开发任务**：
- [x] `apply_start_work`：phase=Working，读 work_duration，设 target_epoch/total_seconds/remaining_seconds，emit phase-changed
- [x] `#[command] start_work` 暴露给前端（手动启动）
- [x] invoke_handler 注册

**验证**：前端 `invoke("start_work")` 后 phase 变 working，remainingSeconds = work_duration*60。

---

### 域 C · 长休息机制（4 点，全 ✅）

#### C1 · 长休息判定 check_is_long_break ✅
**开发任务**：
- [x] `check_is_long_break(enabled, interval, completed_cycles) -> bool`：`enabled && interval > 0 && completed_cycles > 0 && completed_cycles % interval == 0`

**验证**：interval=2，completedCycles=0→false、=2→true、=3→false、=4→true。

#### C2 · start_break 按 isLongBreak 选时长 ✅
**开发任务**：
- [x] `apply_start_break` 调用 check_is_long_break，结果写入 `is_long_break`
- [x] remaining = isLongBreak ? `long_break_duration` : `break_duration`（分钟→秒）

**验证**：interval=2，完成 2 轮后第 3 次休息 remainingSeconds = long_break_duration*60。

#### C3 · completed_cycles 后置递增（仅正常完成）✅
**开发任务**：
- [x] `apply_on_break_done` 中 `completed_cycles += 1`
- [x] `skip_break`（D4）**不**递增

**验证**：连续 2 次正常完成休息 → cycles=2；中途跳过休息 → cycles 不变。

#### C4 · timer-tick payload 带 isLongBreak 字段 ✅
**开发任务**：
- [x] `TimerStatePayload.is_long_break` 字段，serde camelCase 输出 `isLongBreak`

**验证**：长休息期间 timer-tick payload.isLongBreak === true。

---

### 域 D · 暂停/恢复/重置/立即休息/跳过（5 点，全 ✅）

#### D1 · toggle_pause command ✅
**开发任务**：
- [x] Working/Breaking ↔ Paused：进入时保存原 phase 到 `paused_phase`；恢复时按原 phase 重设（working 重设 target_epoch，breaking 直接递减）
- [x] `#[command] toggle_pause` + invoke_handler 注册

**验证**：working 中 `invoke("toggle_pause")` → phase=paused；再调一次 → 回 working，remaining 接续。

#### D2 · reset command ✅
**开发任务**：
- [x] `#[command] reset`：清 cycles/skip_count/paused_phase → `apply_start_work`

**验证**：`invoke("reset")` 后 phase=working，completedCycles=0，remainingSeconds 重置为满。

#### D3 · manual_break command ✅
**开发任务**：
- [x] `#[command] manual_break`：Working → 直接 `apply_start_break`（用户主动「立即休息」），emit show-panel

**验证**：working 中 `invoke("manual_break")` 后 phase 直接变 breaking。

#### D4 · skip_break command ✅
**开发任务**：
- [x] `#[command] skip_break`：`break_skip_count += 1`；若 `>= 3` 则强制 `apply_start_work`（**不**递增 completed_cycles），emit phase-changed
- [x] 未达 3 次时仅 emit timer-tick（让前端更新「跳过 (n/3)」按钮）

**验证**：breaking 中连点 3 次 `invoke("skip_break")` 后 phase 变 working，completedCycles 不变。

#### D5 · 进入 Breaking 时 breakSkipCount 清零 ✅
**开发任务**：
- [x] `apply_start_break` 中 `break_skip_count = 0`

**验证**：跳过 2 次后正常进入下一轮 breaking，breakSkipCount 归零（按钮显示「跳过 (0/3)」）。

---

### 域 E · 静音时段 quietHours（4 点，全 ✅）

#### E1 · read_quiet_hours 配置解析 ✅
**开发任务**：
- [x] `read_quiet_hours(conn) -> Vec<(String, String)>`：解析 `quiet_hours` JSON 数组 `[{start, end}]`（schema 与前端 `QuietHourPeriod` 一致）
- [x] 容错：JSON 解析失败 → 空 vec（视为无静音时段）

**验证**：配置 quiet_hours=[{12:00,14:00}]，后端返回 vec 长度 1；配置非法 JSON，返回空 vec 不 panic。

#### E2 · is_in_quiet_periods 命中判断 ✅
**开发任务**：
- [x] `is_in_quiet_periods(periods, hhmm) -> bool`
- [x] 同日时段（start ≤ end）：`[start, end)`
- [x] 跨午夜时段（start > end，如 22:00-06:00）：`[start, 24:00) ∪ [00:00, end)`

**验证**：22:00-06:00 时段，21:59→false、23:00→true、05:59→true、06:00→false。

#### E3 · tick 每秒检查 + 命中/退出处理 ✅
**开发任务**：
- [x] 1Hz tick 内调用 read_quiet_hours + is_in_quiet_periods（开销可忽略，进入/退出延迟最多 1 秒）
- [x] 命中（任意非 Paused 阶段）→ `apply_enter_quiet_paused`：强制 Paused，保存原 phase 到 paused_phase，`paused_by_quiet=true`，emit phase-changed（payload quietTriggered=true）
- [x] 退出（`!in_quiet && phase==Paused && paused_by_quiet==true`）→ `apply_start_work`（**开始新一轮**，不恢复原进度）

**验证**：配置 quietHours=[{12:00-14:00}]，12:00 正在 working → 自动 paused；14:01 → 自动开始新一轮 working。

#### E4 · paused_by_quiet 区分 + 静音期间 toggle_pause 忽略 ✅
**开发任务**：
- [x] `paused_by_quiet` 标志区分「静音触发」与「用户手动暂停」
- [x] `apply_resume` 检测 `paused_by_quiet == true` 返回 false（静音期间用户手动「继续」无效，必须等静音结束）
- [x] 用户手动暂停（paused_by_quiet=false）静音结束时无操作（等用户点继续）

**验证**：静音 paused 时 `invoke("toggle_pause")` 无效（phase 不变）；手动 paused 时静音结束不影响。

---

### 域 F · config-changed 订阅（2 点 ✅ + 1 ⚠️）

#### F1 · 订阅 config-changed 事件 ✅
**开发任务**：
- [x] `timer::init` 中 `app.handle().listen("config-changed", move |event| { on_config_changed(...) })`
- [x] handler 内 match key 决定是否重算

**验证**：settings 页改任意配置，后端 on_config_changed 被触发（日志可见）。

#### F2 · work_duration 变更实时重算 ✅
**开发任务**：
- [x] handler 检测 key == `work_duration` && 当前 phase == Working
- [x] 重算 `target_epoch` / `total_seconds` / `remaining_seconds`，立即 emit timer-tick（前端立刻看到新剩余时间）

**验证**：working 中改 work_duration 从 30 → 1，panel 剩余时间立即变为 1 分钟。

> ⚠️ **可优化（有意设计，非缺陷）**：`break_duration` / `long_break_*` / `rest_confirm` / `quiet_hours` 变更**无实时响应**——这些值仅在 phase 切换瞬间读取，无需订阅重算。文档需显式声明此约定，避免误判为 bug。

---

### 域 G · 托盘图标状态切换（3 点，全 ✅）

#### G1 · 新增 5 张 phase 托盘图标资源 ✅
**开发任务**：
- [x] 新增 `src-tauri/icons/tray/` 目录
- [x] 准备 5 张 PNG：`working.png`（绿）/ `alerting.png`（橙）/ `breaking.png`（橙/茶）/ `waiting.png`（红）/ `paused.png`（灰），尺寸建议 32x32 或 64x64
  - 实施说明：64x64 RGBA，沿用应用主图标设计语言（圆角矩形 + Bootstrap Icons `lightning-fill`）
  - 颜色映射：working 绿底 `#34D399` + 黄闪电 `#FBBF24`（与主图标一致）/ alerting 橙底 `#F59E0B` + 白闪电 / breaking 深茶底 `#B45309` + 白闪电 / waiting 红底 `#EF4444` + 白闪电 / paused 灰底 `#9CA3AF` + 白闪电
  - 同时保留 5 份 SVG 源文件（`working.svg` 等）以便后续调色

**验证**：`ls src-tauri/icons/tray/` 看到 5 个文件。

#### G2 · set_tray_icon_by_phase + 订阅 phase-changed ✅
**开发任务**：
- [x] `src-tauri/src/panel.rs` 新增 `pub fn set_tray_icon_by_phase(app: &AppHandle, phase: Phase)`
- [x] 内部 `match phase` 选 `include_bytes!("../icons/tray/xxx.png")`，`app.tray_by_id("tray").set_icon(Some(Image::from_bytes(...)))`
- [x] `panel.rs` setup 末尾 `app.handle().listen("phase-changed", ...)`：反序列化 payload 取 phase，调用 set_tray_icon_by_phase
- [x] `panel.rs` 引入 `use crate::timer::Phase`

**验证**：配置 work_duration=1，1 分钟后托盘图标从绿色变为橙色（alerting）；确认后变 breaking 色。

#### G3 · 应用启动时按初始 Working 设置托盘图标 ✅
**开发任务**：
- [x] `panel.rs` setup 中托盘创建后，立即调用 `set_tray_icon_by_phase(app, Phase::Working)`（因重启即 fresh_working，初始恒为 Working）

**验证**：启动应用，托盘立即显示绿色 working 图标（非默认 32x32.png）。

---

### 域 H · panel 窗口管理（5 点，全 ✅）

#### H1 · 托盘点击 toggle panel ✅
**开发任务**：
- [x] `src-tauri/src/panel.rs` setup 中 TrayIconBuilder `.on_tray_icon_event` 处理左键单击
- [x] panel 存在且 visible → hide；存在且隐藏 → position+show+set_focus；不存在 → create_panel

**验证**：点托盘左键，panel 显示；再点，隐藏。

#### H2 · panel 智能定位 ✅
**开发任务**：
- [x] `position_panel(tray, panel)`：根据 tray.rect() 算 panel 位置
- [x] `detect_taskbar_edge` 判断任务栏上下左右边，`compute_panel_position` 四边自适应

**验证**：任务栏在底部时 panel 出现在托盘正上方；任务栏在左侧时 panel 出现在托盘右侧。

#### H3 · fit_panel command ✅
**开发任务**：
- [x] `#[command] fit_panel(app, height)`：前端 mount 后调用，按内容高度调整窗口
- [x] invoke_handler 注册

**验证**：panel 内容变多时窗口高度自适应（无大面积留白或裁切）。

#### H4 · show_panel 内部函数 ✅
**开发任务**：
- [x] `src-tauri/src/panel.rs` 新增 `pub fn show_panel(app: &AppHandle)`
- [x] panel 不存在 → `create_panel`；存在 → `position_panel` + `show` + `set_focus`
- [x] 抽取自 H1 的 else 分支，避免重复

**验证**：后端任意位置调用 `panel::show_panel(app)`，panel 立即弹出并获得焦点。

#### H5 · 订阅 show-panel 事件 ✅
**开发任务**：
- [x] `panel.rs` setup 末尾 `app.handle().listen("show-panel", move |_| { show_panel(&app_handle) })`
- [x] 闭包持有 `app_handle: AppHandle`（Clone + Send + Sync）

**验证**：work_duration=1 且 rest_confirm=Y，1 分钟后 panel 自动弹出（无需点托盘）。

---

### 域 I · panel 失焦行为（3 点，全 ✅）

#### I1 · 前端记录当前 phase 到 ref ✅
**开发任务**：
- [x] `src/windows/panel/PanelApp.tsx` 新增 `phaseRef`（避免闭包陷阱，回调里读最新值）
- [x] `useEffect` 中 `listen<TimerStatePayload>("phase-changed", e => { phaseRef.current = e.payload.phase })`
- [x] cleanup 用 `unlistenPromise.then(fn => fn())`（沿用现有 config-changed 模式）

**验证**：phase 切换时 phaseRef.current 更新（开发模式 console.log 可见）。

#### I2 · Alerting 阶段失焦不隐藏 panel ✅
**开发任务**：
- [x] `PanelApp.tsx` 的 `onFocusChanged` 回调改为：`if (!focused && !hidingRef.current && phaseRef.current !== "alerting") { currentWin.hide() }`

**验证**：alerting 阶段点击 panel 外部，panel 不隐藏（强制用户确认）。

#### I3 · 其他阶段失焦允许隐藏 ✅
**开发任务**：
- [x] 当前 `onFocusChanged` 回调：任意失焦（除 hidingRef）即 hide
- [x] I2 落地后细化为「除 alerting 外都 hide」——Working/Breaking/Waiting/Paused 失焦即隐，后端继续计时

**验证**：breaking 阶段点击 panel 外部，panel 隐藏，但倒计时在后端继续，托盘图标显示「休息中」。

> ⚠️ **可优化**：现有 `hidingRef` hack（点「设置」按钮时手动置 true 抑制 hide）可在 I2 后用 phase-aware 逻辑统一——例如打开 settings 时临时切到一个「不可隐藏」态，或改为失焦不隐藏 + 由 settings 窗口主动管理焦点。

---

### 域 J · panel UI 多状态重构（8 点，全 ✅）

#### J1 · useTimerState hook（替换硬编码倒计时）✅
**开发任务**：
- [x] 新增 `src/windows/panel/hooks/useTimerState.ts`（旧 `useTimer.ts` 已删除）
- [x] 挂载时 `commands.getTimerState()` 拉取初始状态
- [x] `listen("timer-tick")` 每秒更新 remainingSeconds / phase 等字段
- [x] `listen("phase-changed")` 切换 UI 分支（与 timer-tick 共用 setState handler）
- [x] **移除**原 `setInterval` 本地倒计时与 `INITIAL_SECONDS = 30 * 60` 硬编码

**验证**：panel 显示的剩余时间与后端 work_duration 配置一致（30 分钟），每秒递减。

#### J2 · CountdownRing 按 phase 着色 ✅
**开发任务**：
- [x] `src/windows/panel/components/CountdownRing.tsx` 新增 `phase` prop（同时删除语义模糊的 `isExpired` prop）
- [x] 颜色映射：Working 绿 / Alerting 橙 / Breaking 深茶 / Waiting 红 / Paused 灰（与 G1 托盘统一，light/dark 双主题色值）；色表抽到 `src/windows/panel/phaseColors.ts` 供 J3-J7 复用

**验证**：不同 phase 下圆环颜色肉眼可区分。

#### J3 · Working 视图 ✅
> **实施说明**：working 阶段 `currentReminder` 通常为空字符串（后端仅在 `on_work_done` 时设置），按用户决策**隐藏提醒行**，UI 仅保留圆环 + 「工作中」标签 + 3 按钮；如后续需要展示提醒再单独迭代。

**开发任务**：
- [x] 新增 `src/windows/panel/components/WorkingView.tsx`：圆环倒计时（绿）+ 中央 MM:SS + 「工作中」标签（圆环下方）+ 3 按钮
- [x] 按钮：暂停 → `toggle_pause` / 立即休息 → `manual_break` / 设置 → `show_settings_window`

**验证**：working 阶段 panel 显示绿色圆环倒计时 + 「工作中」标签 + 3 个按钮（暂停/立即休息/设置）。

#### J4 · Alerting 视图 ✅
> **实施说明**：布局为「铃铛图标 + alertTitle 标题 + currentReminder 大字 + 单个主按钮」，按钮集仅「开始休息」（alerting 是强制确认阶段，panel 不可关闭、不提供设置入口，推动用户尽快进入 breaking）；currentReminder 信任后端 `pick_random_reminder` 兜底，前端不再加额外空值兼容。

**开发任务**：
- [x] 新增 `src/windows/panel/components/AlertingView.tsx`：NotificationsActive 图标（橙）+ 「该休息啦」标题 + 大字体 currentReminder + 「开始休息」主按钮
- [x] 主按钮「开始休息」→ `confirm_break`（useTimerState 新增 `confirmBreak` 回调暴露）

**验证**：alerting 阶段 panel 显示提醒文案 + 「开始休息」按钮，点击后进 breaking。

#### J5 · Breaking 视图 ✅
> **实施说明**：按钮集仅「跳过 (n/3)」（breaking 是休息进行中，主操作是提前结束）；跳过按钮用 IconButton + caption 风格（与 WorkingView 一致，非 contained 主按钮）；长休息（`isLongBreak=true`）**仅切换标签文案**（`phaseBreaking`「休息中」→ `longBreakLabel`「长休息中」），其他视觉无差异；currentReminder 用条件渲染（`{reminder && (...)}`）防御空值留白。

**开发任务**：
- [x] 新增 `src/windows/panel/components/BreakingView.tsx`：橙色圆环 + 「休息中」/「长休息中」标签 + currentReminder 提醒文案（斜体弱化）+「跳过 (n/3)」IconButton
- [x] 「跳过 (n/3)」按钮 → `skip_break`，n 由 hook 已暴露的 `breakSkipCount` 提供；caption 文案 `${t('action.skipBreak')} (${breakSkipCount}/3)` 前端拼装

**验证**：breaking 阶段显示橙色圆环 + 「跳过 (0/3)」按钮；长休息时标签为「长休息中」。

#### J6 · Waiting 视图 ✅
> **实施说明**：
> - 文档「绿色对勾」**与 PHASE_RING_COLORS.waiting（红色）不一致**——绿色取自 MUI `success.main`（成功/完成语义），不沿用 phase 色，正向反馈优先于色表统一
> - 文案「休息结束啦！准备好继续工作了吗？」**拆为 title + subtitle 两个 i18n key**（`waitingTitle` + `waitingSubtitle`），替代 K1 提议的单 `breakOverPrompt`，与 `alertTitle` 命名风格对称；K1 实施时仅补 phaseWaiting 等剩余 key
> - 按钮集仅「我回来了」（waiting 是确认阶段，推动用户尽快进入新一轮 working）

**开发任务**：
- [x] 新增 `src/windows/panel/components/WaitingView.tsx`：CheckCircle 图标（success 绿）+ 「休息结束啦！」标题 + 「准备好继续工作了吗？」副标题 + 「我回来了」主按钮
- [x] 主按钮「我回来了」→ `confirm_return`（useTimerState 新增 `confirmReturn` 回调暴露）

**验证**：waiting 阶段显示绿色对勾 + 「我回来了」按钮，点击后进新一轮 working。

#### J7 · Paused 视图 ✅
> **实施说明**：
> - 与 E4 后端逻辑一致：`quietTriggered=true` 时「继续」按钮**禁用**（后端 toggle_pause 本就返回 false），副标题提示「休息时段结束后自动恢复」；手动暂停（quietTriggered=false）按钮可用，显示「已暂停」+ 剩余时间
> - **术语调整**：中文文案 quietHours 一律用「休息」（与 settings 现有「休息时段」对齐），**禁用「静音」**（用户反馈有歧义，详见 [memory: terminology-quiet-hours-zh]）；英文保留 "Quiet Hours"
> - K1 提议的 `tapToContinue`「点击继续」**不采用**——J7 设计是禁用按钮（与 E4 一致），用 `pausedAutoResumeHint`「休息时段结束后自动恢复」替代
> - **始终展示剩余时间**（手动暂停显示原进度，休息时段触发显示进入前的剩余，仅供参考）
> - PanelApp 改为显式六分支（working/alerting/breaking/waiting/paused 全判断 + 兜底「未识别 phase: {phase}」防御未来新增 phase），原 ActionButtons + CountdownRing 在 panel 中不再被引用（CountdownRing 仍被 WorkingView/BreakingView 复用；ActionButtons 文件保留待 J8 重构决定）

**开发任务**：
- [x] 新增 `src/windows/panel/components/PausedView.tsx`：PauseCircleFilled 图标（灰）+ 标题（已暂停/休息时段中）+ 剩余时间 + 副标题（仅 quietTriggered）+ 「继续」主按钮（quietTriggered 时禁用）
- [x] 主按钮「继续」→ `toggle_pause`，`disabled={quietTriggered}` 与 E4 后端一致
- [x] quietTriggered 分支：标题切换为「休息时段中」+ 副标题「休息时段结束后自动恢复」

**验证**：paused 阶段显示灰色暂停图标 + 「继续」按钮；休息时段 paused（quietTriggered）显示「休息时段中」+ 禁用按钮 + 自动恢复提示。

#### J8 · ActionButtons 按 phase 切换按钮集 ✅
> **实施说明**：J3-J7 已将按钮**内联到各 View 组件**（WorkingView 3 按钮 / BreakingView 1 按钮 / AlertingView·WaitingView·PausedView 各 1 主按钮），`PanelApp.tsx` 改为显式六分支后**不再引用** `ActionButtons`。J8 实际工作收敛为**删除孤儿文件**——不重写为 phase 切换器（与 J3-J7 设计方向相反），也不抽公共 `ActionButton` 原子组件（WorkingView 与 BreakingView 按钮集语义不同，4 处重复的「IconButton+caption」模式不值得引入抽象，符合 CLAUDE.md「3 行相似胜过过早抽象」）。i18n key `panel:action.reset` / `resetTimerAria` 已随之成为孤儿，归属 K1 一并清理。

**开发任务**：
- [x] 删除 `src/windows/panel/components/ActionButtons.tsx`（J3-J7 已内联按钮，无功能损失）

**验证**：`grep -rn "ActionButtons" src/` 仅剩 0 命中；panel 各 phase 下按钮集与 J3-J7 一致（working: 暂停/立即休息/设置；breaking: 跳过(n/3)；alerting: 开始休息；waiting: 我回来了；paused: 继续）。

---

### 域 K · i18n 与配置收尾（5 点，全 ❌）

#### K1 · panel i18n 文案补充（中/英）❌
**开发任务**：
- [ ] `src/shared/i18n/locales/zh-CN/panel.json` 与 `en/panel.json` 补充：
  - phase 标签：`phaseWorking` / `phaseAlerting` / `phaseBreaking` / `phaseWaiting` / `phasePaused`
  - 长休息：`longBreakLabel`
  - 按钮：`startBreak` / `imBack` / `skipBreak` / `resume` / `pause` / `manualBreak` / `reset`
  - 提醒：`alertTitle` / `breakOverPrompt`
  - 静音：`quietHoursActive` / `tapToContinue`

**验证**：中英文切换，panel 所有文案正确显示（无 key 裸露）。

#### K2 · RestPage 隐藏不支持的模式选项 ❌
**开发任务**：
- [ ] `src/settings/components/RestPage.tsx` 的 `rest_window` Select：仅保留 `tray` 选项
- [ ] 移除 topRight/fullscreen，或保留但禁用并标注「暂不支持」

**验证**：RestPage 休息窗口模式选项只剩 tray。

#### K3 · PlanPage 隐藏 daily_goal ❌
**开发任务**：
- [ ] `src/settings/components/PlanPage.tsx` 移除或隐藏「每日目标」（dailyGoal）相关 UI（本项目不实现打卡统计）

**验证**：PlanPage 不再显示每日目标输入框。

#### K4 · 后端读配置缺值回退默认 ❌
**开发任务**：
- [ ] `src-tauri/src/config.rs` 的 `get_config` 在 DB 无值时回退到默认值（防 panic）
- [ ] 或各读取点（timer.rs）显式处理 None → 默认值

**验证**：删除 DB 中某 key（或首次启动空库），后端读取不 panic，行为用默认值。

#### K5 · 确认 config.ts 默认值与后端一致 ❌
**开发任务**：
- [ ] 检查 `src/shared/config.ts` 各 key 的 DEFAULT 与后端读取逻辑一致
- [ ] 后端 timer.rs 常量副本（行 3-5）与 config.ts 同步

**验证**：前后端默认值逐项对照表无差异。

---

### 域 L · 状态持久化（1 点 ✅ + 1 ⚠️）

#### L1 · 重启即重置（fresh_working）✅
**开发任务**：
- [x] `timer::init` 中直接构造新 Working 状态，不读历史 timer_* key
- [x] 仅保留运行时 save_date 跨天判断（A7）

**验证**：working 中关闭应用重启，phase=working、remainingSeconds=满（不恢复上次进度）。

> ⚠️ **可优化（留待评估）**：完整崩溃恢复——新增 `timer_phase` / `timer_paused_remaining` / `timer_save_date` / `timer_completed_cycles` 4 个配置 key，每次 phase 切换保存，应用启动时恢复（跨天清空）。参考项目本就允许此选项；本项目定位为健康提醒工具，重启重置对体验影响极小，是否补做留待域 M 验证阶段决定。

---

### 域 M · 端到端验证清单（10 项，全 ❌）

> 这些是验证项（非新功能），每个对应一个可观测的端到端场景。建议在 G-K 实施完成后逐项手动跑通。

- [ ] **M1** 完整工作-休息循环：配置 work=1 分钟、break=1 分钟，验证 working → alerting → breaking → waiting → working 全流程
- [ ] **M2** restConfirm Y/N 两种模式：Y 时经过 alerting；N 时跳过 alerting 直接 breaking
- [ ] **M3** 长休息触发：interval=2，连续完成 2 次休息，第 3 次为长休息；中途跳过休息，completedCycles 不递增
- [ ] **M4** quietHours：配置当前时刻所在时段，验证自动 paused；等时段结束，验证自动恢复新一轮 working
- [ ] **M5** 跨午夜 quietHours：配置如 22:00-06:00，验证 23:00 命中、06:00 退出
- [ ] **M6** 跨天处理：修改系统时间到次日，验证状态重置为全新 working（cycles 清零）
- [ ] **M7** config-changed 实时重算：working 中改 work_duration，验证倒计时按新值重启
- [ ] **M8** 多窗口同步：settings 修改配置，验证正在进行的 timer 与 panel 实时响应
- [ ] **M9** 托盘交互：各 phase 下托盘图标正确切换；alerting 阶段点击外部 panel 不隐藏
- [ ] **M10** 无内存泄漏：定时器无重复启动；长时间运行无 panic / 无未处理事件

---

## 四、暂不实现清单（明确排除）

| 功能 | 原因 |
|------|------|
| 打卡/统计/成就/徽章 | 用户明确排除（与健康提醒无关） |
| 节假日同步（holidayCalendar） | 用户明确排除 |
| 工作时间窗口 + 工作日（workDays/workHours） | 范围外 |
| 声音提示（系统声音） | 范围外 |
| 休息期间活动检测（idle 检测） | 简化处理 |
| 浮动窗口/全屏覆盖层（topRight/topLeft/center/fullscreen） | 仅支持 tray 模式 |
| 护眼模式（eyeCareMode，20-20-20） | 不在范围 |
| 全局快捷键（shortcut） | 不在范围 |
| 多屏支持（breakDisplayTarget） | 仅 tray 模式无需 |
| 数据导出 | 与健康提醒无关 |
| 自动检查更新 | 与健康提醒无关 |
| 每日目标 + autoPauseOnGoal | 依赖打卡统计，本项目不做 |

---

## 五、关键技术参考

### 5.1 参考项目核心文件（实现时查阅）

| 文件 | 用途 |
|------|------|
| `health-tick-release/Sources/AppState.swift` | 状态机所有逻辑、配置字段定义、targetTime 机制 |
| `health-tick-release/Sources/BreakOverlay.swift` | 休息 UI（BreakCardView 各 phase 子视图） |
| `health-tick-release/Sources/MenuView.swift` | 托盘面板 UI 分支（isBreakPhase 判定） |
| `health-tick-release/Sources/Strings.swift` | 所有文案 key 中英文对照 |
| `health-tick-release/Tests/test_long_break.swift` | 长休息规则的权威测试用例 |

### 5.2 当前项目必读文件

| 文件 | 用途 |
|------|------|
| `src/shared/config.ts` | 配置契约中心（所有 key、默认值、编解码），SSOT |
| `src-tauri/src/lib.rs` | Tauri Builder 入口（注册 command、setup） |
| `src-tauri/src/panel.rs` | 托盘 + panel 窗口管理（域 G/H 主战场） |
| `src-tauri/src/timer.rs` | 状态机核心（域 A-F 已完成主体） |
| `src-tauri/src/config.rs` | 配置存储 + config-changed 事件 |
| `src/windows/panel/PanelApp.tsx` | panel 根组件（域 I/J 主战场） |
| `src/windows/panel/hooks/useTimerState.ts` | 当前定时器（域 J1 已落地，订阅 timer-tick / phase-changed） |
| `src/settings/components/PlanPage.tsx` | 设置页表单模式范本（域 K3） |

### 5.3 Tauri 2 关键 API

- 启动定时器：`tauri::async_runtime::spawn` + `tokio::time::interval`
- 发事件：`app.emit("event-name", payload)`
- 订阅事件（后端）：`app.listen("event-name", handler)`，闭包需 `Fn(Event) + Send + Sync + 'static`，持有 `AppHandle`（Clone）
- 托盘图标切换：`app.tray_by_id("tray").set_icon(Some(Image::from_bytes(...)))`
- 主动 show panel：`app.get_webview_window("panel").map(|w| w.show())`

---

## 六、开发注意事项

1. **后端定时器不要重复启动**：setup 中只 spawn 一次，状态机切换时不要重新 spawn，仅修改 `target_epoch` / `remaining_seconds`
2. **targetTime 机制是核心**：working 阶段必须用 `targetTime = now + duration`，每秒重算 remaining，避免漂移
3. **breaking 阶段用递减**：参考项目 breaking 用 `remaining -= 1`（因会被活动检测暂停），本项目虽不做活动检测，但为保持架构一致性沿用递减
4. **Phase 切换必发事件**：所有 phase 变化都要 emit `phase-changed`，前端依赖此事件切换 UI / 切托盘图标
5. **配置变更订阅范围**：仅 `work_duration` 实时重算（F2）；其他 key 仅在 phase 切换瞬间读取，有意不实时响应（见 F 域 ⚠️ 标注）
6. **暂停时不要丢剩余时间**：toggle_pause 进入 paused 时保存 remaining_seconds 和原 phase；恢复时根据原 phase 决定是重设 targetTime（working）还是直接递减（breaking）
7. **跳过机制**：skip_break 每次点击 breakSkipCount+=1 并 emit 事件更新 UI（按钮显示「跳过 (n/3)」），达到 3 次才真正跳过；进入 breaking 时清零
8. **不要在 breaking 阶段读取 work_duration**：breaking 时长由 break_duration / long_break_duration 决定，与 work_duration 无关
9. **静音时段判断频率**：每秒一次（在 1Hz tick 内），quiet_hours 通常 < 5 项、开销可忽略；进入/退出延迟最多 1 秒
10. **跨天判断**：每次 tick 检查 `save_date` 是否等于今天；不等则清空状态、start_work、更新 save_date
11. **事件订阅闭包陷阱**：后端 `app.listen` 闭包不能直接持有 `&App`，需 clone `AppHandle`；前端 `listen` 回调若依赖 React state，需用 ref（如 phaseRef）避免读到旧值
12. **Phase serde case**：`Phase` 是 `rename_all = "lowercase"`（值如 `"working"`）；`TimerStatePayload` 是 `rename_all = "camelCase"`（字段如 `remainingSeconds`）。后端 listener 解析 phase-changed payload 时注意 case
