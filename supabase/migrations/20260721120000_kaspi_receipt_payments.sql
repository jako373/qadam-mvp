create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_plan_code text not null check (requested_plan_code in ('month', 'quarter', 'half_year', 'year')),
  requested_amount_kzt integer not null check (requested_amount_kzt in (4990, 9990, 15990, 27990)),
  actual_plan_code text check (actual_plan_code is null or actual_plan_code in ('month', 'quarter', 'half_year', 'year')),
  actual_amount_kzt integer check (actual_amount_kzt is null or actual_amount_kzt in (4990, 9990, 15990, 27990)),
  status text not null default 'created' check (status in ('created', 'verifying', 'confirmed', 'manual_review', 'rejected', 'expired', 'refunded')),
  file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  receipt_url text,
  receipt_storage_path text,
  kaspi_ext_tran_id text,
  kaspi_fiscal_sign text,
  kaspi_rnm text,
  kaspi_sale_at timestamptz,
  access_until date,
  review_reason text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_orders_ext_tran_id_uidx
  on public.payment_orders (kaspi_ext_tran_id)
  where kaspi_ext_tran_id is not null;
create unique index if not exists payment_orders_fiscal_sign_uidx
  on public.payment_orders (kaspi_fiscal_sign)
  where kaspi_fiscal_sign is not null;
create index if not exists payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);
create unique index if not exists payment_orders_one_open_per_user_uidx
  on public.payment_orders (user_id)
  where status in ('created', 'verifying', 'manual_review');

alter table public.payment_orders enable row level security;
alter table public.payment_orders force row level security;
revoke all on table public.payment_orders from public, anon, authenticated;
grant select (id, requested_plan_code, requested_amount_kzt, actual_plan_code, actual_amount_kzt, status, access_until, review_reason, created_at, updated_at)
  on public.payment_orders to authenticated;

drop policy if exists payment_orders_select_own on public.payment_orders;
create policy payment_orders_select_own on public.payment_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.create_payment_order(p_plan_code text)
returns public.payment_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_amount integer;
  v_order public.payment_orders;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_amount := case p_plan_code
    when 'month' then 4990
    when 'quarter' then 9990
    when 'half_year' then 15990
    when 'year' then 27990
    else null
  end;
  if v_amount is null then
    raise exception 'invalid plan code' using errcode = '22023';
  end if;

  update public.payment_orders
    set status = 'expired', updated_at = now()
    where user_id = v_user_id
      and status in ('created', 'verifying')
      and created_at < now() - interval '7 days';

  select * into v_order
    from public.payment_orders
    where user_id = v_user_id and status in ('created', 'verifying', 'manual_review')
    order by created_at desc limit 1
    for update;

  if found and v_order.requested_plan_code = p_plan_code then
    return v_order;
  elsif found then
    update public.payment_orders
      set status = 'expired', review_reason = 'replaced_by_new_order', updated_at = now()
      where id = v_order.id;
  end if;

  insert into public.payment_orders (user_id, requested_plan_code, requested_amount_kzt)
    values (v_user_id, p_plan_code, v_amount)
    returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.create_payment_order(text) from public, anon;
grant execute on function public.create_payment_order(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payment_receipts_insert_own on storage.objects;
create policy payment_receipts_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.submit_payment_manual_review(p_order_id uuid, p_storage_path text, p_file_sha256 text)
returns public.payment_orders language plpgsql security definer set search_path = '' as $$
declare v_order public.payment_orders; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid file hash' using errcode = '22023'; end if;
  if split_part(p_storage_path, '/', 1) <> v_uid::text then raise exception 'invalid storage path' using errcode = '42501'; end if;
  update public.payment_orders set status = 'manual_review', receipt_storage_path = p_storage_path,
    file_sha256 = p_file_sha256, review_reason = 'qr_not_recognized', updated_at = now()
    where id = p_order_id and user_id = v_uid and status in ('created', 'verifying', 'manual_review')
    returning * into v_order;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  return v_order;
end;
$$;
revoke all on function public.submit_payment_manual_review(uuid, text, text) from public, anon;
grant execute on function public.submit_payment_manual_review(uuid, text, text) to authenticated;

create or replace function public.finalize_kaspi_payment(
  p_order_id uuid,
  p_file_sha256 text,
  p_receipt_url text,
  p_ext_tran_id text,
  p_fiscal_sign text,
  p_rnm text,
  p_bin text,
  p_merchant text,
  p_item_name text,
  p_amount_kzt integer,
  p_sale_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.payment_orders;
  v_plan text;
  v_months integer;
  v_base date;
  v_until date;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid file hash' using errcode = '22023'; end if;
  if p_bin <> '900316301004' or p_rnm <> '600404801200' then raise exception 'merchant mismatch' using errcode = '22023'; end if;
  if upper(trim(p_merchant)) <> 'ИП AIQYN AI AGENCY' then raise exception 'merchant title mismatch' using errcode = '22023'; end if;
  if lower(trim(p_item_name)) <> 'подписка' then raise exception 'item mismatch' using errcode = '22023'; end if;

  select case p_amount_kzt when 4990 then 'month' when 9990 then 'quarter' when 15990 then 'half_year' when 27990 then 'year' end,
         case p_amount_kzt when 4990 then 1 when 9990 then 3 when 15990 then 6 when 27990 then 12 end
    into v_plan, v_months;
  if v_plan is null then raise exception 'amount does not match a tariff' using errcode = '22023'; end if;

  select * into v_order from public.payment_orders where id = p_order_id for update;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'confirmed' then
    if v_order.kaspi_ext_tran_id = p_ext_tran_id and v_order.kaspi_fiscal_sign = p_fiscal_sign then
      return jsonb_build_object('ok', true, 'idempotent', true, 'plan_code', v_order.actual_plan_code, 'access_until', v_order.access_until);
    end if;
    raise exception 'order already confirmed' using errcode = '23505';
  end if;
  if v_order.status in ('rejected', 'expired', 'refunded') then raise exception 'payment order is closed' using errcode = '22023'; end if;
  if p_sale_at < v_order.created_at - interval '10 minutes' or p_sale_at > v_order.created_at + interval '7 days' or p_sale_at > now() + interval '5 minutes' then
    raise exception 'payment date outside order window' using errcode = '22023';
  end if;
  if p_amount_kzt <> v_order.requested_amount_kzt or v_plan <> v_order.requested_plan_code then
    raise exception 'receipt does not match requested tariff' using errcode = '22023';
  end if;

  select greatest(current_date, coalesce(access_until, current_date)) into v_base
    from public.account_access where user_id = v_order.user_id for update;
  v_base := coalesce(v_base, current_date);
  v_until := (v_base + make_interval(months => v_months))::date;

  insert into public.account_access (user_id, access_tier, access_until, plan_code, note, updated_by)
  values (v_order.user_id, 'paid', v_until, v_plan, 'Kaspi Pay: ' || p_ext_tran_id, null)
  on conflict (user_id) do update set
    access_tier = case when public.account_access.access_tier = 'complimentary' and public.account_access.access_until is null then public.account_access.access_tier else excluded.access_tier end,
    access_until = case when public.account_access.access_tier = 'complimentary' and public.account_access.access_until is null then null else excluded.access_until end,
    plan_code = excluded.plan_code,
    note = excluded.note,
    updated_by = null,
    updated_at = now();

  update public.payment_orders set
    status = 'confirmed', file_sha256 = p_file_sha256, receipt_url = p_receipt_url,
    kaspi_ext_tran_id = p_ext_tran_id, kaspi_fiscal_sign = p_fiscal_sign, kaspi_rnm = p_rnm,
    kaspi_sale_at = p_sale_at, actual_plan_code = v_plan, actual_amount_kzt = p_amount_kzt,
    access_until = v_until, review_reason = null, verified_at = now(), updated_at = now()
    where id = p_order_id;

  return jsonb_build_object('ok', true, 'idempotent', false, 'plan_code', v_plan, 'access_until', v_until);
exception when unique_violation then
  raise exception 'receipt already used' using errcode = '23505';
end;
$$;

revoke all on function public.finalize_kaspi_payment(uuid, text, text, text, text, text, text, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_kaspi_payment(uuid, text, text, text, text, text, text, text, text, integer, timestamptz) to service_role;

create or replace function public.mark_kaspi_payment_review(p_order_id uuid, p_status text, p_reason text, p_file_sha256 text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if p_status not in ('manual_review', 'rejected') then raise exception 'invalid review status' using errcode = '22023'; end if;
  update public.payment_orders set status = p_status, review_reason = left(p_reason, 500),
    file_sha256 = coalesce(p_file_sha256, file_sha256), updated_at = now()
    where id = p_order_id and status not in ('confirmed', 'refunded');
end;
$$;
revoke all on function public.mark_kaspi_payment_review(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mark_kaspi_payment_review(uuid, text, text, text) to service_role;

create or replace function public.admin_payment_orders()
returns table (
  id uuid, email text, requested_plan_code text, requested_amount_kzt integer,
  actual_amount_kzt integer, status text, kaspi_ext_tran_id text,
  access_until date, review_reason text, receipt_storage_path text, created_at timestamptz, verified_at timestamptz
)
language sql security definer set search_path = '' as $$
  select p.id, u.email::text, p.requested_plan_code, p.requested_amount_kzt,
    p.actual_amount_kzt, p.status, p.kaspi_ext_tran_id, p.access_until,
    p.review_reason, p.receipt_storage_path, p.created_at, p.verified_at
  from public.payment_orders p join auth.users u on u.id = p.user_id
  where (select private.is_admin())
  order by p.created_at desc limit 250;
$$;
revoke all on function public.admin_payment_orders() from public, anon;
grant execute on function public.admin_payment_orders() to authenticated;

notify pgrst, 'reload schema';
