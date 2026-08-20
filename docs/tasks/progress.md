# 总体进度（Progress）

**工程：** life — 在现有 React 18 + TS + Vite + Capacitor 代码库上，按 `proposal.md` 模块对齐改造。
**测试门槛（每个模块完成的定义 DoD）：** `npm run test`（vitest）全绿 + `npm run typecheck`（tsc --noEmit）无错 + `npm run lint`（eslint）无错 + `npm run build` 通过。

详细任务见各模块文件：`docs/tasks/<编号>-*.md`。

## 依赖与执行顺序

```
T0 工具链  ──→  S1 数据基建  ──┬──→ M5 核心原则
                                ├──→ M1 晨间锚点(硬阻断)
                                ├──→ M3 晚间复盘
                                ├──→ M2 执行守则+好奇清单
                                └──→ M4 进度可视化(纯派生)
                S2 提醒调度  ──→ 支撑 M1/M2/M3 的定时通知
                S3 同步      ──→ 随快照同步新字段 + 飞书报文扩展
                S4 Android   ──→ 基本无改动，验证通知链路
```

## 模块完成状态

- [x] **T0** 工具链基建（vitest / tsc / eslint / scripts） — `docs/tasks/T0-tooling.md`
- [x] **S1** 数据与持久化（types/defaults/storage + 向后兼容） — `docs/tasks/S1-data.md`
- [x] **M5** 核心原则展示（6 条固定内置） — `docs/tasks/M5-core-principles.md`
- [x] **M1** 晨间任务锚点（今日三件事，硬阻断） — `docs/tasks/M1-morning-anchor.md`
- [x] **M3** 晚间复盘与明日规划 — `docs/tasks/M3-evening-review.md`
- [x] **M2** 执行守则与好奇清单 — `docs/tasks/M2-guidelines-curiosity.md`
- [x] **M4** 进度可视化（习惯日历/连续打卡） — `docs/tasks/M4-progress-viz.md`
- [x] **S2** 提醒与通知调度 — `docs/tasks/S2-reminders.md`
- [x] **S3** 同步（Supabase 快照 + 飞书报文） — `docs/tasks/S3-sync.md`
- [x] **S4** Android 壳与专注阻断（验证为主） — `docs/tasks/S4-android.md`

## 已确认的设计取舍

- **D1**：M1 未确认今日三件事前 **硬阻断**，不可进入其它 Tab。
- **D2**：M4 连续打卡有效 = 当日 **完成 ≥1 件 todayItems 或 ≥1 个有效番茄**。
- **D3**：**不引入 Claude API**；守则 2「先思考再问 AI」仅文案引导。
- **工具链**：TypeScript 等价物 — vitest + `tsc --noEmit` + eslint（替代用户最初提到的 pytest/mypy/ruff）。

## 进度日志

> 每个子 Agent 完成模块后，在此追加一行：`YYYY-MM-DD 模块编号 完成 — 测试/类型/lint/build 结果`。

- 2026-06-17 T0 完成 — test 3 passed / typecheck 0 错 / lint 0 错(3 既有告警) / build 通过
- 2026-06-17 S1 完成 — test 8 passed / typecheck 0 错 / lint 0 错 / build 通过（types/defaults/storage 新字段 + 向后兼容测试；defaultRuleDefs 已含 3 条守则）
- 2026-06-17 M5 完成 — test 10 passed / typecheck / lint / build 全绿（principles.ts 6 条 + 设置页只读区块）
- 2026-06-17 M1 完成 — test 13 passed / typecheck / lint / build 全绿（confirm/resetMorningAnchor + isMorningAnchorPending；today 锚点卡片 + 导航硬阻断）
- 2026-06-17 M3 完成 — test 17 passed / typecheck / lint / build 全绿（saveReview 持久化 tomorrowTop3/moodScore + review.ts 衔接helper；复盘表单三件事/明日三件事/情绪评分；设置页复盘提醒/收工时间）
- 2026-06-17 M2 完成 — test 19 passed / typecheck / lint / build 全绿（curiosity CRUD + rule 增改删 actions；today 守则卡片 + 好奇清单）
- 2026-06-17 M4 完成 — test 29 passed / typecheck / lint / build 全绿（stats.ts 纯函数 streak/weekly/heatmap；复盘页进度区块）
- 2026-06-17 S2 完成 — test 32 passed / typecheck / lint / build 全绿（scheduleDailyReminder/cancelDailyReminder/syncEveningReminders + App effect 接线；mock Capacitor 测试；eslint 加 ^_ 忽略）
- 2026-06-17 S3 完成 — test 34 passed / typecheck / lint / build 全绿（快照自动携带新字段；feishu 报文 + 预览加 明日三件事/情绪评分）
- 2026-06-17 S4 完成 — test 36 passed / typecheck / lint / build 全绿（确认无需改原生层；focusLock web 降级测试）
- 2026-06-17 全部模块完成 ✅ — 最终 test 36 passed / typecheck 0 / lint 0 错(3 既有告警) / build 通过
- 2026-08-11 UI 全量重构完成 — test 42 passed / typecheck 0 / lint 0 错(2 既有告警) / build 通过（App.tsx 3341→165 行，拆出 app/ui/views 三层；index.css 换成 token 设计系统，新增浅色模式与底部 Tab；飞书报文统一到 lib/report.ts；新增 App 渲染护栏测试）
- 2026-08-12 视觉重做（第二轮）— test 42 passed / typecheck 0 / lint 0 错(2 既有告警) / build 通过（顶部导航替代侧栏，单栏 660px 版式，计时器三处合一，今天页 9 区块→3 区块+页脚入口，按钮体系收敛为三种；删除 TimePicker 与飞书旧 post 报文分支等死代码）
- 2026-08-12 第三轮视觉：日志本版式 — test 42 passed / typecheck 0 / lint 0 错(2 既有告警) / build 通过（页边栏+正文栏两列结构、字号阶梯重排、等宽数字、DayRule 刻度尺、区块说明文案、次要内容折叠、冷灰蓝纸面配色）
- 2026-08-12 第四轮视觉：方格纸与红铅笔 — test 42 passed / typecheck 0 / lint 0 错(2 既有告警) / build 通过（自托管 Archivo + IBM Plex Mono，方格纸底纹，红铅笔强调色，新增签名元素 DayBar 真实时间轴，移除装饰性 DayRule）
- 2026-08-17 第五轮视觉：手写体 + 落格 — test 42 passed / typecheck 0 / lint 0 错(2 既有告警) / build 通过（Archivo 换成 Caveat+系统楷体的手写体系，按「谁写的」分三套字；--cell 24px 统一纵向节奏，笔记/复盘/步骤三处真横格；红页边线；全站方角 --edge 3px，分段控件与开关改成红笔记号；行列表三栏对齐、长期规则批改记号列、过程笔记版式重做、DayBar 改成画在纸上的尺；修掉 Chrome ::details-content 导致所有 Fold 正文掉进页边栏的布局 bug）
- 2026-08-17 第五轮补刀：一屏减负 — test 42 passed / typecheck 0 / lint 0 错(2 既有告警) / build 通过（区块说明改为「只在空状态/收起时出现」，日常三页常驻说明全删；删鼓励文案及其设置项、任务池建议行、页脚去复盘入口、任务行步数、PAGE_LEDE；已拆步骤的任务其「＋拆一步」退到 hover；清理失效样式 .quiet-row / .pill）
- 2026-08-18 修掉设置页「Supabase 建表 SQL」的浏览器默认黑三角 — test 40 passed / typecheck 0 / lint 0 错(2 既有告警) / build 通过（`details.mini > summary` 漏了 `list-style: none` + `::-webkit-details-marker` 隐藏，是全站唯一没被压掉原生 marker 的 details；顺手删掉上一轮随「核心原则」一起废弃的 `.principles` 样式）
- 2026-08-17 一天一件改造 — test 40 passed（principles.test.ts 随模块一起删）/ typecheck 0 / lint 0 错(2 既有告警) / build 通过（`dailyTemplate.topTaskSlots` 默认 3→1 且旧快照强制回收到 1；晨间锚点/复盘"明日"表单改单槽位；新增 `TaskDefinition.nextStep` 强制字段，任务池/今天快速加一件/晨间锚点三处入口校验非空，主屏展示改为"下一秒手放哪"而非标题；今天页主线收成单一进行中项，其余待做+任务池未启动任务收进新增的「今天不做」摩擦折叠区（`Fold` 新增 `friction` prop，两次点击才展开）；设置页删「本周模板」「核心原则」两个折叠区与「今日几件事」输入框，连带删除 `WeeklyTemplate` 类型/`updateWeeklyTemplate` action/`lib/principles.ts`）
