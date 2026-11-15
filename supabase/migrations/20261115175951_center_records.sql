-- Additive center records. Existing children and sessions retain their values.
alter table public.children add column if not exists birth_date date;
alter table public.children add constraint children_birth_date_not_future check (birth_date is null or birth_date <= current_date);
create policy center_students_parent_read on public.center_students for select to authenticated
  using (exists (select 1 from public.children c where c.id = child_id and c.parent_id = (select auth.uid())));

create table public.center_guardians (
  center_id uuid not null,
  child_id uuid not null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (center_id, child_id),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete restrict
);
alter table public.center_guardians enable row level security;
revoke all on public.center_guardians from public, anon, authenticated;
grant select, insert on public.center_guardians to authenticated;
grant update(full_name, phone_e164, updated_by, updated_at) on public.center_guardians to authenticated;
create policy center_guardians_read on public.center_guardians for select to authenticated
  using ((select private.center_can_view_child(center_id, child_id))
    or exists (select 1 from public.children c where c.id = child_id and c.parent_id = (select auth.uid()))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy center_guardians_write on public.center_guardians for insert to authenticated
  with check ((select private.center_can_view_child(center_id, child_id)) and updated_by = (select auth.uid()));
create policy center_guardians_edit on public.center_guardians for update to authenticated
  using ((select private.center_can_view_child(center_id, child_id)))
  with check ((select private.center_can_view_child(center_id, child_id)) and updated_by = (select auth.uid()));

create table public.center_tuition_charges (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  period_start date not null,
  period_end date not null,
  description text not null check (char_length(btrim(description)) between 2 and 180),
  amount_kzt bigint not null check (amount_kzt > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (center_id, id),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete restrict
);
create index center_tuition_charges_child_period_idx on public.center_tuition_charges(center_id, child_id, period_end desc);
alter table public.center_tuition_charges enable row level security;
revoke all on public.center_tuition_charges from public, anon, authenticated;
grant select, insert on public.center_tuition_charges to authenticated;
create policy center_charges_admin_read on public.center_tuition_charges for select to authenticated
  using ((select private.center_role(center_id)) = 'admin' or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy center_charges_admin_insert on public.center_tuition_charges for insert to authenticated
  with check (((select private.center_role(center_id)) = 'admin' or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
    and created_by = (select auth.uid()));

create table public.center_tuition_events (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  charge_id uuid not null,
  kind text not null check (kind in ('payment', 'correction', 'refund')),
  amount_kzt bigint not null check (amount_kzt <> 0),
  occurred_on date not null,
  method text check (method is null or char_length(method) <= 80),
  internal_note text check (internal_note is null or char_length(internal_note) <= 500),
  reverses_event_id uuid references public.center_tuition_events(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (center_id, charge_id) references public.center_tuition_charges(center_id, id) on delete restrict,
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete restrict,
  check ((kind = 'payment' and amount_kzt > 0) or (kind = 'refund' and amount_kzt < 0) or kind = 'correction')
);
create index center_tuition_events_charge_idx on public.center_tuition_events(charge_id, created_at);
alter table public.center_tuition_events enable row level security;
revoke all on public.center_tuition_events from public, anon, authenticated;
grant select, insert on public.center_tuition_events to authenticated;
create policy center_tuition_events_admin_read on public.center_tuition_events for select to authenticated
  using ((select private.center_role(center_id)) = 'admin' or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy center_tuition_events_admin_insert on public.center_tuition_events for insert to authenticated
  with check (((select private.center_role(center_id)) = 'admin' or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
    and created_by = (select auth.uid())
    and exists (select 1 from public.center_tuition_charges charge where charge.id = center_tuition_events.charge_id
      and charge.center_id = center_tuition_events.center_id and charge.child_id = center_tuition_events.child_id));

create function private.validate_center_tuition_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.reverses_event_id is not null and not exists (
    select 1 from public.center_tuition_events original
    where original.id = new.reverses_event_id and original.charge_id = new.charge_id
  ) then raise exception 'invalid event reference' using errcode = '23503'; end if;
  return new;
end;
$$;
revoke all on function private.validate_center_tuition_event() from public, anon, authenticated;
create trigger validate_center_tuition_event before insert on public.center_tuition_events
for each row execute function private.validate_center_tuition_event();

-- Return amounts only to the center's administrators and the child's parent.
-- Specialists receive the status of assigned pupils, not financial figures.
create function public.center_tuition_overview(p_center_id uuid, p_child_id uuid)
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
    'id', x.id, 'period_start', x.period_start, 'period_end', x.period_end,
    'description', x.description, 'status', x.status,
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
revoke all on function public.center_tuition_overview(uuid, uuid) from public, anon;
grant execute on function public.center_tuition_overview(uuid, uuid) to authenticated;

create table public.center_session_attendance_events (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  session_id uuid not null references public.center_sessions(id) on delete restrict,
  old_status text not null,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index center_session_attendance_events_session_idx on public.center_session_attendance_events(session_id, changed_at desc);
alter table public.center_session_attendance_events enable row level security;
revoke all on public.center_session_attendance_events from public, anon, authenticated;
grant select on public.center_session_attendance_events to authenticated;
create policy center_attendance_events_read on public.center_session_attendance_events for select to authenticated
  using ((select private.center_can_view_child(center_id, child_id))
    or exists (select 1 from public.children c where c.id = child_id and c.parent_id = (select auth.uid()))
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

create function private.audit_center_session_attendance()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    insert into public.center_session_attendance_events(center_id, child_id, session_id, old_status, new_status, changed_by)
    values (new.center_id, new.child_id, new.id, old.status, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;
revoke all on function private.audit_center_session_attendance() from public, anon, authenticated;
create trigger center_session_attendance_audit after update of status on public.center_sessions
for each row execute function private.audit_center_session_attendance();

create table public.center_enrollment_events (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  child_id uuid not null,
  action text not null check (action in ('pause', 'resume')),
  effective_on date not null,
  internal_note text check (internal_note is null or char_length(internal_note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (center_id, child_id) references public.center_students(center_id, child_id) on delete restrict
);
create index center_enrollment_events_child_idx on public.center_enrollment_events(center_id, child_id, effective_on desc, created_at desc);
alter table public.center_enrollment_events enable row level security;
revoke all on public.center_enrollment_events from public, anon, authenticated;
grant select on public.center_enrollment_events to authenticated;
create policy center_enrollment_events_admin_read on public.center_enrollment_events for select to authenticated
  using ((select private.center_role(center_id)) = 'admin' or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

create function public.center_set_enrollment_state(p_center_id uuid, p_child_id uuid, p_action text, p_effective_on date, p_cancel_future boolean default false, p_note text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare cancelled_count integer := 0;
begin
  if (select auth.uid()) is null or not (
    coalesce((select private.center_role(p_center_id)), '') = 'admin'
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'superadmin'
  ) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.center_students where center_id = p_center_id and child_id = p_child_id) then
    raise exception 'child not enrolled' using errcode = '23503';
  end if;
  if p_action not in ('pause', 'resume') or p_effective_on is null or char_length(coalesce(p_note, '')) > 500
     or (p_cancel_future and p_action <> 'pause') then
    raise exception 'invalid enrollment change' using errcode = '22023';
  end if;
  insert into public.center_enrollment_events(center_id, child_id, action, effective_on, internal_note, created_by)
  values (p_center_id, p_child_id, p_action, p_effective_on, nullif(btrim(p_note), ''), (select auth.uid()));
  if p_cancel_future then
    update public.center_sessions set status = 'cancelled'
    where center_id = p_center_id and child_id = p_child_id and status = 'planned'
      and starts_at >= greatest((p_effective_on::timestamp at time zone 'Asia/Qyzylorda'), now());
    get diagnostics cancelled_count = row_count;
  end if;
  return cancelled_count;
end;
$$;
revoke all on function public.center_set_enrollment_state(uuid, uuid, text, date, boolean, text) from public, anon;
grant execute on function public.center_set_enrollment_state(uuid, uuid, text, date, boolean, text) to authenticated;
