-- Nug-Tracker — Supabase schema (run in the Supabase SQL Editor)
--
-- Note vs. the original handover draft: work_sessions.id and life_entries.id are
-- TEXT, not uuid. The app generates its own stable string ids (e.g. "session-..",
-- "life-..") and uses them as the row identity so upserts/sync are idempotent.
-- user_settings is keyed by user_id. RLS restricts every row to its owner.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  standard_work_minutes integer not null default 450,
  week_starts_on integer not null default 1,
  life_targets jsonb not null default '{
    "gym": 270,
    "ableton": 600,
    "touchdesigner": 600,
    "practice": 15,
    "social": 480,
    "free": 480,
    "sleep": 480
  }'::jsonb,
  updated_at timestamptz not null default now(),
  constraint week_starts_on_valid check (week_starts_on in (0, 1)),
  constraint standard_work_minutes_valid check (
    standard_work_minutes > 0 and standard_work_minutes <= 1440
  )
);

create table if not exists public.work_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_session_valid_range check (end_at > start_at)
);

create table if not exists public.life_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  minutes integer not null,
  logged_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_entry_minutes_valid check (minutes > 0),
  constraint life_entry_category_valid check (
    category in ('gym', 'ableton', 'touchdesigner', 'practice', 'social', 'free', 'sleep')
  )
);

create index if not exists work_sessions_user_id_idx on public.work_sessions (user_id);
create index if not exists life_entries_user_id_idx on public.life_entries (user_id);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.work_sessions enable row level security;
alter table public.life_entries enable row level security;

-- profiles
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- user_settings
drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings" on public.user_settings
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings" on public.user_settings
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings" on public.user_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings" on public.user_settings
  for delete to authenticated using (auth.uid() = user_id);

-- work_sessions
drop policy if exists "Users can read own work sessions" on public.work_sessions;
create policy "Users can read own work sessions" on public.work_sessions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own work sessions" on public.work_sessions;
create policy "Users can insert own work sessions" on public.work_sessions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own work sessions" on public.work_sessions;
create policy "Users can update own work sessions" on public.work_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own work sessions" on public.work_sessions;
create policy "Users can delete own work sessions" on public.work_sessions
  for delete to authenticated using (auth.uid() = user_id);

-- life_entries
drop policy if exists "Users can read own life entries" on public.life_entries;
create policy "Users can read own life entries" on public.life_entries
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own life entries" on public.life_entries;
create policy "Users can insert own life entries" on public.life_entries
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own life entries" on public.life_entries;
create policy "Users can update own life entries" on public.life_entries
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own life entries" on public.life_entries;
create policy "Users can delete own life entries" on public.life_entries
  for delete to authenticated using (auth.uid() = user_id);
