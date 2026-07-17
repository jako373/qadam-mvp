alter table public.account_access
  add column if not exists plan_code text;

alter table public.account_access
  drop constraint if exists account_access_access_tier_check;

alter table public.account_access
  add constraint account_access_access_tier_check
  check (access_tier in ('standard', 'paid', 'complimentary', 'blocked'));

alter table public.account_access
  drop constraint if exists account_access_plan_code_check;

alter table public.account_access
  add constraint account_access_plan_code_check
  check (plan_code is null or plan_code in ('month', 'quarter', 'half_year', 'year'));

drop policy if exists "account_access_select_own" on public.account_access;
create policy "account_access_select_own"
on public.account_access for select
to authenticated
using ((select auth.uid()) = user_id);

grant select (user_id, access_tier, access_until, plan_code)
on public.account_access to authenticated;

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
  if p_access_tier not in ('standard', 'paid', 'complimentary', 'blocked') then
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

revoke all on function public.admin_set_user_access(uuid, text, date, text) from public, anon;
grant execute on function public.admin_set_user_access(uuid, text, date, text) to authenticated;

notify pgrst, 'reload schema';
