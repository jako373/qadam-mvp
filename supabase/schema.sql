-- Qadam MVP future backend schema.
-- Run this in Supabase SQL Editor after creating a Supabase project.
-- Sensitive parent/child data is protected with RLS. Do not expose service_role keys in the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  preferred_language text not null default 'kk' check (preferred_language in ('kk', 'ru')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  age smallint not null check (age between 2 and 7),
  diagnosis text not null check (
    diagnosis in ('ЗРР', 'ЗПР', 'ЗПРР', 'ОНР', 'Диагноз жоқ / Диагноза нет', 'Басқа / Другое')
  ),
  home_language text not null,
  meaningful_words text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  lesson_id text not null,
  status text not null default 'unlocked' check (status in ('locked', 'unlocked', 'completed')),
  selected_pathway text check (selected_pathway in ('interaction', 'understanding', 'firstWords', 'wordCombination')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, lesson_id)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  lesson_id text not null,
  answers jsonb not null,
  scores jsonb,
  selected_pathway text check (selected_pathway in ('interaction', 'understanding', 'firstWords', 'wordCombination')),
  assigned_lesson_id text,
  completed_at timestamptz not null default now()
);

create index if not exists children_parent_id_idx on public.children(parent_id);
create index if not exists lesson_progress_parent_child_idx on public.lesson_progress(parent_id, child_id);
create index if not exists assessments_parent_child_idx on public.assessments(parent_id, child_id);

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assessments enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "children_select_own" on public.children;
create policy "children_select_own"
on public.children for select
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "children_insert_own" on public.children;
create policy "children_insert_own"
on public.children for insert
to authenticated
with check ((select auth.uid()) = parent_id);

drop policy if exists "children_update_own" on public.children;
create policy "children_update_own"
on public.children for update
to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);

drop policy if exists "children_delete_own" on public.children;
create policy "children_delete_own"
on public.children for delete
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "lesson_progress_select_own" on public.lesson_progress;
create policy "lesson_progress_select_own"
on public.lesson_progress for select
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "lesson_progress_insert_own" on public.lesson_progress;
create policy "lesson_progress_insert_own"
on public.lesson_progress for insert
to authenticated
with check ((select auth.uid()) = parent_id);

drop policy if exists "lesson_progress_update_own" on public.lesson_progress;
create policy "lesson_progress_update_own"
on public.lesson_progress for update
to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);

drop policy if exists "assessments_select_own" on public.assessments;
create policy "assessments_select_own"
on public.assessments for select
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "assessments_insert_own" on public.assessments;
create policy "assessments_insert_own"
on public.assessments for insert
to authenticated
with check ((select auth.uid()) = parent_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.children to authenticated;
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant select, insert on public.assessments to authenticated;
