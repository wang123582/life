# S1 数据与持久化

**目标：** 扩展 `LifeAppData` 数据模型以支撑 M1–M4，并保证旧 `localStorage` 快照向后兼容（无需迁移脚本）。
**前置：** T0。
**主要文件：** `src/types.ts`、`src/lib/defaults.ts`、`src/lib/storage.ts`。
**对应设计：** detailed-design.md §3 S1、§4。
**状态：** ✅ 完成（test 8 passed / typecheck / lint / build 全绿）

## 子任务

### 类型（`src/types.ts`）
- [x] `DayPlan` 新增：`morningAnchorDone: boolean`、`morningAnchorAt?: string`
- [x] 新增类型：`CuriosityItem { id; text; createdAt; archived? }`
- [x] `LifeAppData` 新增：`curiosityItems: CuriosityItem[]`
- [x] `DailyReview` 新增：`tomorrowTop3?: string[]`、`moodScore?: 1..5`
- [x] `ReviewInput` 同步新增：`tomorrowTop3?`、`moodScore?`
- [x] `AppSettings` 新增：`reviewReminderEnabled`、`reviewReminderTime`、`hardStopEnabled`、`hardStopTime`

### 默认值（`src/lib/defaults.ts`）
- [x] `defaultData()`：补 `curiosityItems: []`、settings 默认（22:30 / 23:00 / 开关 true）
- [x] `createEmptyDayPlan`：补 `morningAnchorDone: false`
- [x] `defaultRuleDefs()`：预置 3 条执行守则（`type:'do'`）

### 持久化兼容（`src/lib/storage.ts`）
- [x] `loadData` merge 回退所有新字段默认值
- [x] 每个旧 plan 缺 `morningAnchorDone` 时补 `false`

## 单元测试（`src/lib/__tests__/s1-data.test.ts`）
- [x] `loadData` 旧版 JSON 缺字段 → 补默认
- [x] `defaultData()` 形状断言
- [x] `purgeOldData` 只留近 30 天且保留新字段

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 S1 并记日志
