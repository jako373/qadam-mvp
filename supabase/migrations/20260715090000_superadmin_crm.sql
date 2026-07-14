-- Qadam mini CRM, role management, complimentary access, and an unbounded exercise catalogue.

create table if not exists public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_tier text not null default 'standard' check (access_tier in ('standard', 'complimentary', 'blocked')),
  access_until date,
  note text check (note is null or char_length(note) <= 500),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_access enable row level security;
revoke all on public.account_access from anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superadmin'),
    false
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;

create or replace function public.admin_users()
returns table (
  user_id uuid,
  email text,
  account_role text,
  access_tier text,
  access_until date,
  children_count bigint,
  exercise_attempts bigint,
  completed_plans bigint,
  last_activity_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(u.raw_app_meta_data ->> 'role', 'parent'),
    coalesce(a.access_tier, 'standard'),
    a.access_until,
    (select count(*) from public.children c where c.parent_id = u.id),
    (select count(*) from public.exercise_attempts e where e.parent_id = u.id),
    (select count(*) from public.daily_plans d where d.parent_id = u.id and d.completed_at is not null),
    greatest(
      (select max(e.created_at) from public.exercise_attempts e where e.parent_id = u.id),
      (select max(coalesce(d.completed_at, d.updated_at)) from public.daily_plans d where d.parent_id = u.id),
      u.last_sign_in_at,
      u.created_at
    ),
    u.created_at
  from auth.users u
  left join public.account_access a on a.user_id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_superadmin()) then
    raise exception 'superadmin access required' using errcode = '42501';
  end if;
  if p_role not in ('parent', 'admin') then
    raise exception 'role must be parent or admin' using errcode = '22023';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'superadmin cannot change their own role here' using errcode = '22023';
  end if;

  update auth.users
  set raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(p_role), true),
      updated_at = now()
  where id = p_user_id;
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'role', p_role);
end;
$$;

create or replace function public.admin_set_user_access(
  p_user_id uuid,
  p_access_tier text,
  p_access_until date default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_superadmin()) then
    raise exception 'superadmin access required' using errcode = '42501';
  end if;
  if p_access_tier not in ('standard', 'complimentary', 'blocked') then
    raise exception 'invalid access tier' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  insert into public.account_access (user_id, access_tier, access_until, note, updated_by)
  values (p_user_id, p_access_tier, p_access_until, p_note, (select auth.uid()))
  on conflict (user_id) do update set
    access_tier = excluded.access_tier,
    access_until = excluded.access_until,
    note = excluded.note,
    updated_by = excluded.updated_by,
    updated_at = now();

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'access_tier', p_access_tier, 'access_until', p_access_until);
end;
$$;

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'registered_users', (select count(*) from auth.users),
    'participants', (select count(distinct parent_id) from public.children),
    'children', (select count(*) from public.children),
    'assessments', (select count(*) from public.skill_assessments),
    'exercise_attempts', (select count(*) from public.exercise_attempts),
    'completed_plans', (select count(*) from public.daily_plans where completed_at is not null),
    'active_participants_30d', (select count(distinct parent_id) from public.exercise_attempts where created_at >= now() - interval '30 days'),
    'complimentary_users', (select count(*) from public.account_access where access_tier = 'complimentary' and (access_until is null or access_until >= current_date)),
    'outcomes', (select jsonb_build_object(
      'independent', count(*) filter (where outcome = 'independent'),
      'assisted', count(*) filter (where outcome = 'assisted'),
      'unable', count(*) filter (where outcome = 'unable'),
      'refused', count(*) filter (where outcome = 'refused')
    ) from public.exercise_attempts)
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_participant_progress()
returns table(parent_id uuid, email text, preferred_language text, child_id uuid, child_name text, child_age smallint, current_levels jsonb, total_attempts bigint, independent_attempts bigint, assisted_attempts bigint, unable_attempts bigint, refused_attempts bigint, completed_days bigint, last_activity_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, p.preferred_language, c.id, c.name, c.age,
    coalesce(levels.current_levels, '{}'::jsonb),
    coalesce(attempts.total_attempts, 0), coalesce(attempts.independent_attempts, 0),
    coalesce(attempts.assisted_attempts, 0), coalesce(attempts.unable_attempts, 0),
    coalesce(attempts.refused_attempts, 0), coalesce(plans.completed_days, 0),
    greatest(attempts.last_attempt_at, plans.last_plan_activity_at, assessments.last_assessment_at, u.created_at)
  from auth.users u
  join public.children c on c.parent_id = u.id
  left join public.profiles p on p.id = u.id
  left join lateral (select jsonb_object_agg(s.category, s.level order by s.category) current_levels from public.child_skill_levels s where s.child_id = c.id) levels on true
  left join lateral (select count(*) total_attempts, count(*) filter(where outcome='independent') independent_attempts, count(*) filter(where outcome='assisted') assisted_attempts, count(*) filter(where outcome='unable') unable_attempts, count(*) filter(where outcome='refused') refused_attempts, max(created_at) last_attempt_at from public.exercise_attempts a where a.child_id=c.id) attempts on true
  left join lateral (select count(*) filter(where completed_at is not null) completed_days, max(coalesce(completed_at,updated_at)) last_plan_activity_at from public.daily_plans d where d.child_id=c.id) plans on true
  left join lateral (select max(completed_at) last_assessment_at from public.skill_assessments sa where sa.child_id=c.id) assessments on true
  order by 14 desc nulls last, u.created_at desc;
end;
$$;

alter table public.child_exercise_progress drop constraint if exists child_exercise_progress_exercise_id_check;
alter table public.child_exercise_progress add constraint child_exercise_progress_exercise_id_check check (exercise_id ~ '^[a-z_]+-[0-9]{2,}$');
alter table public.exercise_attempts drop constraint if exists exercise_attempts_exercise_id_check;
alter table public.exercise_attempts add constraint exercise_attempts_exercise_id_check check (exercise_id ~ '^[a-z_]+-[0-9]{2,}$');

revoke all on function public.admin_users() from public, anon;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
revoke all on function public.admin_set_user_access(uuid, text, date, text) from public, anon;
revoke all on function public.admin_dashboard_summary() from public, anon;
revoke all on function public.admin_participant_progress() from public, anon;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_set_user_access(uuid, text, date, text) to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_participant_progress() to authenticated;

notify pgrst, 'reload schema';
