-- Additive migration applied to iismpbsapzmacxqraecx on 2026-11-24.
-- Version synchronized with the migration history returned by Supabase MCP.
create function public.center_parent_practice_summary(p_center_id uuid, p_child_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null
    or coalesce((select private.center_role(p_center_id)), '') not in ('admin', 'specialist')
    or not coalesce((select private.center_can_view_child(p_center_id, p_child_id)), false) then
    raise exception 'child access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'parent_assessment_at', (select max(a.completed_at) from public.skill_assessments a
      join public.children c on c.id = a.child_id and c.parent_id = a.parent_id where c.id = p_child_id),
    'attempt_count', (select count(*) from public.exercise_attempts a
      join public.children c on c.id = a.child_id and c.parent_id = a.parent_id where c.id = p_child_id),
    'recent_attempts', coalesce((select jsonb_agg(to_jsonb(recent)) from (
      select a.exercise_id, a.category, a.outcome, a.attempted_on
      from public.exercise_attempts a join public.children c on c.id = a.child_id and c.parent_id = a.parent_id
      where c.id = p_child_id order by a.created_at desc, a.id desc limit 10
    ) recent), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.center_parent_practice_summary(uuid, uuid) from public, anon;
grant execute on function public.center_parent_practice_summary(uuid, uuid) to authenticated;

-- One MVCC snapshot and an optimistic revision for existing parent tables.
create function private.center_practice_snapshot(p_child_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'child', (select jsonb_build_object('id',c.id,'parent_id',c.parent_id,'name',c.name,'age',c.age,
      'diagnosis',c.diagnosis,'home_language',c.home_language,'meaningful_words',c.meaningful_words,
      'interests',c.interests,'dislikes',c.dislikes,'best_time',c.best_time) from public.children c where c.id=p_child_id),
    'assessments',coalesce((select jsonb_agg(to_jsonb(a) order by a.completed_at desc,a.id) from public.skill_assessments a where a.child_id=p_child_id),'[]'::jsonb),
    'levels',coalesce((select jsonb_agg(to_jsonb(a) order by a.category) from public.child_skill_levels a where a.child_id=p_child_id),'[]'::jsonb),
    'progress',coalesce((select jsonb_agg(to_jsonb(a) order by a.exercise_id) from public.child_exercise_progress a where a.child_id=p_child_id),'[]'::jsonb),
    'plans',coalesce((select jsonb_agg(to_jsonb(a) order by a.plan_date) from public.daily_plans a where a.child_id=p_child_id),'[]'::jsonb),
    'attempt_count',(select count(*) from public.exercise_attempts a where a.child_id=p_child_id),
    'attempts',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at,a.id) from
      (select * from public.exercise_attempts where child_id=p_child_id order by created_at desc,id desc limit 500) a),'[]'::jsonb)
  );
$$;
revoke all on function private.center_practice_snapshot(uuid) from public,anon,authenticated;

create function public.center_parent_practice_state(p_child_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare data jsonb;
begin
  if (select auth.uid()) is null or not exists(select 1 from public.children where id=p_child_id and parent_id=(select auth.uid())) then
    raise exception 'parent ownership required' using errcode='42501';
  end if;
  data:=private.center_practice_snapshot(p_child_id);
  return data||jsonb_build_object('revision',md5(data::text));
end;
$$;

create function public.center_save_parent_practice(p_child_id uuid,p_expected_revision text,p_records jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid:=(select auth.uid()); data jsonb; table_key text; item jsonb;
begin
  if uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  -- Lock only the owned child; all cooperating writers serialize before comparing.
  perform 1 from public.children where id=p_child_id and parent_id=uid for update;
  if not found then raise exception 'parent ownership required' using errcode='42501'; end if;
  data:=private.center_practice_snapshot(p_child_id);
  if p_expected_revision is distinct from md5(data::text) then
    raise exception 'Данные изменились на другом устройстве. Загрузите серверную версию; черновик сохранён.' using errcode='40001';
  end if;
  if jsonb_typeof(p_records) is distinct from 'object' or pg_column_size(p_records)>2000000 then
    raise exception 'invalid practice payload' using errcode='22023';
  end if;
  foreach table_key in array array['skill_assessments','child_skill_levels','child_exercise_progress','daily_plans','exercise_attempts'] loop
    if jsonb_typeof(p_records->table_key) is distinct from 'array' then raise exception 'invalid practice rows' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(p_records->table_key) loop
      if item->>'parent_id' is distinct from uid::text or item->>'child_id' is distinct from p_child_id::text then
        raise exception 'record ownership mismatch' using errcode='42501';
      end if;
    end loop;
  end loop;
  insert into public.skill_assessments(id,parent_id,child_id,assessment_type,answers,skill_levels,completed_at)
    select x.id,uid,p_child_id,x.assessment_type,x.answers,x.skill_levels,x.completed_at
    from jsonb_to_recordset(p_records->'skill_assessments') as x(id uuid,assessment_type text,answers jsonb,skill_levels jsonb,completed_at timestamptz)
    on conflict(id) do nothing;
  insert into public.child_skill_levels(parent_id,child_id,category,level)
    select uid,p_child_id,x.category,x.level from jsonb_to_recordset(p_records->'child_skill_levels') as x(category text,level smallint)
    on conflict(child_id,category) do update set level=excluded.level;
  insert into public.child_exercise_progress(parent_id,child_id,exercise_id,independent_count,unable_streak,attempts,last_outcome,last_attempted_on,is_favorite)
    select uid,p_child_id,x.exercise_id,x.independent_count,x.unable_streak,x.attempts,x.last_outcome,x.last_attempted_on,x.is_favorite
    from jsonb_to_recordset(p_records->'child_exercise_progress') as x(exercise_id text,independent_count integer,unable_streak integer,attempts integer,last_outcome text,last_attempted_on date,is_favorite boolean)
    on conflict(child_id,exercise_id) do update set independent_count=excluded.independent_count,unable_streak=excluded.unable_streak,attempts=excluded.attempts,last_outcome=excluded.last_outcome,last_attempted_on=excluded.last_attempted_on,is_favorite=excluded.is_favorite;
  insert into public.daily_plans(parent_id,child_id,plan_date,based_on_date,items,results,viewed_count,completed_at)
    select uid,p_child_id,x.plan_date,x.based_on_date,x.items,x.results,x.viewed_count,x.completed_at
    from jsonb_to_recordset(p_records->'daily_plans') as x(plan_date date,based_on_date date,items jsonb,results jsonb,viewed_count smallint,completed_at timestamptz)
    on conflict(child_id,plan_date) do update set based_on_date=excluded.based_on_date,items=excluded.items,results=excluded.results,viewed_count=excluded.viewed_count,completed_at=excluded.completed_at;
  insert into public.exercise_attempts(id,parent_id,child_id,exercise_id,category,exercise_level,outcome,score,attempted_on,created_at)
    select x.id,uid,p_child_id,x.exercise_id,x.category,x.exercise_level,x.outcome,x.score,x.attempted_on,x.created_at
    from jsonb_to_recordset(p_records->'exercise_attempts') as x(id uuid,exercise_id text,category text,exercise_level smallint,outcome text,score smallint,attempted_on date,created_at timestamptz)
    on conflict(id) do nothing;
  data:=private.center_practice_snapshot(p_child_id);
  return jsonb_build_object('revision',md5(data::text));
end;
$$;
revoke all on function public.center_parent_practice_state(uuid),public.center_save_parent_practice(uuid,text,jsonb) from public,anon;
grant execute on function public.center_parent_practice_state(uuid),public.center_save_parent_practice(uuid,text,jsonb) to authenticated;
