# 数据模型与 API 草案

## 本地优先数据模型

第一版使用本地存储，核心对象如下：

### `TaskDefinition`

任务池定义。

字段：
- `id`
- `title`
- `kind`：`normal | routine`
- `scheduleTime?`
- `archived?`
- `createdAt`

### `DayPlan`

当天执行快照。

字段：
- `dayKey`
- `todayItems[]`
- `avoidItems[]`
- `communicationDone`
- `communicationNote`
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

### `RelaxWindow`

放松窗口解锁记录。

字段：
- `id`
- `dayKey`
- `sourceType`
- `sourceId`
- `minutes`
- `recommendation`
- `createdAt`
- `expiresAt`
- `used`

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

### 放松窗口

- `GET /v1/relax-windows?dayKey=2026-04-30`
- `POST /v1/relax-windows`
- `PATCH /v1/relax-windows/:id`

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
- 放松窗口：已实现
- 模板：已实现基础结构
- 同步 API：仅文档设计，未实现
