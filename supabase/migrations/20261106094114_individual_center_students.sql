-- Individual assignments do not require a group. Removing an assignment never deletes
-- the child's family account, assessments, goals, notes, or session history.
create table public.center_specialist_students (
  center_id uuid not null,
  child_id uuid not null,
  specialist_id uuid not null,
  child_name text not null check (char_length(btrim(child_name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (center_id, child_id, specialist_id),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete cascade,
  foreign key (center_id, specialist_id) references public.center_staff(center_id, user_id) on delete cascade
);
create index center_specialist_students_owner_idx on public.center_specialist_students(specialist_id, active);
alter table public.center_specialist_students enable row level security;
revoke all on public.center_specialist_students from public, anon, authenticated;
grant select, update(active) on public.center_specialist_students to authenticated;
create policy center_specialist_students_read on public.center_specialist_students for select to authenticated
  using (specialist_id = (select auth.uid()) or (select private.center_role(center_id)) = 'admin'
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy center_specialist_students_update on public.center_specialist_students for update to authenticated
  using (specialist_id = (select auth.uid()) or (select private.center_role(center_id)) = 'admin')
  with check (specialist_id = (select auth.uid()) or (select private.center_role(center_id)) = 'admin');

create or replace function private.center_can_view_child(p_center_id uuid, p_child_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.center_students cs
    join public.center_staff staff on staff.center_id = cs.center_id and staff.user_id = (select auth.uid())
    where cs.center_id = p_center_id and cs.child_id = p_child_id and cs.active
      and (staff.role = 'admin' or exists (
        select 1 from public.center_group_students gs
        join public.center_group_specialists sp on sp.center_id = gs.center_id
          and sp.group_id = gs.group_id and sp.user_id = staff.user_id
        where gs.center_id = cs.center_id and gs.child_id = cs.child_id
      ) or exists (
        select 1 from public.center_specialist_students individual
        where individual.center_id = cs.center_id and individual.child_id = cs.child_id
          and individual.specialist_id = staff.user_id and individual.active
      ))
  );
$$;

-- Staff may reschedule and add a family-visible lesson outcome, but cannot
-- change ownership or the child on an existing session.
alter table public.center_sessions add column session_summary text
  check (session_summary is null or char_length(btrim(session_summary)) between 3 and 500);
alter table public.center_sessions add column completed_at timestamptz;
grant update(starts_at, duration_minutes, topic, status, session_summary, completed_at)
  on public.center_sessions to authenticated;
