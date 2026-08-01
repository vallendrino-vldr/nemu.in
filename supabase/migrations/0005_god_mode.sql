-- ════════════════════════════════════════════════════════════════════
-- GOD MODE — full powers, and the tester switch
--
-- Four things this migration exists to make possible:
--
--  1. **Ban / warn.** Moderation used to require the Supabase dashboard.
--     A ban is enforced at the only place that matters — `consume_credits`
--     — so a banned session cannot spend even if its cookie is still warm
--     and its browser tab is still open.
--
--  2. **Bill the admin like a user.** `consume_credits` waived the charge
--     for every super_admin, which made the owner's own account useless as
--     a test subject: he could never watch a balance actually fall. The
--     waiver is now opt-out per account via `profiles.bill_admin`.
--
--  3. **Gemini keys from the UI.** Keys lived only in Vercel env vars, so
--     rotating one meant a redeploy. `api_keys` holds them instead, with
--     NO RLS policies at all — that is deliberate. A table with RLS on and
--     zero policies is readable by exactly one thing: service_role. The
--     browser cannot reach it under any grant, and the masked preview the
--     console renders is computed in a SECURITY DEFINER function that
--     never returns the secret itself.
--
--  4. **One query instead of four.** Opening God Mode ran four separate
--     aggregates and took ~7 seconds. `god_stats()` does it in one round
--     trip.
--
-- GRANT DISCIPLINE (see 0004 — this bit was learned the hard way):
-- Postgres grants EXECUTE on every new function to PUBLIC, and both
-- `anon` and `authenticated` inherit from it. Revoking from those two
-- roles alone changes NOTHING. Every function below is revoked from
-- PUBLIC first, then granted back deliberately.
-- ════════════════════════════════════════════════════════════════════

-- ── profiles: moderation + tester billing ───────────────────────────
alter table public.profiles
  add column if not exists banned_at  timestamptz,
  add column if not exists ban_reason text,
  -- The admin's message to this user. It rides the existing Realtime
  -- subscription on `profiles`, so a warning lands on their screen
  -- mid-session without a refresh and without a second channel.
  add column if not exists notice     text,
  add column if not exists notice_at  timestamptz,
  -- Opt in to being charged like everyone else. Default false keeps the
  -- historical behaviour for any admin who has not asked for it.
  add column if not exists bill_admin boolean not null default false;

create index if not exists profiles_banned_idx on public.profiles (banned_at)
  where banned_at is not null;

-- The user may clear their own warning (dismiss the banner) and nothing
-- else new. `banned_at` and `bill_admin` stay off the writable list —
-- a self-service unban would defeat the entire point.
grant update (full_name, avatar_url, locale, last_seen_at, notice) on public.profiles to authenticated;

-- ── api_keys ────────────────────────────────────────────────────────
-- RLS ON with zero policies = service_role only. Not an oversight.
create table if not exists public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null default 'gemini' check (provider in ('gemini')),
  label       text not null,
  secret      text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  last_used_at timestamptz,
  last_error  text
);

alter table public.api_keys enable row level security;
revoke all on table public.api_keys from public, anon, authenticated;

create index if not exists api_keys_active_idx on public.api_keys (provider, active);

-- ════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ════════════════════════════════════════════════════════════════════

-- ── The credit gatekeeper, now ban-aware and tester-aware ───────────
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
  v_uid     uuid := auth.uid();
  v_role    public.account_role;
  v_banned  timestamptz;
  v_bill    boolean;
  v_balance integer;
  v_free    boolean := false;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_amount < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  select role, credits, banned_at, bill_admin
    into v_role, v_balance, v_banned, v_bill
    from public.profiles where id = v_uid for update;

  if not found then
    raise exception 'PROFILE_MISSING' using errcode = 'P0002';
  end if;

  -- Enforced here rather than at sign-in because a ban has to bite an
  -- already-open session, not just the next one.
  if v_banned is not null then
    raise exception 'ACCOUNT_BANNED' using errcode = '42501';
  end if;

  -- Admins ride free unless they have asked to be billed like a user.
  if v_role = 'super_admin' and not coalesce(v_bill, false) then
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

-- ── One round trip for the whole console header ─────────────────────
create or replace function public.god_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     public.account_role;
  v_midnight timestamptz := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_out      jsonb;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'super_admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'userCount',            (select count(*) from public.profiles),
    'bannedCount',          (select count(*) from public.profiles where banned_at is not null),
    'newUsersToday',        (select count(*) from public.profiles where created_at >= v_midnight),
    'activeToday',          (select count(*) from public.profiles where last_seen_at >= v_midnight),
    'creditsInCirculation', (select coalesce(sum(credits), 0) from public.profiles),
    'creditsSpentToday',    (select coalesce(-sum(amount), 0) from public.credit_ledger
                               where amount < 0 and created_at >= v_midnight),
    'leadCount',            (select count(*) from public.leads),
    'leadsToday',           (select count(*) from public.leads where created_at >= v_midnight),
    'waReadyCount',         (select count(*) from public.leads where contact_tier = 'whatsapp'),
    'contactedCount',       (select count(*) from public.leads where status <> 'new'),
    'aiCallsToday',         (select count(*) from public.credit_ledger
                               where action in ('score','pitch','deep_pitch','copilot')
                                 and created_at >= v_midnight),
    'sweepsToday',          (select count(*) from public.credit_ledger
                               where action = 'scrape' and created_at >= v_midnight),
    'cacheHits',            (select coalesce(sum(hit_count), 0) from public.search_cache),
    'cachedQueries',        (select count(*) from public.search_cache),
    'placesEnabled',        (select places_enabled from public.app_settings where id = 1),
    'geminiEnabled',        (select gemini_enabled from public.app_settings where id = 1),
    'notice',               (select notice from public.app_settings where id = 1),
    'keysTotal',            (select count(*) from public.api_keys where provider = 'gemini'),
    'keysActive',           (select count(*) from public.api_keys where provider = 'gemini' and active)
  ) into v_out;

  return v_out;
end;
$$;

-- ── Moderation ──────────────────────────────────────────────────────
-- One function for ban and unban: passing null lifts it. Two functions
-- would be two places to forget the super_admin check.
create or replace function public.admin_set_ban(
  p_target uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   public.account_role;
  v_target public.account_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'super_admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select role into v_target from public.profiles where id = p_target;
  if not found then raise exception 'TARGET_NOT_FOUND'; end if;
  -- An admin locking themselves or a peer out of the only console that
  -- can undo it is a one-way door. Refuse.
  if v_target = 'super_admin' and p_reason is not null then
    raise exception 'CANNOT_BAN_ADMIN' using errcode = '42501';
  end if;

  update public.profiles
     set banned_at  = case when p_reason is null then null else now() end,
         ban_reason = p_reason
   where id = p_target;
end;
$$;

-- The warning the user actually sees. Null clears it.
create or replace function public.admin_set_notice(
  p_target uuid,
  p_message text default null
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

  update public.profiles
     set notice    = p_message,
         notice_at = case when p_message is null then null else now() end
   where id = p_target;

  if not found then raise exception 'TARGET_NOT_FOUND'; end if;
end;
$$;

-- ── The tester switch ───────────────────────────────────────────────
-- Only ever aimed at yourself. An admin flipping a peer into billed mode
-- is a prank, not a feature.
create or replace function public.admin_set_billing(p_enabled boolean)
returns boolean
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

  update public.profiles set bill_admin = coalesce(p_enabled, false) where id = auth.uid();
  return coalesce(p_enabled, false);
end;
$$;

-- ── Key inventory, masked ───────────────────────────────────────────
-- Returns enough to identify a key and nothing you could authenticate
-- with. The secret column never leaves the database.
create or replace function public.admin_list_api_keys()
returns table (
  id           uuid,
  provider     text,
  label        text,
  preview      text,
  active       boolean,
  created_at   timestamptz,
  last_used_at timestamptz,
  last_error   text
)
language plpgsql
security definer
set search_path = public
as $$
declare v_role public.account_role;
begin
  -- The guard is aliased because this function's OUT columns include one
  -- called `id`. A bare `where id = auth.uid()` compiles fine and then
  -- throws 42702 "column reference is ambiguous" at call time — invisible
  -- until something actually invokes it. Same applies to
  -- `god_recent_activity` below.
  select pr.role into v_role from public.profiles pr where pr.id = auth.uid();
  if v_role is distinct from 'super_admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select k.id,
           k.provider,
           k.label,
           left(k.secret, 6) || '••••' || right(k.secret, 4) as preview,
           k.active,
           k.created_at,
           k.last_used_at,
           k.last_error
      from public.api_keys k
     order by k.created_at desc;
end;
$$;

create or replace function public.admin_toggle_api_key(p_id uuid, p_active boolean)
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

  update public.api_keys set active = coalesce(p_active, false) where id = p_id;
  if not found then raise exception 'KEY_NOT_FOUND'; end if;
end;
$$;

create or replace function public.admin_delete_api_key(p_id uuid)
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

  delete from public.api_keys where id = p_id;
end;
$$;

-- Written by the server after a call succeeds or fails, so the console
-- can show which key is actually carrying traffic and which one is dead.
create or replace function public.mark_api_key(p_id uuid, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.api_keys
     set last_used_at = now(),
         last_error   = p_error
   where id = p_id;
end;
$$;

-- ── Recent activity feed for the console ────────────────────────────
create or replace function public.god_recent_activity(p_limit integer default 40)
returns table (
  id            bigint,
  user_id       uuid,
  email         text,
  full_name     text,
  action        public.credit_action,
  amount        integer,
  balance_after integer,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare v_role public.account_role;
begin
  select pr.role into v_role from public.profiles pr where pr.id = auth.uid();
  if v_role is distinct from 'super_admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select l.id, l.user_id, p.email, p.full_name,
           l.action, l.amount, l.balance_after, l.created_at
      from public.credit_ledger l
      join public.profiles p on p.id = l.user_id
     order by l.created_at desc
     limit least(coalesce(p_limit, 40), 200);
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- GRANTS — PUBLIC first, always. See the header note.
-- ════════════════════════════════════════════════════════════════════

revoke all on function public.consume_credits(public.credit_action, integer, jsonb) from public, anon;
revoke all on function public.god_stats()                                           from public, anon;
revoke all on function public.admin_set_ban(uuid, text)                             from public, anon;
revoke all on function public.admin_set_notice(uuid, text)                          from public, anon;
revoke all on function public.admin_set_billing(boolean)                            from public, anon;
revoke all on function public.admin_list_api_keys()                                 from public, anon;
revoke all on function public.admin_toggle_api_key(uuid, boolean)                   from public, anon;
revoke all on function public.admin_delete_api_key(uuid)                            from public, anon;
revoke all on function public.god_recent_activity(integer)                          from public, anon;
-- Server-only: the browser has no business telling us a key worked.
revoke all on function public.mark_api_key(uuid, text)                              from public, anon, authenticated;

grant execute on function public.consume_credits(public.credit_action, integer, jsonb) to authenticated;
grant execute on function public.god_stats()                                           to authenticated;
grant execute on function public.admin_set_ban(uuid, text)                             to authenticated;
grant execute on function public.admin_set_notice(uuid, text)                          to authenticated;
grant execute on function public.admin_set_billing(boolean)                            to authenticated;
grant execute on function public.admin_list_api_keys()                                 to authenticated;
grant execute on function public.admin_toggle_api_key(uuid, boolean)                   to authenticated;
grant execute on function public.admin_delete_api_key(uuid)                            to authenticated;
grant execute on function public.god_recent_activity(integer)                          to authenticated;
grant execute on function public.mark_api_key(uuid, text)                              to service_role;
