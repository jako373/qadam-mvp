-- Homework is separate from lessons. Only the assigned parent can report results.
create table public.center_homework (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  specialist_id uuid not null references auth.users(id),
  exercise_ids text[] not null check (array_length(exercise_ids, 1) between 1 and 6),
  responses jsonb not null default '{}'::jsonb check (jsonb_typeof(responses) = 'object'),
  assigned_at timestamptz not null default now(),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id)
);
create index center_homework_child_time_idx on public.center_homework(child_id, assigned_at desc);
create index center_homework_staff_time_idx on public.center_homework(specialist_id, assigned_at desc);
alter table public.center_homework enable row level security;
revoke all on public.center_homework from public, anon, authenticated;
grant select on public.center_homework to authenticated;
create policy center_homework_read on public.center_homework for select to authenticated
  using (
    exists (select 1 from public.children c where c.id = child_id and c.parent_id = (select auth.uid()))
    or (specialist_id = (select auth.uid()) and (select private.center_can_view_child(center_id, child_id)))
    or (select private.center_role(center_id)) = 'admin'
  );

create function public.assign_center_homework(p_center_id uuid, p_child_id uuid, p_exercise_ids text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_count integer;
begin
  if (select auth.uid()) is null or not (select private.center_can_view_child(p_center_id, p_child_id)) then
    raise exception 'child access required' using errcode = '42501';
  end if;
  if coalesce(array_length(p_exercise_ids, 1), 0) not between 1 and 6
    or array_position(p_exercise_ids, null) is not null then
    raise exception 'select 1 to 6 exercises' using errcode = '22023';
  end if;
  select count(distinct e.id) into v_count from public.exercise_catalog e
    where e.id = any(p_exercise_ids) and e.status = 'active';
  if v_count <> array_length(p_exercise_ids, 1) then
    raise exception 'exercise unavailable or repeated' using errcode = '22023';
  end if;
  insert into public.center_homework(center_id, child_id, specialist_id, exercise_ids)
    values (p_center_id, p_child_id, (select auth.uid()), p_exercise_ids) returning id into v_id;
  return v_id;
end;
$$;

create function public.respond_center_homework(p_homework_id uuid, p_exercise_id text, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_homework public.center_homework;
begin
  if (select auth.uid()) is null then raise exception 'login required' using errcode = '42501'; end if;
  if p_response not in ('done', 'difficult', 'unable') then
    raise exception 'invalid response' using errcode = '22023';
  end if;
  select h.* into v_homework from public.center_homework h
    join public.children c on c.id = h.child_id
    where h.id = p_homework_id and c.parent_id = (select auth.uid()) for update of h;
  if not found then raise exception 'homework unavailable' using errcode = '42501'; end if;
  if not (p_exercise_id = any(v_homework.exercise_ids)) then
    raise exception 'exercise not assigned' using errcode = '22023';
  end if;
  update public.center_homework
    set responses = jsonb_set(responses, array[p_exercise_id],
      jsonb_build_object('result', p_response, 'at', now()), true)
    where id = p_homework_id;
end;
$$;
revoke all on function public.assign_center_homework(uuid, uuid, text[]), public.respond_center_homework(uuid, text, text) from public, anon, authenticated;
grant execute on function public.assign_center_homework(uuid, uuid, text[]), public.respond_center_homework(uuid, text, text) to authenticated;
