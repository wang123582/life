# M1 晨间任务锚点（今日三件事，硬阻断）

**目标：** 每日先确认"今日三件事"（≤ `dailyTemplate.topTaskSlots`，默认 3，`kind:'normal'`，按优先级排列）；**未确认前硬阻断**进入其它 Tab。
**前置：** S1。
**主要文件：** `src/hooks/useLifeApp.ts`、`src/App.tsx`。
**对应设计：** detailed-design.md M1（D1=硬阻断）。
**状态：** ✅ 完成（test 13 passed / typecheck / lint / build 全绿）

## 子任务

### 状态与 actions（`useLifeApp.ts`）
- [x] `confirmMorningAnchor(titles)`：取前 `topTaskSlots` 条非空 → 写入 `kind:'normal'` 的 todayItems，`order` 连续；置 `morningAnchorDone=true`、`morningAnchorAt=now`
- [x] `resetMorningAnchor()`
- [x] 派生 `isMorningAnchorPending = !dayPlan.morningAnchorDone`
- [x] 复用现有 `moveTodayItem`/`removeTodayItem`

### UI（`App.tsx`）
- [x] today 页顶部「今日三件事」卡片：pending 时 N 个输入槽 + 确认按钮；已确认折叠为概要（含完成态 ✓）
- [x] **硬阻断**：pending 时 pool/review 导航按钮 disabled + 点击回 today；`useEffect` 在 pending 时强制 `activeTab='today'`（覆盖跨天）
- [x] today 页始终可用

## 单元测试（`src/hooks/__tests__/useLifeApp.morningAnchor.test.ts`）
- [x] confirm 取前 `topTaskSlots`、跳过空串、`order` 连续、置 done
- [x] 派生 pending 正确
- [x] reset 回到 pending

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 M1 并记日志
