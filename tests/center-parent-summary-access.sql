-- Run only after the proposed migration is approved/applied. No writes; rollback.
begin;
do $$
declare staff uuid; center uuid; child uuid; denied boolean; result jsonb;
begin
  select a.specialist_id, a.center_id, a.child_id into staff, center, child
    from public.center_specialist_students a
    join public.center_staff s on s.center_id = a.center_id and s.user_id = a.specialist_id
    join public.center_students cs on cs.center_id = a.center_id and cs.child_id = a.child_id
    where a.active and cs.active limit 1;
  if staff is null then raise exception 'Need a linked specialist/child fixture'; end if;
  perform set_config('request.jwt.claim.sub', staff::text, true);
  result := public.center_parent_practice_summary(center, child);
  if not (result ? 'attempt_count') then raise exception 'missing summary'; end if;
  denied := false;
  begin perform public.center_parent_practice_summary(gen_random_uuid(), child);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'other center was allowed'; end if;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  denied := false;
  begin perform public.center_parent_practice_summary(center, child);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'unassigned subject was allowed'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  denied := false;
  begin perform public.center_parent_practice_summary(center, child);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'missing identity was allowed'; end if;
end $$;
rollback;
