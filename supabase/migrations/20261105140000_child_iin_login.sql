-- Child IIN is never stored in plaintext or exposed through the Data API.
begin;
create table if not exists private.child_login_secret (
  singleton boolean primary key default true check (singleton),
  secret bytea not null default gen_random_bytes(32)
);
insert into private.child_login_secret(singleton) values (true) on conflict do nothing;
alter table private.child_login_secret enable row level security;
revoke all on private.child_login_secret from public, anon, authenticated;

create table if not exists public.child_login_accounts (
  iin_hash text primary key check (length(iin_hash) = 64),
  child_id uuid not null unique references public.children(id) on delete cascade,
  parent_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.child_login_attempts (
  iin_hash text primary key references public.child_login_accounts(iin_hash) on delete cascade,
  attempt_count integer not null default 0,
  window_started timestamptz not null default now()
);
alter table public.child_login_accounts enable row level security;
alter table public.child_login_attempts enable row level security;
revoke all on public.child_login_accounts, public.child_login_attempts from public, anon, authenticated;

create or replace function public.child_iin_hash(p_iin text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_secret bytea;
begin
  if p_iin !~ '^[0-9]{12}$' then raise exception 'invalid IIN' using errcode = '22023'; end if;
  select secret into v_secret from private.child_login_secret where singleton;
  return encode(extensions.hmac(convert_to(p_iin, 'UTF8'), v_secret, 'sha256'), 'hex');
end;
$$;

create or replace function public.child_login_allow(p_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.child_login_attempts(iin_hash, attempt_count) values (p_hash, 1)
  on conflict (iin_hash) do update set
    attempt_count = case when public.child_login_attempts.window_started < now() - interval '15 minutes'
      then 1 else public.child_login_attempts.attempt_count + 1 end,
    window_started = case when public.child_login_attempts.window_started < now() - interval '15 minutes'
      then now() else public.child_login_attempts.window_started end
  returning attempt_count into v_count;
  return v_count <= 5;
end;
$$;

create or replace function public.child_login_reset(p_hash text)
returns void language sql security definer set search_path = '' as $$
  delete from public.child_login_attempts where iin_hash = p_hash;
$$;

revoke all on function public.child_iin_hash(text), public.child_login_allow(text), public.child_login_reset(text) from public, anon, authenticated;
grant execute on function public.child_iin_hash(text), public.child_login_allow(text), public.child_login_reset(text) to service_role;
commit;
