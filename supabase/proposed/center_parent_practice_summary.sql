-- Proposed additive migration; NOT applied. Generate the migration filename
-- with the installed Supabase CLI when hosted migration is authorized.
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
