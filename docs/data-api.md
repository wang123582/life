# 数据模型与 API 草案

> **2026-08-24 更新**：一天一件改造的第二轮把「边界清单」「今天和人认真聊过」「放松窗口」
> 「今日模板」四组数据删掉了（理由见 `CONTEXT.md` 最近变更）。本文已同步。
> `loadData` 现在逐字段挑选，旧快照里这些键读一次就不再留存。

## 本地优先数据模型

第一版使用本地存储，核心对象如下：

### `TaskDefinition`

任务池定义。

字段：
- `id`
- `title`
- `kind`：`normal | routine`
- `nextStep?`：「下一秒手放在哪」。`normal` 强制填写，建今日副本时落成第一步；`routine` 恒为空
- `scheduleTime?`：`routine` 的提醒时刻
- `deadlineDate?`
- `archived?`
- `createdAt`

### `DayPlan`

当天执行快照。

字段：
- `dayKey`
- `todayItems[]`
- `processNotes` / `processNotesColor`
- `morningAnchorDone` / `morningAnchorAt?`
- `review`

### `TodayItem`

今日任务项。

字段：
- `id`
- `sourceTaskId?`
- `title`
- `kind`
- `isDone`
- `order`
- `steps[]`
- `createdAt`

### `TaskStep`

任务最小动作。

字段：
- `id`
- `title`
- `isDone`

### `DifficultyRecord`

困难记录。

字段：
- `id`
- `dayKey`
- `todayItemId?`
- `type`
- `note`
- `nextAction`
- `createdAt`

### `StateRecord`

状态记录。

字段：
- `id`
- `dayKey`
- `stateType`
- `trigger`
- `response`
- `result`
- `createdAt`

### `FocusSession`

番茄专注记录。

字段：
- `id`
- `dayKey`
- `todayItemId?`
- `stepId?`
- `mode`
- `startedAt`
- `endedAt`
- `plannedMinutes`
- `status`

## 当前持久化策略

第一版采用 `localStorage` 保存完整数据树，便于快速交付。

### 优点

- 实现快
- 无后端依赖
- 单人使用足够

### 后续建议

如果数据量变大或需要跨设备同步，下一步迁移到 `IndexedDB + 云同步接口`。

## 后续 API 设计（自然演进）

### 任务池

- `GET /v1/task-defs`
- `POST /v1/task-defs`
- `PATCH /v1/task-defs/:id`

### 今日计划

- `GET /v1/day-plans/:dayKey`
- `PUT /v1/day-plans/:dayKey`

### 困难记录

- `GET /v1/difficulties?dayKey=2026-04-30`
- `POST /v1/difficulties`

### 状态记录

- `GET /v1/state-records?dayKey=2026-04-30`
- `POST /v1/state-records`

### 番茄记录

- `GET /v1/focus-sessions?dayKey=2026-04-30`
- `POST /v1/focus-sessions`

## 同步策略建议

当需要手机和电脑互通时，建议采用：

- 定义类资源：普通 REST
- 记录类资源：append-only
- 同步接口：`push / pull`

### 推荐同步接口

- `GET /v1/sync/bootstrap`
- `GET /v1/sync/pull?cursor=...`
- `POST /v1/sync/push`

## 迁移建议

### V1

- 本地 `localStorage`
- 单用户单端优先

### V2

- `IndexedDB`
- 增加 `deletedAt` / `deviceId` / `clientMutationId`

### V3

- 云同步
- 多设备合并
- 更强的干预能力（浏览器扩展 / 原生 App）

## 当前实现与方案的对应关系

- 任务池：已实现
- 今日任务：已实现
- 最小任务：已实现
- 番茄钟：已实现
- 困难记录：已实现
- 状态记录：已实现
- 放松窗口：**已删**（与番茄结束后的休息重复，且推荐"看影视解说"与专注阻断名单自相矛盾）
- 模板：**已删**（一天一件不可配置，模板对象只剩死字段）
- 同步 API：仅文档设计，未实现
