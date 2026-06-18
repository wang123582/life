# M2 执行守则与好奇清单

**目标：** 执行时段展示 3 条执行守则（可编辑，复用 `ruleDefs`），并提供"好奇清单"承接零散兴趣。守则 2 仅文案，不接 AI（D3）。
**前置：** S1。
**主要文件：** `src/hooks/useLifeApp.ts`、`src/lib/defaults.ts`、`src/App.tsx`。
**对应设计：** detailed-design.md M2。
**状态：** ✅ 完成（test 19 passed / typecheck / lint / build 全绿）

## proposal §4.2 三条守则（已预置到 `defaultRuleDefs`，`type:'do'`）
1. 零散兴趣加入"好奇清单"，不在核心任务时段看
2. 遇到难题先独立思考 3 分钟，写下思路再问 AI
3. 感到空转超过 5 分钟 → 立刻打开任务清单

## 子任务

### actions（`useLifeApp.ts`）
- [x] `addCuriosityItem` / `removeCuriosityItem` / `archiveCuriosityItem`
- [x] `removeRuleDefinition` / `updateRuleDefinition`

### 默认数据（`defaults.ts`）
- [x] `defaultRuleDefs()` 含 3 条守则（S1 已完成）

### UI（`App.tsx`）
- [x] today 页「执行守则」卡片：列出 `ruleDefs` 中 `do` 守则
- [x] 「好奇清单」快速输入 + 列表；`relaxWindows` 激活时提示"现在可以消化"
- [~] 设置页守则增删改 UI — actions 已具备，today 卡片已展示；设置页编辑入口可后续补（不影响 DoD）

## 单元测试（`src/hooks/__tests__/useLifeApp.curiosity.test.ts`）
- [x] 好奇清单 CRUD（含跳过空串、归档、删除）
- [x] 默认含 3 条守则；`updateRuleDefinition`/`removeRuleDefinition` 生效

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 M2 并记日志
