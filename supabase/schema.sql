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
    diagnosis in (
      'ЗРР',
      'ЗПР',
      'ЗПРР',
      'ОНР 1',
      'ОНР 2',
      'ОНР 3',
      'ОНР 4',
      'ОНР 1-4 (нақтылау керек / нужно уточнить)',
      'Диагноз жоқ / Диагноза нет',
      'Басқа / Другое'
    )
  ),
  home_language text not null,
  meaningful_words text not null,
  interests text check (interests is null or char_length(interests) <= 240),
  dislikes text check (dislikes is null or char_length(dislikes) <= 240),
  best_time text check (best_time is null or char_length(best_time) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_home_language_check check (
    home_language in ('Қазақша', 'Русский', 'Қазақша және Русский', 'Басқа / Другое')
  ),
  constraint children_meaningful_words_check check (
    meaningful_words in (
      'Сөз қолданбайды / Не использует слова',
      '1-10 сөз / 1-10 слов',
      '11-30 сөз / 11-30 слов',
      '31-100 сөз / 31-100 слов',
      '100-ден көп / Более 100'
    )
  ),
  constraint children_id_parent_unique unique (id, parent_id)
);

create table if not exists public.skill_assessments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null,
  assessment_type text not null check (assessment_type in ('initial', 'reassessment')),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  skill_levels jsonb not null check (jsonb_typeof(skill_levels) = 'object'),
  completed_at timestamptz not null default now(),
  constraint skill_assessments_child_owner_fk
    foreign key (child_id, parent_id) references public.children(id, parent_id) on delete cascade
);

create table if not exists public.child_skill_levels (
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null,
  category text not null check (
    category in (
      'joint_attention',
      'understanding',
      'imitation',
      'communication',
      'play_thinking',
      'fine_motor',
      'regulation',
      'daily_social'
    )
  ),
  level smallint not null check (level between 1 and 3),
  updated_at timestamptz not null default now(),
  primary key (child_id, category),
  constraint child_skill_levels_child_owner_fk
    foreign key (child_id, parent_id) references public.children(id, parent_id) on delete cascade
);

create table if not exists public.child_exercise_progress (
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null,
  exercise_id text not null check (
    exercise_id ~ '^(joint_attention|understanding|imitation|communication|play_thinking|fine_motor|regulation|daily_social)-(0[1-9]|1[0-5])$'
  ),
  independent_count integer not null default 0 check (independent_count >= 0),
  unable_streak integer not null default 0 check (unable_streak >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  last_outcome text check (last_outcome in ('independent', 'assisted', 'unable', 'refused')),
  last_attempted_on date,
  introduced_at timestamptz not null default now(),
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (child_id, exercise_id),
  constraint child_exercise_progress_child_owner_fk
    foreign key (child_id, parent_id) references public.children(id, parent_id) on delete cascade
);

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null,
  plan_date date not null,
  items jsonb not null check (
    case
      when jsonb_typeof(items) = 'array' then jsonb_array_length(items) = 3
      else false
    end
  ),
  results jsonb not null default '{}'::jsonb check (jsonb_typeof(results) = 'object'),
  viewed_count smallint not null default 0 check (viewed_count between 0 and 3),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, plan_date),
  constraint daily_plans_child_owner_fk
    foreign key (child_id, parent_id) references public.children(id, parent_id) on delete cascade
);

create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null,
  exercise_id text not null check (
    exercise_id ~ '^(joint_attention|understanding|imitation|communication|play_thinking|fine_motor|regulation|daily_social)-(0[1-9]|1[0-5])$'
  ),
  category text not null check (
    category in (
      'joint_attention',
      'understanding',
      'imitation',
      'communication',
      'play_thinking',
      'fine_motor',
      'regulation',
      'daily_social'
    )
  ),
  exercise_level smallint not null check (exercise_level between 1 and 3),
  outcome text not null check (outcome in ('independent', 'assisted', 'unable', 'refused')),
  score smallint check (
    (outcome = 'refused' and score is null)
    or (outcome <> 'refused' and score between 0 and 2)
  ),
  attempted_on date not null,
  created_at timestamptz not null default now(),
  constraint exercise_attempts_child_owner_fk
    foreign key (child_id, parent_id) references public.children(id, parent_id) on delete cascade
);

create index if not exists children_parent_id_idx on public.children(parent_id);
create index if not exists skill_assessments_parent_child_completed_idx
  on public.skill_assessments(parent_id, child_id, completed_at desc);
create index if not exists child_skill_levels_parent_child_idx
  on public.child_skill_levels(parent_id, child_id);
create index if not exists child_exercise_progress_parent_child_idx
  on public.child_exercise_progress(parent_id, child_id);
create index if not exists daily_plans_parent_child_date_idx
  on public.daily_plans(parent_id, child_id, plan_date desc);
create index if not exists exercise_attempts_parent_child_date_idx
  on public.exercise_attempts(parent_id, child_id, attempted_on desc);

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.skill_assessments enable row level security;
alter table public.child_skill_levels enable row level security;
alter table public.child_exercise_progress enable row level security;
alter table public.daily_plans enable row level security;
alter table public.exercise_attempts enable row level security;

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

drop policy if exists "skill_assessments_select_own" on public.skill_assessments;
create policy "skill_assessments_select_own"
on public.skill_assessments for select
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "skill_assessments_insert_own" on public.skill_assessments;
create policy "skill_assessments_insert_own"
on public.skill_assessments for insert
to authenticated
with check ((select auth.uid()) = parent_id);

drop policy if exists "child_skill_levels_select_own" on public.child_skill_levels;
create policy "child_skill_levels_select_own"
on public.child_skill_levels for select
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "child_skill_levels_insert_own" on public.child_skill_levels;
create policy "child_skill_levels_insert_own"
on public.child_skill_levels for insert
to authenticated
with check ((select auth.uid()) = parent_id);

drop policy if exists "child_skill_levels_update_own" on public.child_skill_levels;
create policy "child_skill_levels_update_own"
on public.child_skill_levels for update
to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);

drop policy if exists "child_exercise_progress_select_own" on public.child_exercise_progress;
create policy "child_exercise_progress_select_own"
on public.child_exercise_progress for select
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "child_exercise_progress_insert_own" on public.child_exercise_progress;
create policy "child_exercise_progress_insert_own"
on public.child_exercise_progress for insert
to authenticated
with check ((select auth.uid()) = parent_id);

drop policy if exists "child_exercise_progress_update_own" on public.child_exercise_progress;
create policy "child_exercise_progress_update_own"
on public.child_exercise_progress for update
to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);

drop policy if exists "daily_plans_select_own" on public.daily_plans;
create policy "daily_plans_select_own"
on public.daily_plans for select
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "daily_plans_insert_own" on public.daily_plans;
create policy "daily_plans_insert_own"
on public.daily_plans for insert
to authenticated
with check ((select auth.uid()) = parent_id);

drop policy if exists "daily_plans_update_own" on public.daily_plans;
create policy "daily_plans_update_own"
on public.daily_plans for update
to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);

drop policy if exists "exercise_attempts_select_own" on public.exercise_attempts;
create policy "exercise_attempts_select_own"
on public.exercise_attempts for select
to authenticated
using ((select auth.uid()) = parent_id);

drop policy if exists "exercise_attempts_insert_own" on public.exercise_attempts;
create policy "exercise_attempts_insert_own"
on public.exercise_attempts for insert
to authenticated
with check ((select auth.uid()) = parent_id);

revoke all on public.profiles from anon, authenticated;
revoke all on public.children from anon, authenticated;
revoke all on public.skill_assessments from anon, authenticated;
revoke all on public.child_skill_levels from anon, authenticated;
revoke all on public.child_exercise_progress from anon, authenticated;
revoke all on public.daily_plans from anon, authenticated;
revoke all on public.exercise_attempts from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.children to authenticated;
grant select, insert on public.skill_assessments to authenticated;
grant select, insert, update on public.child_skill_levels to authenticated;
grant select, insert, update on public.child_exercise_progress to authenticated;
grant select, insert, update on public.daily_plans to authenticated;
grant select, insert on public.exercise_attempts to authenticated;
