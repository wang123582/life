import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { LifeAppData } from '../types'

interface RemoteSnapshotRow {
  space_id: string
  payload: LifeAppData
  updated_at: string
  updated_by: string | null
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isPlaceholderSyncValue(value?: string): boolean {
  if (!value) {
    return true
  }

  return value.includes('your-project.supabase.co') || value.includes('your-anon-key')
}

let client: SupabaseClient | null = null

export function isSyncEnvReady(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && !isPlaceholderSyncValue(supabaseUrl) && !isPlaceholderSyncValue(supabaseAnonKey))
}

export function createSyncSpaceId(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
}

function getClient(): SupabaseClient {
  if (!isSyncEnvReady()) {
    throw new Error('还没配置 Supabase。先把 .env 里的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 填上。')
  }

  if (!client) {
    client = createClient(supabaseUrl!, supabaseAnonKey!)
  }

  return client
}

export async function pullRemoteSnapshot(spaceId: string): Promise<LifeAppData | null> {
  const cleanSpaceId = spaceId.trim()
  if (!cleanSpaceId) {
    throw new Error('先填同步空间码。')
  }

  const { data, error } = await getClient()
    .from('life_snapshots')
    .select('space_id, payload, updated_at, updated_by')
    .eq('space_id', cleanSpaceId)
    .maybeSingle<RemoteSnapshotRow>()

  if (error) {
    throw new Error(`拉取云端数据失败：${error.message}`)
  }

  return data?.payload ?? null
}

export async function pushRemoteSnapshot(spaceId: string, payload: LifeAppData, deviceName: string): Promise<void> {
  const cleanSpaceId = spaceId.trim()
  if (!cleanSpaceId) {
    throw new Error('先填同步空间码。')
  }

  const { error } = await getClient()
    .from('life_snapshots')
    .upsert({
      space_id: cleanSpaceId,
      payload,
      updated_at: payload.updatedAt,
      updated_by: deviceName.trim() || '这台设备',
    })

  if (error) {
    throw new Error(`上传云端数据失败：${error.message}`)
  }
}

export const syncSetupSql = `create table if not exists public.life_snapshots (
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
`
