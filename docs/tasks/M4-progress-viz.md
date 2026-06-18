# M4 进度可视化（习惯日历 / 连续打卡）

**目标：** 展示每日完成件数、连续打卡天数、周完成率。**纯派生计算，不新增持久化字段。**
**前置：** S1。
**主要文件：** `src/lib/stats.ts`（新增）、`src/App.tsx`（复盘页）。
**对应设计：** detailed-design.md M4（D2 已确认打卡口径）。
**状态：** ✅ 完成（test 29 passed / typecheck / lint / build 全绿）

## 子任务

### 纯函数统计（`src/lib/stats.ts`）
- [x] `computeDayStats(data, rangeDays, today?)` → `DayStat[]`
- [x] `isActiveDay`（D2：done≥1 或 有效番茄≥1）+ `computeStreak`（今天未动不立即归零）
- [x] `computeWeeklyRate(data, weekStart)`
- [x] `buildProgressSummary(data, rangeDays?, today?)`
- [x] 全部无副作用纯函数

### UI（`App.tsx` 复盘页）
- [x] 「进度」区块：连续打卡天数、本周完成率、近 30 天热力图（按 doneCount 分 0–3 档着色）
- [x] 纯展示、不可编辑

## 单元测试（`src/lib/__tests__/stats.test.ts`，10 项）
- [x] `computeDayStats` done/total/focus/hasReview + 空数据
- [x] `computeStreak` 连续/今天未动不断签/前天活动→0/空数据→0
- [x] `computeWeeklyRate` 比例 + 无任务→0
- [x] `buildProgressSummary` 组装

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 M4 并记日志
