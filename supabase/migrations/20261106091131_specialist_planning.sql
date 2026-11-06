-- Individual sessions, skill goals and short notes for center families.

create table public.center_sessions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  specialist_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes smallint not null default 45 check (duration_minutes between 15 and 180),
  topic text not null check (char_length(btrim(topic)) between 2 and 120),
  status text not null default 'planned' check (status in ('planned', 'present', 'absent', 'cancelled')),
  created_at timestamptz not null default now(),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete cascade
);

create table public.center_skill_goals (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  skill_key text not null check (skill_key in ('joint_attention', 'understanding', 'imitation', 'communication', 'play_thinking', 'fine_motor', 'regulation', 'daily_social')),
  summary text not null check (char_length(btrim(summary)) between 5 and 180),
  target_level smallint not null check (target_level between 1 and 3),
  target_date date,
  status text not null default 'active' check (status in ('active', 'achieved', 'paused')),
  created_at timestamptz not null default now(),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete cascade
);

create table public.center_child_notes (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  audience text not null default 'team' check (audience in ('team', 'family')),
  content text not null check (char_length(btrim(content)) between 3 and 500),
  created_at timestamptz not null default now(),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete cascade
);

create index center_sessions_child_time_idx on public.center_sessions(child_id, starts_at desc);
create index center_skill_goals_child_idx on public.center_skill_goals(child_id, created_at desc);
create index center_child_notes_child_idx on public.center_child_notes(child_id, created_at desc);

alter table public.center_sessions enable row level security;
alter table public.center_skill_goals enable row level security;
alter table public.center_child_notes enable row level security;
revoke all on public.center_sessions, public.center_skill_goals, public.center_child_notes from public, anon, authenticated;
grant select, insert on public.center_sessions, public.center_skill_goals to authenticated;
grant update(status) on public.center_sessions, public.center_skill_goals to authenticated;
grant select, insert on public.center_child_notes to authenticated;

create policy center_sessions_read on public.center_sessions for select to authenticated
  using ((select private.center_can_view_child(center_id, child_id))
    or exists (select 1 from public.children c where c.id = child_id and c.parent_id = (select auth.uid()))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy center_sessions_insert on public.center_sessions for insert to authenticated
  with check (specialist_id = (select auth.uid()) and (select private.center_can_view_child(center_id, child_id)));
create policy center_sessions_update on public.center_sessions for update to authenticated
  using ((specialist_id = (select auth.uid()) or (select private.center_role(center_id)) = 'admin')
    and (select private.center_can_view_child(center_id, child_id)))
  with check ((specialist_id = (select auth.uid()) or (select private.center_role(center_id)) = 'admin')
    and (select private.center_can_view_child(center_id, child_id)));

create policy center_skill_goals_read on public.center_skill_goals for select to authenticated
  using ((select private.center_can_view_child(center_id, child_id))
    or exists (select 1 from public.children c where c.id = child_id and c.parent_id = (select auth.uid()))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy center_skill_goals_insert on public.center_skill_goals for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.center_can_view_child(center_id, child_id)));
create policy center_skill_goals_update on public.center_skill_goals for update to authenticated
  using ((created_by = (select auth.uid()) or (select private.center_role(center_id)) = 'admin')
    and (select private.center_can_view_child(center_id, child_id)))
  with check ((created_by = (select auth.uid()) or (select private.center_role(center_id)) = 'admin')
    and (select private.center_can_view_child(center_id, child_id)));

create policy center_child_notes_read on public.center_child_notes for select to authenticated
  using ((select private.center_can_view_child(center_id, child_id))
    or (audience = 'family' and exists (select 1 from public.children c where c.id = child_id and c.parent_id = (select auth.uid())))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy center_child_notes_insert on public.center_child_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.center_can_view_child(center_id, child_id)));

