# S3 同步（Supabase 快照 + 飞书报文）

**目标：** 新增字段随整棵 `LifeAppData` 快照同步（接口不变）；飞书复盘报文补充"明日三件事 / 情绪评分"。
**前置：** S1、M3。
**主要文件：** `src/lib/sync.ts`（核对）、`src/lib/feishu.ts`。
**对应设计：** detailed-design.md §3 S3。
**状态：** ✅ 完成（test 34 passed / typecheck / lint / build 全绿）

## 子任务
- [x] 核对 `sync.ts`：快照为整棵 `LifeAppData`，`curiosityItems` / 新 review 字段 / 新 settings 自动随 push/pull 同步，无需改动
- [x] `feishu.ts`：新增 `buildReviewExtraLines`，在卡片正文(`buildParagraphs`)与预览(`buildReportPreviewText`)输出"明日三件事 / 情绪评分"，缺省时优雅跳过

## 单元测试（`src/lib/__tests__/feishu.test.ts`）
- [x] 含 `tomorrowTop3`/`moodScore` 时输出对应行（trim、过滤空串）
- [x] 缺省 / 全空 / null 时输出空数组

## 验收（DoD）
- [x] test / typecheck / lint / build 全绿
- [x] 在 `progress.md` 勾选 S3 并记日志
