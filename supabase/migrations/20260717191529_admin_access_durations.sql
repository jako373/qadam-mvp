create or replace function public.admin_grant_user_access(
  p_user_id uuid,
  p_period text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access_until date;
  v_plan_code text;
begin
  if (select auth.uid()) is null or not (select private.is_superadmin()) then
    raise exception 'superadmin access required' using errcode = '42501';
  end if;

  if p_period not in ('month', 'quarter', 'half_year', 'year', 'lifetime') then
    raise exception 'invalid access period' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  v_access_until := case p_period
    when 'month' then (current_date + interval '1 month')::date
    when 'quarter' then (current_date + interval '3 months')::date
    when 'half_year' then (current_date + interval '6 months')::date
    when 'year' then (current_date + interval '1 year')::date
    else null
  end;
  v_plan_code := nullif(p_period, 'lifetime');

  insert into public.account_access (
    user_id,
    access_tier,
    access_until,
    plan_code,
    note,
    updated_by
  )
  values (
    p_user_id,
    'complimentary',
    v_access_until,
    v_plan_code,
    case when p_period = 'lifetime'
      then 'Бессрочный полный доступ от суперадмина'
      else 'Полный доступ от суперадмина: ' || p_period
    end,
    (select auth.uid())
  )
  on conflict (user_id) do update set
    access_tier = excluded.access_tier,
    access_until = excluded.access_until,
    plan_code = excluded.plan_code,
    note = excluded.note,
    updated_by = excluded.updated_by,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'period', p_period,
    'access_tier', 'complimentary',
    'access_until', v_access_until,
    'plan_code', v_plan_code
  );
end;
$$;

revoke all on function public.admin_grant_user_access(uuid, text) from public, anon;
grant execute on function public.admin_grant_user_access(uuid, text) to authenticated;

notify pgrst, 'reload schema';
