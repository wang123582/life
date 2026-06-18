# M5 核心原则展示

**目标：** 固定展示 proposal §5 的 6 条核心原则，**不可编辑、不可关闭**。
**前置：** T0。
**主要文件：** `src/lib/principles.ts`（新增）、`src/App.tsx`（设置页）。
**对应设计：** detailed-design.md M5。
**状态：** ✅ 完成（test 10 passed / typecheck / lint / build 全绿）

## 子任务
- [x] 新增 `src/lib/principles.ts`：`CORE_PRINCIPLES`（6 条，`as const`）
- [x] 设置页（templates Tab）只读「核心原则」区块，无编辑控件（`<ol>` 文本列表）
- [x] 与 M2 可编辑「执行守则」文案区分（subtitle 注明"固定内置、不可修改"）
- [ ] （可选）today 页底部展示 1 条原则提示 — 暂未做

## 单元测试（`src/lib/__tests__/principles.test.ts`）
- [x] `CORE_PRINCIPLES` 长度 6、逐条内容与顺序一致
- [~] 组件渲染测试：因 App.tsx 为单体大文件、渲染需大量依赖，改以 lib 常量测试 + typecheck/build 保证 JSX 编译；只读结构由 `<ol>` 文本保证（无 input/button）

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 M5 并记日志
