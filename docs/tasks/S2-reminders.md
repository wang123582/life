# S2 提醒与通知调度

**目标：** 统一封装"每日定时本地通知"，支撑 M3 复盘(22:30)/收工(23:00) 提醒（M1 晨间、M2 守则可后续接入）。
**前置：** S1；与 M3 联动。
**主要文件：** `src/lib/mobileTimer.ts`、`src/App.tsx`（调度触发 effect）。
**对应设计：** detailed-design.md §3 S2。
**状态：** ✅ 完成（test 32 passed / typecheck / lint / build 全绿）

## 子任务
- [x] `scheduleDailyReminder(id, time, title, body)` / `cancelDailyReminder(id)`（复用 `life-reminders` channel；`DAILY_REMINDER_IDS`）
- [x] `syncEveningReminders(settings)`：按 `reviewReminderEnabled/Time`（22:30）、`hardStopEnabled/Time`（23:00）注册/取消
- [x] App.tsx effect：设置变化时刷新已注册提醒
- [x] 非原生环境 no-op（`Capacitor.isNativePlatform()===false`）
- [~] 晨间锚点 / 执行守则提醒 — 封装已通用，可后续按同样方式接入

## 单元测试（`src/lib/__tests__/mobileTimer.reminders.test.ts`）
- [x] mock LocalNotifications：按时间注册正确 id/hour/minute（22:30 / 23:00）
- [x] 关闭开关时只取消、不调度
- [x] 非原生环境不调度、不取消

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 S2 并记日志
