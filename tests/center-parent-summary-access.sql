-- Run against a disposable/local Supabase DB after approving the proposed SQL.
-- Representative synthetic roles only; every inserted fixture is rolled back.
begin;
do $$
declare
  parent uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
  specialist uuid:=gen_random_uuid(); unassigned uuid:=gen_random_uuid();
  other_staff uuid:=gen_random_uuid(); center uuid:=gen_random_uuid();
  other_center uuid:=gen_random_uuid(); child uuid:=gen_random_uuid();
  actor uuid; denied boolean; data jsonb; saved jsonb; exercise_ids text[];
begin
  foreach actor in array array[parent,admin_id,specialist,unassigned,other_staff] loop
    insert into auth.users(id,email,aud,role) values(actor,actor::text||'@practice.test','authenticated','authenticated');
  end loop;
  insert into public.centers(id,slug,name) values(center,'practice-'||center,'Practice Test'),(other_center,'practice-'||other_center,'Other Test');
  insert into public.children(id,parent_id,name,age,diagnosis,home_language,meaningful_words)
    values(child,parent,'Synthetic Test',5,'Диагноз жоқ / Диагноза нет','Қазақша','Сөз қолданбайды / Не использует слова');
  insert into public.center_staff(center_id,user_id,role,full_name) values
    (center,admin_id,'admin','Test Admin'),(center,specialist,'specialist','Test Assigned'),
    (center,unassigned,'specialist','Test Unassigned'),(other_center,other_staff,'specialist','Test Other');
  insert into public.center_students(center_id,child_id) values(center,child);
  insert into public.center_specialist_students(center_id,child_id,specialist_id,child_name) values(center,child,specialist,'Synthetic Test');
  select array_agg(id) into exercise_ids from (select id from public.exercise_catalog where status='active' order by id limit 3) e;
  if array_length(exercise_ids,1)<>3 then raise exception 'need three active exercise fixtures'; end if;

  execute 'set local role authenticated';
  foreach actor in array array[admin_id,specialist] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    data:=public.center_parent_practice_summary(center,child);
    if not(data?'attempt_count')then raise exception 'allowed staff missing summary';end if;
  end loop;
  foreach actor in array array[unassigned,other_staff,parent] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);denied:=false;
    begin perform public.center_parent_practice_summary(center,child);
    exception when insufficient_privilege then denied:=true;end;
    if not denied then raise exception 'unassigned/other-center/parent got staff summary';end if;
  end loop;
  perform set_config('request.jwt.claim.sub',parent::text,true);
  data:=public.center_parent_practice_state(child);
  if data->'child'->>'parent_id'<>parent::text then raise exception 'wrong parent state';end if;
  saved:=public.center_save_parent_practice(child,data->>'revision',jsonb_build_object(
    'skill_assessments',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'parent_id',parent,'child_id',child,'assessment_type','initial','answers',jsonb_build_object('test',2),'skill_levels',jsonb_build_object('communication',1),'completed_at',now())),
    'child_skill_levels',jsonb_build_array(jsonb_build_object('parent_id',parent,'child_id',child,'category','communication','level',1)),
    'child_exercise_progress',jsonb_build_array(jsonb_build_object('parent_id',parent,'child_id',child,'exercise_id',exercise_ids[1],'independent_count',1,'unable_streak',0,'attempts',1,'last_outcome','independent','last_attempted_on',current_date,'is_favorite',false)),
    'daily_plans',jsonb_build_array(jsonb_build_object('parent_id',parent,'child_id',child,'plan_date',current_date,'items',jsonb_build_array(jsonb_build_object('exerciseId',exercise_ids[1]),jsonb_build_object('exerciseId',exercise_ids[2]),jsonb_build_object('exerciseId',exercise_ids[3])),'results',jsonb_build_object(exercise_ids[1],'independent'),'viewed_count',3)),
    'exercise_attempts',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'parent_id',parent,'child_id',child,'exercise_id',exercise_ids[1],'category','communication','exercise_level',1,'outcome','independent','score',2,'attempted_on',current_date,'created_at',now()))));
  if saved->>'revision'=data->>'revision' then raise exception 'successful save did not advance revision';end if;
  if (public.center_parent_practice_state(child)->>'attempt_count')::integer<>1 then raise exception 'attempt was not saved';end if;
  denied:=false;
  begin perform public.center_save_parent_practice(child,'stale',jsonb_build_object(
    'skill_assessments','[]'::jsonb,'child_skill_levels','[]'::jsonb,'child_exercise_progress','[]'::jsonb,'daily_plans','[]'::jsonb,'exercise_attempts','[]'::jsonb));
  exception when serialization_failure then denied:=true;end;
  if not denied then raise exception 'stale revision accepted';end if;
  perform set_config('request.jwt.claim.sub',unassigned::text,true);denied:=false;
  begin perform public.center_parent_practice_state(child);
  exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'unrelated subject read parent state';end if;

  execute 'reset role';execute 'set local role anon';
  perform set_config('request.jwt.claim.sub','',true);denied:=false;
  begin perform public.center_parent_practice_summary(center,child);
  exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'anonymous SQL role was allowed';end if;
  execute 'reset role';
end $$;
rollback;
