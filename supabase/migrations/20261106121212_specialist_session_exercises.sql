-- A specialist records a catalogue exercise against one scheduled lesson.
-- Parent practice remains in exercise_attempts; these observations are separate.
create table if not exists public.center_session_exercises (
  session_id uuid not null references public.center_sessions(id) on delete cascade,
  exercise_id text not null references public.exercise_catalog(id),
  outcome text not null check (outcome in ('independent', 'assisted', 'unable', 'refused')),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  primary key (session_id, exercise_id)
);

create index if not exists center_session_exercises_recorded_at_idx on public.center_session_exercises(recorded_at desc);
alter table public.center_session_exercises enable row level security;
revoke all on public.center_session_exercises from public, anon, authenticated;
grant select, insert, update(outcome, recorded_at) on public.center_session_exercises to authenticated;

drop policy if exists center_session_exercises_read on public.center_session_exercises;
create policy center_session_exercises_read on public.center_session_exercises
for select to authenticated using (
  exists (
    select 1 from public.center_sessions s
    where s.id = session_id and (
      (select private.center_can_view_child(s.center_id, s.child_id))
      or exists (select 1 from public.children c where c.id = s.child_id and c.parent_id = (select auth.uid()))
      or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    )
  )
);

drop policy if exists center_session_exercises_insert on public.center_session_exercises;
create policy center_session_exercises_insert on public.center_session_exercises
for insert to authenticated with check (
  recorded_by = (select auth.uid())
  and exists (
    select 1 from public.center_sessions s
    join public.exercise_catalog e on e.id = exercise_id and e.status = 'active'
    where s.id = session_id
      and s.status not in ('absent', 'cancelled')
      and (s.specialist_id = (select auth.uid()) or (select private.center_role(s.center_id)) = 'admin')
      and (select private.center_can_view_child(s.center_id, s.child_id))
  )
);

drop policy if exists center_session_exercises_update on public.center_session_exercises;
create policy center_session_exercises_update on public.center_session_exercises
for update to authenticated using (
  exists (
    select 1 from public.center_sessions s
    where s.id = session_id
      and (s.specialist_id = (select auth.uid()) or (select private.center_role(s.center_id)) = 'admin')
      and (select private.center_can_view_child(s.center_id, s.child_id))
  )
) with check (
  exists (
    select 1 from public.center_sessions s
    where s.id = session_id
      and (s.specialist_id = (select auth.uid()) or (select private.center_role(s.center_id)) = 'admin')
      and (select private.center_can_view_child(s.center_id, s.child_id))
  )
);
