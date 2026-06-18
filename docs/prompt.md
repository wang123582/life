# Vibe Coding 起始 Prompt（life 模块化改造）

> 本文件是自动化实现的"起始 Prompt"。主 Agent 据此跟踪进度并派生子 Agent；每个子 Agent 实现并自测一个模块。全程无人工参与。

## 1. 工程背景

`life` 是一个帮助用户"把一天过得有秩序"的应用：React 18 + TypeScript 5 + Vite 5，Capacitor 8 封装 Android，`localStorage`（键 `life-app-v1`）本地优先，Supabase 快照同步，飞书同步，Android 原生提醒与应用锁。当前要在**现有代码库基础上**，按 `proposal.md` 的模块对齐改造。

**必读输入：**
- 需求：`proposal.md`
- 详细设计：`docs/detailed-design.md`
- 任务划分：`docs/tasks/*.md`、总进度 `docs/tasks/progress.md`

## 2. 已确认的关键约束

- **D1**：M1 未确认"今日三件事"前 **硬阻断**，不可进入其它 Tab。
- **D2**：M4 连续打卡有效 = 当日 **完成 ≥1 件 todayItems 或 ≥1 个有效番茄**。
- **D3**：**不引入 Claude API**；守则 2 仅文案引导。
- 所有新增字段必须**向后兼容**旧 `localStorage` 快照（`loadData` merge 回退默认值，不写迁移脚本）。
- 保留现有已与 proposal 相符的实现，不推倒重做。

## 3. 测试与质量门槛（TS 工具链，替代 pytest/mypy/ruff）

每个模块"完成"必须同时满足：

- `npm run test`（**vitest** 单元/组件测试）全绿，且新代码有对应测试
- `npm run typecheck`（**tsc --noEmit**，等价 mypy）无错
- `npm run lint`（**eslint**，等价 ruff）无错
- `npm run build` 通过

## 4. 执行编排（主 Agent 职责）

按依赖顺序串行推进（共享文件多，避免并行冲突）：

```
T0 → S1 → M5 → M1 → M3 → M2 → M4 → S2 → S3 → S4
```

主 Agent 每步：
1. 读取对应 `docs/tasks/<编号>-*.md`，把该文件作为子 Agent 的任务说明。
2. 派生一个子 Agent 实现该模块 + 测试，要求达成第 3 节四项门槛。
3. 子 Agent 返回后，主 Agent 复核四项门槛是否真的通过；
4. 勾选 `docs/tasks/<编号>-*.md` 中子任务与 `progress.md` 模块状态，并在进度日志追加一行。
5. 失败则把失败输出回传子 Agent 修复，直到通过再进入下一模块。

## 5. 子 Agent 标准指令模板

> 你在 `life`（React 18 + TS + Vite）仓库实现单个模块。先读 `proposal.md`、`docs/detailed-design.md`、以及你的任务文件 `docs/tasks/<编号>-*.md`。
> 严格遵守 D1/D2/D3 与向后兼容约束。只改与本模块相关的文件，复用现有结构（`useLifeApp` 单一状态树 + actions）。
> 为新增逻辑写 vitest 测试（纯函数优先单测，UI 用 @testing-library/react）。
> 完成后必须自检并贴出结果：`npm run test`、`npm run typecheck`、`npm run lint`、`npm run build` 全部通过。
> 最后勾选你任务文件里的子任务清单。不要修改其它模块的文件。

## 6. 完成定义（整体）

`progress.md` 中 T0、S1–S4、M1–M5 全部勾选，且最终一次 `npm run test && npm run typecheck && npm run lint && npm run build` 全绿。
