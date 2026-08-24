# life 详细设计文档（Detailed Design）

**版本：** v0.1
**日期：** 2026-06-17
**对应需求：** `proposal.md`（自律习惯 App 需求文档 v0.1）
**基准代码：** 当前 `life` 仓库（React 18 + TypeScript + Vite 5 + Capacitor 8）

> **⚠️ 2026-08-24 起本文多处已与实现不符。** 一天一件改造第二轮删掉了：
> 「边界」清单、今天页的「生活」区块、「今天和人认真聊过」、放松窗口、今日模板、
> 任务池的「进今天」/「直接开始」两个按钮；今天页只剩「一件事的当前那一步」
> 和「今天不做（只能换，不能并行）」。
> **实现的事实基准以 `CONTEXT.md` 最近变更为准，本文留档备查。**

---

## 0. 文档说明

### 0.1 本文档的定位

本文档把 `proposal.md` 里划分出的功能模块落成可实现、可独立测试的详细设计。

写法遵循两条约束：

1. **以现有 `life` 代码库为基准**：每个模块先说明现有实现现状，再说明为对齐 proposal 需要新增 / 改造什么，最后给出独立测试方式。
2. **完全按 proposal 的模块边界组织**：模块划分直接采用 `proposal.md` 第 4、5 章；现有代码中已经与 proposal 相符的部分予以保留并复用，不推倒重做。

### 0.2 proposal 中"待确认项"的处理结论（Q1–Q7）

`proposal.md` 第 7 章列出 Q1–Q7 待确认问题。本文档按"从现有代码库推断"的方式给出结论，作为详细设计的输入：

| # | 问题 | 结论（据代码库推断） |
|---|------|----------------------|
| Q1 | 现有 App 的功能 | 现有 `life` 已实现：任务池、今日任务、最小下一步、番茄钟、困难→下一步、状态记录、今天不做清单、交流提醒、放松窗口、日复盘、日/周模板、Supabase 同步、飞书同步、Android 原生提醒、安卓应用锁。 |
| Q2 | 技术栈 | React 18 + TypeScript 5 + Vite 5；Capacitor 8 封装 Android；`@capacitor/local-notifications` 做原生提醒；Supabase（`@supabase/supabase-js`）做快照同步；`dayjs` 处理时间；PWA。数据用 `localStorage`（键 `life-app-v1`）。 |
| Q3 | Claude API 已用于哪些功能 | **当前代码中无任何 Claude / Anthropic SDK 依赖与调用。** proposal 提到"已有 API Key"属规划，未落地。本设计将 AI 能力标为后续可选模块，默认不纳入 P0。 |
| Q4 | 守则是固定还是可自定义 | 区分两类：**核心原则（6 条）固定内置、不可编辑**（proposal §5）；**执行守则（3 条）可自定义**，复用现有 `ruleDefs` 机制并预置 3 条默认内容。 |
| Q5 | 推送时间是否可自定义 | 可自定义。现有 `mobileTimer` 已按 `scheduleTime` 调度固定任务提醒，飞书 `feishuScheduledSyncTime` 也可配。晚间复盘提醒默认 22:30、硬性收工默认 23:00，均做成可配置项。 |
| Q6 | 是否需要账号 / 云同步 | 无账号体系。沿用现有"同步码（`syncSpaceId`）+ Supabase 快照"方案，本地优先、可选开启同步。 |
| Q7 | 进度统计页是否已存在 | 部分存在：复盘页有"近 30 天记录"历史面板，底层有 `focusSessions` 等记录；但**无日历热力图 / 连续打卡 / 周完成率**，需新增（见 M4）。 |

> 上述 Q4、Q5 涉及产品默认值（守则是否可改、提醒几点）的取舍，是基于现有代码能力做的合理默认。如与你的预期不同，请指出，我据此调整对应模块。

---

## 1. 系统总览

### 1.1 现有架构分层

```
┌─────────────────────────────────────────────┐
│ UI 层  src/App.tsx + src/components/*         │
│   今天 / 任务池 / 设置 / 复盘 四个 Tab        │
├─────────────────────────────────────────────┤
│ 状态与业务层  src/hooks/useLifeApp.ts         │
│   单一 LifeAppData 状态树 + actions           │
├─────────────────────────────────────────────┤
│ 能力库  src/lib/*                             │
│   storage / sync / feishu / mobileTimer /     │
│   focusLock / alarm / pwa / quickCapture      │
├─────────────────────────────────────────────┤
│ 持久化  localStorage(life-app-v1) ↔ Supabase  │
│ 原生壳  Capacitor(Android)                    │
└─────────────────────────────────────────────┘
```

数据流：所有状态收敛到 `useLifeApp` 的单一 `LifeAppData` 树 → `saveData` 写 `localStorage` → 开启同步时去抖后 `pushRemoteSnapshot` 到 Supabase；轮询 `pullRemoteSnapshot` 拉回更新的快照。

### 1.2 模块划分（对齐 proposal）

proposal 把新增需求分为 4 个功能模块 + 1 套核心原则。本文据此划出 **5 个业务模块** 与 **4 个共享基础设施模块**：

| 编号 | 模块 | 来源 | 优先级 |
|------|------|------|--------|
| **M1** | 晨间任务锚点（今日三件事） | proposal §4.1 | 高 |
| **M2** | 执行守则与好奇清单（行为规范检查） | proposal §4.2 | 中 |
| **M3** | 晚间复盘与明日规划 | proposal §4.3 | 高 |
| **M4** | 进度可视化（习惯日历 / 连续打卡） | proposal §4.4 | 低 |
| **M5** | 核心原则展示（6 条固定内置） | proposal §5 | 中 |
| **S1** | 数据与持久化（含迁移） | 现有 storage/defaults | 基础 |
| **S2** | 提醒与通知调度 | 现有 mobileTimer/alarm | 基础 |
| **S3** | 同步（Supabase + 飞书） | 现有 sync/feishu | 基础 |
| **S4** | Android 壳与专注阻断 | 现有 focusLock/Capacitor | 基础 |

### 1.3 模块依赖关系

```
        M5 核心原则(纯静态)
              │(只读引用)
M1 晨间 ──┐   │
M2 执行 ──┼──→ S1 数据/持久化 ──→ S3 同步
M3 晚间 ──┤        ↑
M4 进度 ──┘        │(只读派生)
              S2 提醒调度 ──→ S4 Android壳
```

**独立性原则：** M1–M4 之间互不直接调用，全部只通过 S1（`LifeAppData` + `useLifeApp` actions）交互；M5 是纯静态常量，无依赖；S2/S3/S4 通过明确的库接口（`src/lib/*` 导出函数）被调用，可单独 mock。这样每个业务模块都能在不启动其它模块的情况下单测。

---

## 2. 业务模块详细设计

每个模块给出：职责 → 现状 → 对齐 proposal 的改造点 → 数据模型 → 接口（actions） → UI → 触发/提醒 → 独立测试。

---

### M1 晨间任务锚点（今日三件事）

#### M1.1 职责

解决 proposal "无目标 → 空转"的根源：每天进入 App 时，先确定当天最重要的 3 件任务并按优先级排列；未确定则以提示阻断进入其它模块。

#### M1.2 现状（现有代码）

- 已有"今日任务"概念：`DayPlan.todayItems`（`TodayItem[]`），支持新增、排序（`moveTodayItem`）、完成、拆最小下一步。
- `dailyTemplate.topTaskSlots` 默认 `3`，已表达"三件事"的目标值，但**仅作模板参考，未做强制**。
- 有 `quickStartTodayTask`（写一件最重要的事）和"任务池放进今天"两条入口。
- **缺口**：没有"晨间锚点"这一独立步骤，没有"未填三件事则阻断"的逻辑，没有"今日是否已规划"的状态标记。

#### M1.3 对齐 proposal 的改造点

1. 在 `DayPlan` 增加锚点状态字段，标记"今天三件事是否已确认"。
2. 新增"晨间锚点"轻量步骤（today 页顶部卡片或首次进入时的引导层），收集 ≤3 条核心任务（`kind: 'normal'`），按优先级（`order`）排列。
3. 当 `morningAnchorDone === false` 时，对 M2/M3/M4 入口做**硬阻断**（已确认 D1）：未确认今日三件事前，其它 Tab（任务池/复盘）不可进入，点击导航跳回 today 锚点卡片并提示"先定今天三件事"。仅 today 页的锚点录入可用。
4. 复用现有 `todayItems`/`moveTodayItem`/`quickStartTodayTask`，不另起数据结构。

#### M1.4 数据模型变更

`DayPlan`（`src/types.ts`）新增：

```ts
interface DayPlan {
  // ...现有字段...
  morningAnchorDone: boolean       // 今日三件事是否已确认
  morningAnchorAt?: string         // 确认时间(ISO)
}
```

- "三件事"本身**不新增结构**，即 `todayItems` 中 `kind === 'normal'` 的前 3 条（按 `order`）。
- 目标条数复用 `dailyTemplate.topTaskSlots`（默认 3）。

#### M1.5 接口（`useLifeApp` 新增 actions）

```ts
confirmMorningAnchor(titles: string[]): void   // 写入≤topTaskSlots条核心任务并置 morningAnchorDone=true
resetMorningAnchor(): void                      // 调试/重置当天锚点
```

- 复用：`moveTodayItem`（调序）、`removeTodayItem`、`quickStartTodayTask`。
- 派生只读：`isMorningAnchorPending = !dayPlan.morningAnchorDone`。

#### M1.6 UI

- today 页顶部新增「今日三件事」卡片：未确认时展示 3 个输入槽 + 「确认今天就做这三件」按钮；已确认后折叠为概要（显示 3 件事 + 完成进度）。
- 其它 Tab（任务池/复盘）在 `isMorningAnchorPending` 时顶部显示一条提示条："先定今天三件事"，点击回到 today。

#### M1.7 提醒（依赖 S2）

- 复用 S2 通知调度：可配置"晨间提醒时间"（默认不开启），到点推送"今天最重要的三件事是什么？"。设置项见 S2。

#### M1.8 独立测试

- 单测 `confirmMorningAnchor`：传 1/2/3/4 条，验证只取前 `topTaskSlots` 条、`morningAnchorDone` 置真、`order` 连续。
- 单测阻断派生：构造 `morningAnchorDone=false` 的 `DayPlan`，断言 `isMorningAnchorPending` 为真。
- 组件测试：渲染 today 卡片，未确认态显示输入槽、确认后折叠。
- **可独立运行**：只依赖 S1 的数据树，不触发 M2/M3/M4。

> ✅ **已确认（D1）**：采用**硬阻断**——未确认今日三件事前不可进入其它 Tab，导航跳回 today 锚点卡片。与 proposal §4.1"不允许直接跳过"一致。

---

### M2 执行守则与好奇清单（行为规范检查）

#### M2.1 职责

打断"假性努力 / 空转"：在执行时段提供 3 条执行守则提醒，并提供"好奇清单"承接零散兴趣，避免在核心任务时段被带走。

proposal §4.2 三条执行守则：

1. 零散兴趣加入"好奇清单"，不在核心任务时段看
2. 遇到难题先独立思考 3 分钟，写下思路再问 AI
3. 感到空转超过 5 分钟 → 立刻打开任务清单

#### M2.2 现状（现有代码）

- `ruleDefs`（`RuleDefinition[]`，`type: 'do' | 'avoid'`）+ `addRuleDefinition` 已能存自定义规则；默认预置 1 条 avoid 规则。
- "今天不做清单"`avoidItems` + `toggleAvoidDone` 已实现边界守住。
- 状态记录 `stateRecords`（分心/拖延/空转等）+ `presetInterventions` 干预方法已实现"空转时怎么办"的承接。
- **缺口**：没有"好奇清单"这一专用结构；没有把 proposal 的 3 条守则作为预置内容；没有"执行守则提醒"卡片/通知。

#### M2.3 对齐 proposal 的改造点

1. 预置 proposal 的 3 条执行守则到 `ruleDefs`（`type: 'do'`），保持可编辑（呼应 Q4）。
2. 新增"好奇清单"数据结构与录入入口（守则 1 的落地）。
3. today 页新增「执行守则」展示卡片（固定可见 + 可主动查看）；可选定时通知（依赖 S2）。
4. 守则 3"空转 5 分钟"复用现有 `stateRecords` + 干预流程（记录 `numb_scroll`/`distracted` → 引导打开任务清单）。

#### M2.4 数据模型变更

新增「好奇清单」顶层数组（`LifeAppData`）：

```ts
interface CuriosityItem {
  id: string
  text: string
  createdAt: string
  archived?: boolean     // 放松窗口内"消化"后归档
}

interface LifeAppData {
  // ...现有字段...
  curiosityItems: CuriosityItem[]
}
```

执行守则复用 `ruleDefs`，不新增类型；预置内容放到 `defaults.ts` 的 `defaultRuleDefs()`。

#### M2.5 接口（新增 actions）

```ts
addCuriosityItem(text: string): void
removeCuriosityItem(id: string): void
archiveCuriosityItem(id: string): void
// 守则复用现有：addRuleDefinition / (新增)removeRuleDefinition / updateRuleDefinition
```

#### M2.6 UI

- today 页「执行守则」卡片：列出 3 条守则（来自 `ruleDefs`），每条可勾选"已读/遵守"。
- 「好奇清单」入口：一个快速输入框（"先记下来，等放松窗口再看"），列表展示，放松窗口（来自 M 复用现有 `relaxWindows`）激活时高亮可消化。
- 设置页提供守则编辑（增删改），核心原则（M5）只读不可改，二者视觉区分。

#### M2.7 提醒（依赖 S2）

- 可选"执行守则定时提醒"开关 + 时间（设置项），到点推送一条守则文案。

#### M2.8 独立测试

- 单测好奇清单 CRUD：增/删/归档后数组状态正确。
- 单测 `defaultRuleDefs()` 含 proposal 3 条守则。
- 组件测试：守则卡片渲染 3 条、好奇清单录入即显示。
- **可独立运行**：仅依赖 S1。

---

### M3 晚间复盘与明日规划

#### M3.1 职责

建立正反馈闭环：每日 22:30 提醒复盘，23:00 硬性收工提示；勾选今日三件事完成情况、输入明日三件事，可选记录今日情绪/状态评分（1–5）。

#### M3.2 现状（现有代码）

- `DailyReview { wins, slips, commonState, tomorrow, updatedAt }` + `saveReview` 已实现极简复盘。
- 复盘页已存在，含"今日完成/失守/最常见状态/明天第一步"和困难列表、近 30 天历史。
- 飞书可把复盘同步到群（`feishuAutoSyncReview` / 定时同步）。
- **缺口**：无 22:30 复盘提醒、无 23:00 硬性收工；"明日"是自由文本而非"明日三件事"结构；无情绪评分 1–5。

#### M3.3 对齐 proposal 的改造点

1. `DailyReview` 增加情绪评分与"明日三件事"。
2. 新增"晚间复盘提醒时间"（默认 22:30）与"硬性收工时间"（默认 23:00）设置（依赖 S2 推送 / 收工提示）。
3. 复盘表单增加：勾选今日三件事完成情况（读 `todayItems` 前 3 条 `isDone`）、明日三件事录入、情绪评分。
4. "明日三件事"在次日可一键预填到 M1 晨间锚点（M3→M1 通过 S1 数据衔接，不直接耦合）。

#### M3.4 数据模型变更

```ts
interface DailyReview {
  wins: string
  slips: string
  commonState: StateType | ''
  tomorrow: string             // 保留：自由文本"明天第一步"
  tomorrowTop3?: string[]      // 新增：明日三件事
  moodScore?: 1 | 2 | 3 | 4 | 5 // 新增：今日情绪/状态评分
  updatedAt: string
}
```

`AppSettings` 新增：

```ts
reviewReminderEnabled: boolean     // 晚间复盘提醒开关
reviewReminderTime: string         // 默认 '22:30'
hardStopEnabled: boolean           // 硬性收工提示开关
hardStopTime: string               // 默认 '23:00'
```

`ReviewInput` 同步增加 `tomorrowTop3?`、`moodScore?`。

#### M3.5 接口

```ts
// 复用并扩展现有 saveReview(payload: ReviewInput)
saveReview(payload: ReviewInput): void   // payload 增加 tomorrowTop3 / moodScore
// 次日衔接（落到 M1）：confirmMorningAnchor(yesterdayReview.tomorrowTop3 ?? [])
```

#### M3.6 UI

- 复盘页表单新增：①今日三件事完成勾选（只读映射 `todayItems` 完成态）②明日三件事 3 个输入槽 ③情绪评分 1–5（星级/数字）。
- 22:30 起复盘页顶部出现"该复盘了"提示；23:00 起显示"硬性收工"提示条。

#### M3.7 提醒（依赖 S2）

- S2 按 `reviewReminderTime` 调度本地通知"开始今天的复盘"；按 `hardStopTime` 调度"收工时间到"。

#### M3.8 独立测试

- 单测 `saveReview` 写入 `tomorrowTop3` / `moodScore`，`updatedAt` 刷新。
- 单测"明日三件事 → 次日晨间锚点"：给定昨日 review，断言生成的锚点输入正确。
- 组件测试：评分组件取值 1–5；今日三件事完成勾选与 `todayItems` 同步。
- **可独立运行**：仅依赖 S1；提醒部分 mock S2。

---

### M4 进度可视化（习惯日历 / 连续打卡）

#### M4.1 职责

提供成就感、对抗自我怀疑：展示每日完成件数、连续打卡天数、周完成率，以日历热力图或数字统计呈现。

#### M4.2 现状（现有代码）

- 已有底层记录：`dayPlans`（每日 `todayItems` 完成情况）、`focusSessions`、`relaxWindows`、`difficultyRecords`、`stateRecords`。
- 复盘页已有"近 30 天记录"历史面板（按类型筛选）。
- `purgeOldData` 保留近 30 天数据。
- **缺口**：无连续打卡（streak）、无周完成率、无日历热力图。

#### M4.3 对齐 proposal 的改造点

1. 完全**派生计算**，**不新增持久化字段**（从现有 `dayPlans` / `focusSessions` 推导），保证模块独立、无数据迁移负担。
2. 新增纯函数统计层 `src/lib/stats.ts`，输入 `LifeAppData`，输出统计视图模型。
3. 复盘页（或新子页）新增「进度」区块：日历热力图 + 连续打卡 + 周完成率。

#### M4.4 数据模型

无新增持久化字段。新增派生视图类型（仅内存）：

```ts
interface DayStat {
  dayKey: string
  doneCount: number       // 当日完成的 todayItems 数
  totalCount: number
  focusCount: number      // 当日有效番茄数
  hasReview: boolean
}
interface ProgressSummary {
  days: DayStat[]         // 近 N 天
  currentStreak: number   // 连续打卡天数
  weeklyCompletionRate: number  // 本周完成率
}
```

#### M4.5 接口

```ts
// src/lib/stats.ts （纯函数，无副作用，可单测）
computeDayStats(data: LifeAppData, rangeDays: number): DayStat[]
computeStreak(days: DayStat[]): number
computeWeeklyRate(data: LifeAppData, weekStart: string): number
buildProgressSummary(data: LifeAppData, rangeDays: number): ProgressSummary
```

"打卡有效"的判定（默认）：当日至少完成 1 件 `todayItems` 或 1 个有效番茄。具体阈值见 M4.7。

#### M4.6 UI

- 复盘页新增「进度」折叠区：近 30 天热力图（每格颜色按 `doneCount` 分档）、连续打卡数字、本周完成率进度条。
- 纯展示，不可编辑。

#### M4.7 独立测试

- `stats.ts` 是纯函数，最易测：喂入构造好的 `LifeAppData`，断言 `doneCount`/`currentStreak`/`weeklyCompletionRate`。
- 边界：空数据、跨周、断签后 streak 归零。
- **完全独立**：纯函数 + 只读派生，零副作用，不依赖其它模块。

> ✅ **已确认（D2）**："连续打卡有效"= 当日**完成 ≥1 件 `todayItems` 或 ≥1 个有效番茄**。

---

### M5 核心原则展示（6 条固定内置）

#### M5.1 职责

固定展示 proposal §5 的 6 条核心原则，作为行为参考，**不可关闭、不可编辑**：

1. 今日 3 件事优先于一切
2. 23:00 硬性收工，无例外
3. 感到拖延时，只启动 5 分钟
4. 崩溃后不自责，只重启
5. 进度由完成件数衡量，不由感觉
6. AI 是工具，不是拐杖

#### M5.2 现状

- 现有代码无此模块。`encouragementMessages`（随机鼓励语）与之相关但不同。

#### M5.3 设计

- 在 `src/lib/principles.ts` 定义只读常量数组（不进 `LifeAppData`、不进 `localStorage`、不参与同步）：

```ts
export const CORE_PRINCIPLES: readonly string[] = [ /* 上述 6 条 */ ] as const
```

- 与 M2 执行守则（可编辑）的区别：M5 固定、M2 可改。二者在设置页分区展示，明确"原则不可改 / 守则可改"。

#### M5.4 UI

- 设置页固定区块展示 6 条原则（只读）。
- 可选：today 页底部或抽屉里轮播 1 条原则提醒。

#### M5.5 独立测试

- 断言 `CORE_PRINCIPLES` 长度为 6、内容与 proposal 一致、为只读（`as const`）。
- 组件测试：原则区块渲染 6 条、无编辑控件。
- **完全独立**：纯静态常量。

---

## 3. 共享基础设施模块

业务模块通过这些库的导出接口交互，便于在单测中 mock。

### S1 数据与持久化

- **现状**：`src/lib/defaults.ts`（默认数据、`createId`、`ensureDayPlan`、`purgeOldData`）、`src/lib/storage.ts`（`loadData`/`saveData`，`localStorage` 键 `life-app-v1`，加载时与默认值 merge 兼容旧结构）、`src/hooks/useLifeApp.ts`（单一状态树 + 全部 actions）。
- **本次改造**：
  - `types.ts` 增字段（M1 `morningAnchorDone/At`；M2 `curiosityItems`；M3 `tomorrowTop3/moodScore` 及 settings 4 项）。
  - `defaults.ts`：`defaultRuleDefs()` 预置 3 条执行守则；`defaultData()` 补 `curiosityItems: []`、新 settings 默认值（`reviewReminderTime:'22:30'`、`hardStopTime:'23:00'` 等）；`createEmptyDayPlan` 补 `morningAnchorDone:false`。
  - `storage.ts`：`loadData` 的 merge 已对缺失字段回退默认值，新增字段**向后兼容**（旧快照加载时自动补默认值），无需写迁移脚本。
- **独立测试**：`loadData` 喂入旧版本 JSON（缺新字段），断言补齐默认值且不报错；`purgeOldData` 仍只留近 30 天。

### S2 提醒与通知调度

- **现状**：`src/lib/mobileTimer.ts`（Capacitor `LocalNotifications`，按 `scheduleTime` 调度固定任务提醒、番茄结束提醒；channel `life-reminders`）、`src/lib/alarm.ts`。
- **本次改造**：新增可调度项——晨间锚点提醒（M1）、执行守则提醒（M2）、晚间复盘提醒 22:30（M3）、硬性收工 23:00（M3）。统一走 `mobileTimer` 的调度封装，按设置项的时间注册/取消通知。
- **接口**：建议补 `scheduleDailyReminder(id, time, title, body)` / `cancelDailyReminder(id)` 通用封装，M1/M2/M3 复用。
- **独立测试**：mock `LocalNotifications`，断言按设置时间注册了正确 id 与文案；关闭开关时取消。

### S3 同步（Supabase + 飞书）

- **现状**：`src/lib/sync.ts`（快照 push/pull，`isSyncEnvReady`，同步码 `syncSpaceId`）；`src/lib/feishu.ts`（复盘/日志同步到飞书群）。
- **本次改造**：新增字段随快照整体同步，**无接口变更**（快照是整棵 `LifeAppData`）。飞书复盘报文可补"明日三件事 / 情绪评分"（M3）。
- **独立测试**：mock supabase client，验证 push/pull 携带新字段；飞书报文生成函数纯函数可单测。

### S4 Android 壳与专注阻断

- **现状**：Capacitor 8 工程（`android/`）、`src/lib/focusLock.ts`（应用锁，包名映射）、`src/lib/pwa.ts`。详见 `docs/android.md`。
- **本次改造**：基本不动。M1/M2/M3 的新通知经 S2 → Capacitor 即可在锁屏/后台提醒，无需改原生层。
- **独立测试**：Web 环境下 `Capacitor.isNativePlatform()` 为假时降级（不报错），保证 Web 单测可跑。

---

## 4. 数据模型变更汇总

集中列出本设计对 `src/types.ts` 的改动，便于实现与评审：

```ts
// DayPlan 新增
morningAnchorDone: boolean
morningAnchorAt?: string

// LifeAppData 新增
curiosityItems: CuriosityItem[]

// 新增类型
interface CuriosityItem { id: string; text: string; createdAt: string; archived?: boolean }

// DailyReview 新增
tomorrowTop3?: string[]
moodScore?: 1 | 2 | 3 | 4 | 5

// ReviewInput 新增
tomorrowTop3?: string[]
moodScore?: 1 | 2 | 3 | 4 | 5

// AppSettings 新增
reviewReminderEnabled: boolean
reviewReminderTime: string      // '22:30'
hardStopEnabled: boolean
hardStopTime: string            // '23:00'
// （可选）morningReminderEnabled / morningReminderTime
// （可选）guidelineReminderEnabled / guidelineReminderTime
```

均为**新增**，不改动现有字段语义；`loadData` 的默认值 merge 保证旧数据向后兼容（S1）。

---

## 5. 测试策略

### 5.1 模块独立可测性

| 模块 | 测试形态 | 依赖 | 可独立运行 |
|------|----------|------|-----------|
| M1 | actions 单测 + 组件测试 | S1 | ✅ |
| M2 | CRUD 单测 + 组件测试 | S1 | ✅ |
| M3 | actions 单测 + 组件测试 | S1（S2 mock） | ✅ |
| M4 | 纯函数单测（`stats.ts`） | 无 | ✅ |
| M5 | 常量/组件断言 | 无 | ✅ |
| S1 | 兼容性/迁移单测 | localStorage mock | ✅ |
| S2 | 调度单测 | LocalNotifications mock | ✅ |
| S3 | push/pull + 报文单测 | supabase/fetch mock | ✅ |

> 当前仓库 `package.json` 暂未配置测试框架。落地时建议引入 `vitest`（与 Vite 同源、配置最小）。若你倾向其它框架请告知。

### 5.2 验收闭环（沿用 PRD 口径并扩展）

延续 `docs/PRD.md` 的一句话验收，叠加 proposal 三时段：

> 早上能在锚点卡片定下今天三件事 → 执行中守则可见、零散兴趣进好奇清单 → 22:30 收到复盘提醒、勾完成 + 写明日三件事 + 打情绪分 → 进度页看到连续打卡与本周完成率。

---

## 6. 实施顺序建议（按优先级 + 依赖）

1. **S1 数据模型扩展**（所有业务模块的前置）
2. **M1 晨间锚点**（高优先级，核心抓手）
3. **M3 晚间复盘扩展**（高优先级，与 M1 形成首尾闭环）
4. **M5 核心原则**（低成本，纯静态）
5. **M2 执行守则 + 好奇清单**（中优先级）
6. **S2 提醒扩展**（支撑 M1/M2/M3 的定时推送）
7. **M4 进度可视化**（低优先级，纯派生，可最后做）

---

## 7. 设计取舍（已确认）

以下三处产品取舍已由用户拍板确定：

| # | 模块 | 问题 | 确定结论 |
|---|------|------|-----------|
| D1 | M1 | 未定三件事时是软提示还是硬阻断？ | **硬阻断**：未确认前不可进入其它 Tab |
| D2 | M4 | "连续打卡有效"的判定标准？ | **完成 ≥1 件 或 ≥1 个有效番茄** |
| D3 | — | 是否本期就引入 Claude API（守则 2 的"问 AI"）？ | **不纳入**：守则 2 仅文案引导，不接 AI |

---

*本文档以现有 `life` 代码库为事实基准，按 `proposal.md` 的模块边界重组而成。标注 ❓ / D 的条目为需你确认的取舍点。*
