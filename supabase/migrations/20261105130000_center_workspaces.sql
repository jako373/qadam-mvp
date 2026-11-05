-- Add center workspaces without changing existing parent accounts or child history.
begin;
create table if not exists public.centers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug) between 2 and 64),
  name text not null check (length(name) between 2 and 160),
  created_at timestamptz not null default now()
);

create table if not exists public.center_staff (
  center_id uuid not null references public.centers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'specialist')),
  full_name text not null check (length(full_name) between 2 and 160),
  specialty text check (specialty is null or length(specialty) <= 120),
  created_at timestamptz not null default now(),
  primary key (center_id, user_id)
);

create table if not exists public.center_groups (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (center_id, id)
);

create table if not exists public.center_students (
  center_id uuid not null references public.centers(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  primary key (center_id, child_id)
);

create table if not exists public.center_group_students (
  center_id uuid not null,
  group_id uuid not null,
  child_id uuid not null,
  primary key (center_id, group_id, child_id),
  foreign key (center_id, group_id) references public.center_groups(center_id, id) on delete cascade,
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete cascade
);

create table if not exists public.center_group_specialists (
  center_id uuid not null,
  group_id uuid not null,
  user_id uuid not null,
  primary key (center_id, group_id, user_id),
  foreign key (center_id, group_id) references public.center_groups(center_id, id) on delete cascade,
  foreign key (center_id, user_id) references public.center_staff(center_id, user_id) on delete cascade
);

create table if not exists public.specialist_assessments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  specialist_id uuid references auth.users(id) on delete set null,
  specialist_name text not null check (length(specialist_name) between 2 and 160),
  assessment_type text not null check (assessment_type in ('initial', 'reassessment')),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  skill_levels jsonb not null check (jsonb_typeof(skill_levels) = 'object'),
  completed_at timestamptz not null default now(),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id)
);

create index if not exists center_group_specialists_user_idx on public.center_group_specialists(user_id, center_id);
create index if not exists center_group_students_child_idx on public.center_group_students(child_id, center_id);
create index if not exists specialist_assessments_child_idx on public.specialist_assessments(child_id, completed_at desc);

create or replace function private.center_role(p_center_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.center_staff
  where center_id = p_center_id and user_id = (select auth.uid());
$$;

create or replace function private.center_can_view_child(p_center_id uuid, p_child_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.center_students cs
    join public.center_staff staff on staff.center_id = cs.center_id
      and staff.user_id = (select auth.uid())
    where cs.center_id = p_center_id and cs.child_id = p_child_id and cs.active
      and (staff.role = 'admin' or exists (
        select 1 from public.center_group_students gs
        join public.center_group_specialists sp on sp.center_id = gs.center_id
          and sp.group_id = gs.group_id and sp.user_id = staff.user_id
        where gs.center_id = cs.center_id and gs.child_id = cs.child_id
      ))
  );
$$;

revoke all on function private.center_role(uuid) from public, anon;
revoke all on function private.center_can_view_child(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.center_role(uuid), private.center_can_view_child(uuid, uuid) to authenticated;

alter table public.centers enable row level security;
alter table public.center_staff enable row level security;
alter table public.center_groups enable row level security;
alter table public.center_students enable row level security;
alter table public.center_group_students enable row level security;
alter table public.center_group_specialists enable row level security;
alter table public.specialist_assessments enable row level security;

revoke all on public.centers, public.center_staff, public.center_groups,
  public.center_students, public.center_group_students, public.center_group_specialists,
  public.specialist_assessments from anon, authenticated;
grant select on public.centers, public.center_staff, public.center_students to authenticated;
grant select, insert, update, delete on public.center_groups,
  public.center_group_students, public.center_group_specialists to authenticated;
grant select, insert on public.specialist_assessments to authenticated;

create policy centers_read on public.centers for select to authenticated
  using ((select private.center_role(id)) is not null or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy staff_read on public.center_staff for select to authenticated
  using (user_id = (select auth.uid()) or (select private.center_role(center_id)) = 'admin'
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy groups_read on public.center_groups for select to authenticated
  using ((select private.center_role(center_id)) = 'admin'
    or exists (select 1 from public.center_group_specialists sp where sp.group_id = id and sp.user_id = (select auth.uid()))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy groups_admin_write on public.center_groups for all to authenticated
  using ((select private.center_role(center_id)) = 'admin')
  with check ((select private.center_role(center_id)) = 'admin');
create policy students_read on public.center_students for select to authenticated
  using ((select private.center_can_view_child(center_id, child_id))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy group_students_read on public.center_group_students for select to authenticated
  using ((select private.center_role(center_id)) = 'admin'
    or exists (select 1 from public.center_group_specialists sp
      where sp.center_id = center_group_students.center_id
        and sp.group_id = center_group_students.group_id and sp.user_id = (select auth.uid()))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy group_students_admin_write on public.center_group_students for all to authenticated
  using ((select private.center_role(center_id)) = 'admin')
  with check ((select private.center_role(center_id)) = 'admin');
create policy group_specialists_read on public.center_group_specialists for select to authenticated
  using (user_id = (select auth.uid()) or (select private.center_role(center_id)) = 'admin'
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy group_specialists_admin_write on public.center_group_specialists for all to authenticated
  using ((select private.center_role(center_id)) = 'admin')
  with check ((select private.center_role(center_id)) = 'admin');
create policy specialist_assessments_read on public.specialist_assessments for select to authenticated
  using ((select private.center_can_view_child(center_id, child_id))
    or exists (select 1 from public.children c where c.id = child_id and c.parent_id = (select auth.uid()))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy specialist_assessments_insert on public.specialist_assessments for insert to authenticated
  with check (specialist_id = (select auth.uid())
    and (select private.center_can_view_child(center_id, child_id))
    and specialist_name = (select full_name from public.center_staff
      where center_id = specialist_assessments.center_id and user_id = (select auth.uid())));

create policy center_staff_children_read on public.children for select to authenticated
  using (exists (select 1 from public.center_students cs where cs.child_id = id
    and (select private.center_can_view_child(cs.center_id, cs.child_id))));
create policy center_staff_parent_assessments_read on public.skill_assessments for select to authenticated
  using (exists (select 1 from public.center_students cs where cs.child_id = skill_assessments.child_id
    and (select private.center_can_view_child(cs.center_id, cs.child_id))));

-- Staff membership changes go through this checked RPC; direct table writes stay denied.
create or replace function public.center_set_staff(
  p_center_id uuid, p_email text, p_role text, p_full_name text, p_specialty text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  if coalesce((select private.center_role(p_center_id)), '') <> 'admin'
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'superadmin' then
    raise exception 'center admin required' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'specialist') or length(trim(p_full_name)) not between 2 and 160 then
    raise exception 'invalid staff details' using errcode = '22023';
  end if;
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then raise exception 'user not found' using errcode = 'P0002'; end if;
  if v_user_id = (select auth.uid()) and p_role <> 'admin'
    and (select private.center_role(p_center_id)) = 'admin' then
    raise exception 'cannot demote own center admin role' using errcode = '22023';
  end if;
  if p_role <> 'admin' and exists (
    select 1 from public.center_staff where center_id = p_center_id and user_id = v_user_id and role = 'admin'
  ) and (select count(*) from public.center_staff where center_id = p_center_id and role = 'admin') <= 1 then
    raise exception 'cannot demote last center admin' using errcode = '22023';
  end if;
  insert into public.center_staff(center_id, user_id, role, full_name, specialty)
    values (p_center_id, v_user_id, p_role, trim(p_full_name), nullif(trim(p_specialty), ''))
    on conflict (center_id, user_id) do update set role = excluded.role,
      full_name = excluded.full_name, specialty = excluded.specialty;
  return v_user_id;
end;
$$;

create or replace function public.center_remove_staff(p_center_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select private.center_role(p_center_id)), '') <> 'admin'
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'superadmin' then
    raise exception 'center admin required' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot remove own center access' using errcode = '22023';
  end if;
  if exists (select 1 from public.center_staff where center_id = p_center_id and user_id = p_user_id and role = 'admin')
    and (select count(*) from public.center_staff where center_id = p_center_id and role = 'admin') <= 1 then
    raise exception 'cannot remove last center admin' using errcode = '22023';
  end if;
  delete from public.center_staff where center_id = p_center_id and user_id = p_user_id;
end;
$$;

revoke all on function public.center_set_staff(uuid, text, text, text, text), public.center_remove_staff(uuid, uuid) from public, anon;
grant execute on function public.center_set_staff(uuid, text, text, text, text), public.center_remove_staff(uuid, uuid) to authenticated;

insert into public.centers(slug, name) values ('qadam-pilot', 'Qadam орталығы')
  on conflict (slug) do nothing;
insert into public.center_staff(center_id, user_id, role, full_name, specialty)
select c.id, u.id, seed.role, seed.full_name, seed.specialty
from public.centers c
join (values
  ('aiganym.11.95@mail.ru', 'admin', 'Козбакарова Айғаным Аралбайқызы', 'Орталықтың негізін қалаушы'),
  ('zinesh.96@mail.ru', 'specialist', 'Мұхамбетова Зинеш Муратқызы', 'БОС-терапевт'),
  ('ibniyagaziza@mail.ru', 'specialist', 'Ібния Ғазиза Таңатқызы', 'Дефектолог'),
  ('kozbakarova.1997@mail.ru', 'specialist', 'Козбакарова Гулжазира Аралбаевна', 'Логопед')
) as seed(email, role, full_name, specialty) on true
join auth.users u on lower(u.email) = seed.email
where c.slug = 'qadam-pilot'
on conflict (center_id, user_id) do nothing;
commit;
