-- ════════════════════════════════════════════════════════════════════
-- Nemu.in — foundation schema
--
-- Design notes that matter:
--
--  * Credit spending is a single atomic UPDATE inside a SECURITY DEFINER
--    function. It is never a read-then-write from the app, because two
--    tabs firing at once would otherwise both pass the balance check and
--    the user would spend credits they do not have.
--  * `profiles.credits` and `profiles.role` are revoked from the
--    authenticated role at the *column* level. RLS alone would let a user
--    UPDATE their own row and hand themselves a million credits.
--  * `app_settings` is a single-row table guarded by a CHECK constraint so
--    the kill switch can never be ambiguous.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────
do $$ begin
  create type public.account_role as enum ('user', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('new', 'contacted', 'replied', 'won', 'dead');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.credit_action as enum (
    'signup_bonus', 'grant', 'scrape', 'score', 'pitch', 'deep_pitch', 'copilot', 'refund'
  );
exception when duplicate_object then null; end $$;

-- How to reach a prospect, ordered by how little work it takes.
-- 'served' means they already have a website — kept for completeness, not
-- shown as a lead.
do $$ begin
  create type public.contact_tier as enum ('whatsapp', 'phone', 'visit', 'served');
exception when duplicate_object then null; end $$;

-- ── profiles ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        public.account_role not null default 'user',
  credits     integer not null default 30 check (credits >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  locale      text not null default 'id',
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ── leads ───────────────────────────────────────────────────────────
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  place_id      text not null,
  name          text not null,
  category      text,
  address       text,
  area          text,
  phone         text,
  -- Mobile only, WhatsApp-safe. Null for a landline.
  phone_e164    text,
  -- Any number, mobile or landline, for a tel: link.
  phone_dial    text,
  website       text,
  rating        numeric(2,1),
  review_count  integer default 0,
  lat           double precision,
  lng           double precision,
  maps_uri      text,
  ai_score      smallint check (ai_score between 0 and 100),
  ai_verdict    text,
  ai_angle      text,
  pitch         text,
  pitch_tone    text,
  contact_tier  public.contact_tier not null default 'visit',
  status        public.lead_status not null default 'new',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, place_id)
);

create index if not exists leads_user_created_idx on public.leads (user_id, created_at desc);
create index if not exists leads_user_status_idx  on public.leads (user_id, status);
create index if not exists leads_place_idx        on public.leads (place_id);
-- The dashboard's default view is "my WhatsApp-ready leads, newest first".
create index if not exists leads_user_tier_idx    on public.leads (user_id, contact_tier, created_at desc);

-- ── credit_ledger ───────────────────────────────────────────────────
-- Append-only. Every movement of every credit is reconstructable.
create table if not exists public.credit_ledger (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  action        public.credit_action not null,
  amount        integer not null,          -- negative = spent, positive = received
  balance_after integer not null,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);

-- ── app_settings (single row, id is pinned to 1) ────────────────────
create table if not exists public.app_settings (
  id             smallint primary key default 1 check (id = 1),
  places_enabled boolean not null default true,
  gemini_enabled boolean not null default true,
  notice         text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles(id)
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ════════════════════════════════════════════════════════════════════

-- New Google sign-in → profile + welcome credits, in one transaction.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.account_role := 'user';
begin
  -- Super admin is promoted once, by hand, via 0002_bootstrap_admin.sql.
  -- Deriving it from an env var here would mean anyone who can set that
  -- var owns the platform.
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    v_role
  )
  on conflict (id) do nothing;

  insert into public.credit_ledger (user_id, action, amount, balance_after, meta)
  values (new.id, 'signup_bonus', 30, 30, jsonb_build_object('source', 'google_oauth'));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── The credit gatekeeper ───────────────────────────────────────────
-- Returns the balance after the charge. Super admins pass through at
-- zero cost but are still written to the ledger so God Mode usage is
-- auditable rather than invisible.
create or replace function public.consume_credits(
  p_action public.credit_action,
  p_amount integer,
  p_meta   jsonb default '{}'::jsonb
)
returns table (balance integer, was_free boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_role     public.account_role;
  v_balance  integer;
  v_free     boolean := false;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_amount < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  select role, credits into v_role, v_balance
  from public.profiles where id = v_uid for update;

  if not found then
    raise exception 'PROFILE_MISSING' using errcode = 'P0002';
  end if;

  if v_role = 'super_admin' then
    v_free := true;
    p_amount := 0;
  end if;

  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_CREDITS:%:%', p_amount, v_balance
      using errcode = 'P0001';
  end if;

  update public.profiles
     set credits = credits - p_amount,
         lifetime_spent = lifetime_spent + p_amount,
         last_seen_at = now()
   where id = v_uid
  returning credits into v_balance;

  insert into public.credit_ledger (user_id, action, amount, balance_after, meta)
  values (v_uid, p_action, -p_amount, v_balance, p_meta || jsonb_build_object('free', v_free));

  return query select v_balance, v_free;
end;
$$;

-- ── Refund path ─────────────────────────────────────────────────────
-- Called when a paid operation fails after the charge. Nobody should
-- pay for a 500.
create or replace function public.refund_credits(
  p_amount integer,
  p_reason text default 'operation_failed'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount <= 0 then return null; end if;

  update public.profiles
     set credits = credits + p_amount,
         lifetime_spent = greatest(0, lifetime_spent - p_amount)
   where id = v_uid
  returning credits into v_balance;

  insert into public.credit_ledger (user_id, action, amount, balance_after, meta)
  values (v_uid, 'refund', p_amount, v_balance, jsonb_build_object('reason', p_reason));

  return v_balance;
end;
$$;

-- ── God Mode: inject credits into any account ───────────────────────
create or replace function public.grant_credits(
  p_target uuid,
  p_amount integer,
  p_note   text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.account_role;
  v_balance integer;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is distinct from 'super_admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_amount = 0 then return null; end if;

  update public.profiles
     set credits = greatest(0, credits + p_amount)
   where id = p_target
  returning credits into v_balance;

  if not found then raise exception 'TARGET_NOT_FOUND'; end if;

  insert into public.credit_ledger (user_id, action, amount, balance_after, meta)
  values (p_target, 'grant', p_amount, v_balance,
          jsonb_build_object('by', auth.uid(), 'note', p_note));

  return v_balance;
end;
$$;

-- ── God Mode: kill switch ───────────────────────────────────────────
create or replace function public.set_api_switch(
  p_places boolean,
  p_gemini boolean,
  p_notice text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role public.account_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'super_admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.app_settings
     set places_enabled = p_places,
         gemini_enabled = p_gemini,
         notice = p_notice,
         updated_at = now(),
         updated_by = auth.uid()
   where id = 1;
end;
$$;

-- keep leads.updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists leads_touch_updated on public.leads;
create trigger leads_touch_updated
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles      enable row level security;
alter table public.leads         enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.app_settings  enable row level security;

-- Helper kept STABLE so the planner calls it once per statement.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin') $$;

-- profiles ----------------------------------------------------------
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- The lock that actually matters: a user may update their own row, but
-- not the two columns that are worth money.
revoke update on public.profiles from authenticated;
grant  update (full_name, avatar_url, locale, last_seen_at) on public.profiles to authenticated;

-- leads -------------------------------------------------------------
drop policy if exists leads_owner_all on public.leads;
create policy leads_owner_all on public.leads
  for all using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid());

-- credit_ledger -----------------------------------------------------
drop policy if exists ledger_read_own on public.credit_ledger;
create policy ledger_read_own on public.credit_ledger
  for select using (user_id = auth.uid() or public.is_super_admin());
-- No INSERT policy on purpose: only SECURITY DEFINER functions write here.

-- app_settings ------------------------------------------------------
drop policy if exists settings_read_all on public.app_settings;
create policy settings_read_all on public.app_settings
  for select using (auth.role() = 'authenticated');

-- ── Realtime ────────────────────────────────────────────────────────
-- Credit balance changes must reach the user's screen without a refresh.
-- Wrapped because re-running the migration would otherwise abort here.
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_settings;
exception when duplicate_object then null; end $$;
