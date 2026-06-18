# M3 晚间复盘与明日规划

**目标：** 复盘表单支持"勾选今日三件事完成情况 + 输入明日三件事 + 情绪评分 1–5"；提供晚间复盘提醒（默认 22:30）与硬性收工提示（默认 23:00）设置。
**前置：** S1（M3↔M1 通过数据衔接，不直接耦合）。
**主要文件：** `src/hooks/useLifeApp.ts`、`src/lib/review.ts`、`src/App.tsx`。
**对应设计：** detailed-design.md M3。
**状态：** ✅ 完成（test 17 passed / typecheck / lint / build 全绿）

## 子任务

### actions / 逻辑
- [x] `saveReview` 写入 `tomorrowTop3` / `moodScore`（payload 直接 spread，S1 已加类型）
- [x] 次日衔接 helper `getAnchorPrefillFromReview`（纯函数，落地到 M1 预填）+ `isValidMoodScore`

### UI（`App.tsx` 复盘页）
- [x] 今日三件事完成勾选：只读映射当天 `todayItems`(normal) 前 N 条 `isDone`
- [x] 明日三件事：3 个输入槽 → `tomorrowTop3`
- [x] 情绪评分 1–5（按钮点选）→ `moodScore`

### 设置（`App.tsx` 设置页）
- [x] `reviewReminderEnabled` + `reviewReminderTime`（默认 22:30，`type=time`）
- [x] `hardStopEnabled` + `hardStopTime`（默认 23:00，`type=time`）
- [~] 复盘页 22:30/23:00 时段顶部提示条 — 提示调度归 S2；当前提供设置项，banner 可后续接入

## 单元测试
- [x] `saveReview` 写入 `tomorrowTop3`/`moodScore`，`updatedAt` 刷新（`useLifeApp.review.test.ts`）
- [x] `getAnchorPrefillFromReview` / `isValidMoodScore`（`review.test.ts`）

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 M3 并记日志
