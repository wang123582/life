# Supabase 同步配置

## 目标

让手机和电脑共用同一份 `life` 数据。

## 第一步：创建 Supabase 项目

1. 打开 Supabase
2. 新建一个 project
3. 等它初始化完成

## 第二步：拿到两个值

在项目设置里找到：

- `Project URL`
- `anon public key`

把它们分别填到：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 第三步：本地开发时配置 `.env`

项目根目录已经准备好了 `.env` 占位：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

把占位内容换成你自己的值。

## 第四步：部署环境也要配

如果你现在用的是 Cloudflare Pages，还要去 Pages 项目设置里加同样两个环境变量：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

否则线上页面虽然有同步入口，但不会真的连上云端。

## 第五步：执行建表 SQL

在 Supabase 的 SQL Editor 里执行下面这段：

```sql
create table if not exists public.life_snapshots (
  space_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.life_snapshots enable row level security;

create policy if not exists "allow anon read snapshots"
on public.life_snapshots
for select
using (true);

create policy if not exists "allow anon write snapshots"
on public.life_snapshots
for insert
with check (true);

create policy if not exists "allow anon update snapshots"
on public.life_snapshots
for update
using (true)
with check (true);
```

## 第六步：在应用里绑定手机和电脑

1. 打开 `模板 -> 设备 / 同步 / 提醒`
2. 在第一台设备上点 `生成同步码`
3. 点 `上传这台设备数据`
4. 在第二台设备填同一个同步码
5. 点 `从云端拉下来`

## 测试方法

最简单的测试顺序：

1. 电脑上新建一个今天任务
2. 点上传
3. 手机上点拉取
4. 看手机是否出现同一条任务

如果能看到，就说明同步已经通了。
