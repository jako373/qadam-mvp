-- Server-managed exercise catalogue. Direct table access is disabled; clients use guarded RPCs.

create table if not exists public.exercise_catalog (
  id text primary key check (id ~ '^[a-z_]+-[0-9]{2,}$'),
  category text not null check (category in ('joint_attention','understanding','imitation','communication','play_thinking','fine_motor','regulation','daily_social')),
  level smallint not null check (level between 1 and 3),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  source text not null default 'manual' check (source in ('manual','ai','import')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercise_catalog_status_category_level_idx on public.exercise_catalog(status, category, level);
alter table public.exercise_catalog enable row level security;
revoke all on public.exercise_catalog from anon, authenticated;

create or replace function public.active_exercises()
returns table(content jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='42501'; end if;
  return query select e.content || jsonb_build_object('isActive', true) from public.exercise_catalog e where e.status='active' order by e.category,e.level,e.id;
end;
$$;

create or replace function public.admin_exercises()
returns table(id text, category text, level smallint, status text, source text, content jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then raise exception 'admin access required' using errcode='42501'; end if;
  return query select e.id,e.category,e.level,e.status,e.source,e.content,e.updated_at from public.exercise_catalog e order by e.category,e.level,e.id;
end;
$$;

create or replace function public.admin_save_exercise(p_content jsonb, p_status text default 'draft', p_source text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare exercise_id text := p_content->>'id'; exercise_category text := p_content->>'category'; exercise_level smallint := (p_content->>'level')::smallint;
begin
  if (select auth.uid()) is null or not (select private.is_superadmin()) then raise exception 'superadmin access required' using errcode='42501'; end if;
  if p_status not in ('draft','active','archived') then raise exception 'invalid status' using errcode='22023'; end if;
  if p_source not in ('manual','ai','import') then raise exception 'invalid source' using errcode='22023'; end if;
  if exercise_id is null or exercise_id !~ '^[a-z_]+-[0-9]{2,}$' then raise exception 'invalid exercise id' using errcode='22023'; end if;
  if exercise_category not in ('joint_attention','understanding','imitation','communication','play_thinking','fine_motor','regulation','daily_social') then raise exception 'invalid category' using errcode='22023'; end if;
  if exercise_level not between 1 and 3 then raise exception 'invalid level' using errcode='22023'; end if;
  if not (p_content ? 'kk' and p_content ? 'ru') then raise exception 'both languages are required' using errcode='22023'; end if;

  insert into public.exercise_catalog(id,category,level,status,source,content,created_by,updated_by)
  values(exercise_id,exercise_category,exercise_level,p_status,p_source,p_content || jsonb_build_object('isActive',p_status='active'),(select auth.uid()),(select auth.uid()))
  on conflict(id) do update set category=excluded.category,level=excluded.level,status=excluded.status,source=excluded.source,content=excluded.content,updated_by=(select auth.uid()),updated_at=now();
  return jsonb_build_object('ok',true,'id',exercise_id,'status',p_status);
end;
$$;

create or replace function public.admin_set_exercise_status(p_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_superadmin()) then raise exception 'superadmin access required' using errcode='42501'; end if;
  if p_status not in ('draft','active','archived') then raise exception 'invalid status' using errcode='22023'; end if;
  update public.exercise_catalog set status=p_status,content=jsonb_set(content,'{isActive}',to_jsonb(p_status='active'),true),updated_by=(select auth.uid()),updated_at=now() where id=p_id;
  if not found then raise exception 'exercise not found' using errcode='P0002'; end if;
  return jsonb_build_object('ok',true,'id',p_id,'status',p_status);
end;
$$;

revoke all on function public.active_exercises() from public,anon;
revoke all on function public.admin_exercises() from public,anon;
revoke all on function public.admin_save_exercise(jsonb,text,text) from public,anon;
revoke all on function public.admin_set_exercise_status(text,text) from public,anon;
grant execute on function public.active_exercises() to authenticated;
grant execute on function public.admin_exercises() to authenticated;
grant execute on function public.admin_save_exercise(jsonb,text,text) to authenticated;
grant execute on function public.admin_set_exercise_status(text,text) to authenticated;
notify pgrst,'reload schema';
