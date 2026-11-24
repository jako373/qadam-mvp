-- Additive: existing homework, responses and the legacy RPC remain intact.
alter table public.center_homework
  add column due_on date,
  add column instructions text not null default '' check (length(instructions) <= 500);

create function public.assign_center_homework_details(
  p_center_id uuid, p_child_id uuid, p_exercise_ids text[], p_due_on date, p_instructions text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null
    or coalesce((select private.center_role(p_center_id)), '') not in ('admin', 'specialist')
    or not (select private.center_can_view_child(p_center_id, p_child_id)) then
    raise exception 'child access required' using errcode = '42501';
  end if;
  if length(coalesce(p_instructions, '')) > 500 then
    raise exception 'instructions too long' using errcode = '22023';
  end if;
  v_id := public.assign_center_homework(p_center_id, p_child_id, p_exercise_ids);
  update public.center_homework set due_on = p_due_on,
    instructions = btrim(coalesce(p_instructions, '')) where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.assign_center_homework_details(uuid, uuid, text[], date, text) from public, anon;
grant execute on function public.assign_center_homework_details(uuid, uuid, text[], date, text) to authenticated;
