# T0 工具链基建

**目标：** 为现有 TS 项目补齐"单元测试 + 类型检查 + 静态检查"工具链，作为所有模块 DoD 的执行基础。
**前置：** 无（最先执行）。
**主要文件：** `package.json`、`vitest.config.ts`、`vitest.setup.ts`、`eslint.config.js`、`tsconfig*.json`。

## 子任务

- [x] 安装 devDependencies：`vitest`、`jsdom`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`eslint`、`typescript-eslint`、`eslint-plugin-react-hooks`、`eslint-plugin-react-refresh`、`@vitest/coverage-v8`
- [x] 新增 `vitest.config.ts`：`environment: 'jsdom'`、`globals: true`、`setupFiles: ['./vitest.setup.ts']`、复用 `@vitejs/plugin-react`
- [x] 新增 `vitest.setup.ts`：`import '@testing-library/jest-dom'`
- [x] 新增 `eslint.config.js`（flat config）：TS + react-hooks 规则，忽略 `dist/`、`android/`、`.tools/`
- [x] `package.json` 增加脚本：`"test"`、`"test:watch"`、`"typecheck": "tsc --noEmit -p tsconfig.app.json"`、`"lint": "eslint ."`
- [x] 写一个 smoke 测试 `src/__tests__/smoke.test.ts` 验证 vitest 跑通
- [x] 确认 `localStorage` / `crypto.randomUUID` 在 jsdom 下可用

## 验收（DoD）

- [x] `npm run test` 绿（3 passed）
- [x] `npm run typecheck` 无错
- [x] `npm run lint` 无错（0 errors，3 处既有 react-hooks 告警，未关闭规则）
- [x] `npm run build` 仍通过

## 完成后

- [x] 在 `docs/tasks/progress.md` 勾选 T0，并追加进度日志一行
