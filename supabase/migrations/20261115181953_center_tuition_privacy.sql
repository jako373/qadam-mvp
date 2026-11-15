-- Specialists may see only the period and derived status; service labels,
-- charge IDs and all monetary figures stay with admins and the family.
create or replace function public.center_tuition_overview(p_center_id uuid, p_child_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  allowed_staff boolean;
  allowed_parent boolean;
  allowed_admin boolean;
  result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  allowed_admin := coalesce((select private.center_role(p_center_id)), '') = 'admin'
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'superadmin';
  allowed_staff := coalesce((select private.center_can_view_child(p_center_id, p_child_id)), false);
  allowed_parent := exists (
    select 1 from public.children c join public.center_students cs on cs.child_id = c.id
    where cs.center_id = p_center_id and c.id = p_child_id and c.parent_id = (select auth.uid())
  );
  if not (allowed_admin or allowed_staff or allowed_parent) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', case when allowed_admin or allowed_parent then x.id else null end,
    'period_start', x.period_start, 'period_end', x.period_end,
    'description', case when allowed_admin or allowed_parent then x.description else null end,
    'status', x.status,
    'charged', case when allowed_admin or allowed_parent then x.amount_kzt else null end,
    'paid', case when allowed_admin or allowed_parent then x.paid else null end,
    'due', case when allowed_admin or allowed_parent then greatest(x.amount_kzt - x.paid, 0) else null end,
    'overpaid', case when allowed_admin or allowed_parent then greatest(x.paid - x.amount_kzt, 0) else null end
  ) order by x.period_end desc), '[]'::jsonb) into result
  from (
    select c.id, c.period_start, c.period_end, c.description, c.amount_kzt,
      coalesce(sum(e.amount_kzt), 0) as paid,
      case when coalesce(sum(e.amount_kzt), 0) >= c.amount_kzt then 'paid'
           when coalesce(sum(e.amount_kzt), 0) > 0 then 'partial' else 'unpaid' end as status
    from public.center_tuition_charges c
    left join public.center_tuition_events e on e.charge_id = c.id
    where c.center_id = p_center_id and c.child_id = p_child_id
    group by c.id
  ) x;
  return result;
end;
$$;
