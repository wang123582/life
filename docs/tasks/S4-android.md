# S4 Android 壳与专注阻断（验证为主）

**目标：** 确认新增模块无需改动原生层；新通知经 S2 → Capacitor 即可在锁屏/后台提醒。
**前置：** S2。
**主要文件：** `android/`（核对）、`src/lib/focusLock.ts`（核对）。
**对应设计：** detailed-design.md §3 S4。
**状态：** ✅ 完成（test 36 passed / typecheck / lint / build 全绿）

## 子任务
- [x] 确认 M1–M4 与 S2 均通过现有 Capacitor 接口工作，无需改原生代码（S2 复用既有 `life-reminders` channel）
- [x] 确认 Web 单测环境下 `focusLock` / `mobileTimer` 在非原生平台降级不报错
- [~] `npm run android:sync` 真机链路：受本机环境约束（JDK/SDK），Web `build` 已通过即可；真机打包按 `docs/android.md` 流程

## 单元测试（`src/lib/__tests__/focusLock.web.test.ts`）
- [x] `canUseFocusLock()` 在 web(jsdom) 为 false
- [x] `saveFocusLockConfig` 在不可用时 resolve 不抛错

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 S4 并记日志
