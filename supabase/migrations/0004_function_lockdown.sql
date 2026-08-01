-- ════════════════════════════════════════════════════════════════════
-- FUNCTION LOCKDOWN — found by probing the live API, not by reading code
--
-- Supabase publishes every function in `public` at /rest/v1/rpc/<name>.
-- Two real holes existed:
--
--  1. `refund_credits` only checked that the caller was signed in. Any
--     user could POST {"p_amount": 999999} and mint credits. It is now
--     server-only, takes an explicit user id (service_role has no
--     auth.uid()), and caps a single refund at the largest billable
--     action.
--
--  2. The first revoke attempt targeted `anon` and `authenticated` and
--     changed nothing, because Postgres grants EXECUTE on every new
--     function to the pseudo-role PUBLIC, which both inherit from. A
--     live probe with the anon key proved the call still ran. The fix is
--     to revoke from PUBLIC first, then grant back explicitly.
--
-- Verified afterwards: with the anon key, all eight functions return
-- 42501 "permission denied", and `authenticated` retains exactly the
-- four it needs.
-- ════════════════════════════════════════════════════════════════════

-- ── refund: explicit actor, hard cap, server-only ───────────────────
drop function if exists public.refund_credits(integer, text);

create or replace function public.refund_credits(
  p_user   uuid,
  p_amount integer,
  p_reason text default 'operation_failed'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user is null then raise exception 'USER_REQUIRED'; end if;
  if p_amount <= 0 then return null; end if;
  -- Defence in depth: even with the grants wrong, a refund can never
  -- exceed the most expensive single action in the price table.
  if p_amount > 50 then raise exception 'REFUND_TOO_LARGE'; end if;

  update public.profiles
     set credits = credits + p_amount,
         lifetime_spent = greatest(0, lifetime_spent - p_amount)
   where id = p_user
  returning credits into v_balance;

  if not found then raise exception 'TARGET_NOT_FOUND'; end if;

  insert into public.credit_ledger (user_id, action, amount, balance_after, meta)
  values (p_user, 'refund', p_amount, v_balance, jsonb_build_object('reason', p_reason));

  return v_balance;
end;
$$;

-- ── cache writers: no auth.uid() dependency, server-only ────────────
create or replace function public.record_sweep(
  p_query_hash text,
  p_query_text text,
  p_city       text,
  p_places     jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids text[];
begin
  insert into public.place_cache (place_id, payload, refreshed_at)
  select elem->>'placeId', elem, now()
    from jsonb_array_elements(p_places) as elem
   where elem->>'placeId' is not null
  on conflict (place_id) do update
    set payload = excluded.payload,
        refreshed_at = now();

  select array_agg(elem->>'placeId') into v_ids
    from jsonb_array_elements(p_places) as elem
   where elem->>'placeId' is not null;

  insert into public.search_cache (query_hash, query_text, city, place_ids)
  values (p_query_hash, p_query_text, p_city, coalesce(v_ids, '{}'))
  on conflict (query_hash) do update
    set place_ids = excluded.place_ids,
        created_at = now();
end;
$$;

-- ── search_path pinned so the trigger cannot be hijacked ────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── Owner auto-promotion, stored in the database not an env var ─────
alter table public.app_settings
  add column if not exists owner_email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  public.account_role := 'user';
  v_owner text;
begin
  select owner_email into v_owner from public.app_settings where id = 1;

  if v_owner is not null and lower(new.email) = lower(v_owner) then
    v_role := 'super_admin';
  end if;

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

-- ════════════════════════════════════════════════════════════════════
-- GRANTS — revoke from PUBLIC first, then hand back deliberately
-- ════════════════════════════════════════════════════════════════════

revoke all on function public.refund_credits(uuid, integer, text)                   from public, anon, authenticated;
revoke all on function public.record_sweep(text, text, text, jsonb)                 from public, anon, authenticated;
revoke all on function public.touch_sweep_cache(text)                               from public, anon, authenticated;
revoke all on function public.handle_new_user()                                     from public, anon, authenticated;
revoke all on function public.grant_credits(uuid, integer, text)                    from public, anon;
revoke all on function public.set_api_switch(boolean, boolean, text)                from public, anon;
revoke all on function public.consume_credits(public.credit_action, integer, jsonb) from public, anon;
revoke all on function public.is_super_admin()                                      from public, anon;

-- Server-only.
grant execute on function public.refund_credits(uuid, integer, text)   to service_role;
grant execute on function public.record_sweep(text, text, text, jsonb) to service_role;
grant execute on function public.touch_sweep_cache(text)               to service_role;

-- Signed-in users. Each re-verifies the caller internally: consume_credits
-- can only debit whoever calls it, and the God Mode pair check super_admin
-- against the profiles table before acting.
grant execute on function public.consume_credits(public.credit_action, integer, jsonb) to authenticated;
grant execute on function public.grant_credits(uuid, integer, text)                    to authenticated;
grant execute on function public.set_api_switch(boolean, boolean, text)                to authenticated;
-- Referenced by the RLS policies on profiles and leads, so signed-in
-- users must keep EXECUTE or every read fails with 42501.
grant execute on function public.is_super_admin()                                      to authenticated, service_role;
