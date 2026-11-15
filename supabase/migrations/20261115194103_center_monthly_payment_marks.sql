-- A manual, monthly payment marker for the center LMS. This is not a transaction.
create table public.center_monthly_payment_marks (
  center_id uuid not null,
  child_id uuid not null,
  period_month date not null,
  status text not null check (status in ('paid', 'unpaid', 'unset')),
  marked_by uuid not null references auth.users(id) on delete restrict,
  marked_at timestamptz not null default now(),
  primary key (center_id, child_id, period_month),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete restrict,
  check (extract(day from period_month) = 1)
);

create index center_monthly_payment_marks_period_idx
  on public.center_monthly_payment_marks(center_id, period_month, status);
alter table public.center_monthly_payment_marks enable row level security;
revoke all on public.center_monthly_payment_marks from public, anon, authenticated;
grant select, insert on public.center_monthly_payment_marks to authenticated;
grant update(status, marked_by, marked_at) on public.center_monthly_payment_marks to authenticated;

create policy center_payment_marks_read on public.center_monthly_payment_marks
  for select to authenticated
  using (
    (select private.center_role(center_id)) = 'admin'
    or (select private.center_can_view_child(center_id, child_id))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );
create policy center_payment_marks_insert on public.center_monthly_payment_marks
  for insert to authenticated
  with check (
    ((select private.center_role(center_id)) = 'admin'
      or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
    and marked_by = (select auth.uid())
  );
create policy center_payment_marks_update on public.center_monthly_payment_marks
  for update to authenticated
  using (
    (select private.center_role(center_id)) = 'admin'
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  )
  with check (
    ((select private.center_role(center_id)) = 'admin'
      or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
    and marked_by = (select auth.uid())
  );
