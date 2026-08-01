-- ════════════════════════════════════════════════════════════════════
-- WORK STREAK + AI DAILY BUDGET
--
-- Two small additions, both deliberately cheap:
--
--  1. **The streak is derived, not stored.** `credit_ledger` is already
--     append-only and already stamps every billable action with a
--     timestamp, so "days you actually worked" is a query, not a new
--     column to keep in sync. Nothing to migrate, nothing to drift, and
--     it is retroactively correct for every existing user from day one.
--
--     Days are counted in Asia/Jakarta, not UTC. A freelancer working at
--     23:30 in Jakarta is on today, not tomorrow — getting this wrong
--     would break the streak of exactly the people who use the app most.
--
--  2. **`ai_daily_budget`** gives God Mode a line to draw. Gemini's free
--     tier is metered per key per day, and the console already counts
--     calls; it just had no idea what "too many" looked like.
-- ════════════════════════════════════════════════════════════════════

alter table public.app_settings
  add column if not exists ai_daily_budget integer not null default 200
    check (ai_daily_budget > 0);

-- ── The streak ──────────────────────────────────────────────────────
-- Counts back from today (or yesterday, if today is still empty) for as
-- long as there is an unbroken run of days with at least one billable
-- action. Yesterday is allowed as the anchor so the streak does not
-- appear to reset every morning before the first sweep.
create or replace function public.my_streak()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_today   date;
  v_current integer := 0;
  v_longest integer := 0;
  v_run     integer := 0;
  v_prev    date;
  v_day     date;
  v_first   boolean := true;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;

  -- Walk distinct active days newest-first, once.
  for v_day in
    select distinct ((created_at at time zone 'Asia/Jakarta')::date) as d
      from public.credit_ledger
     where user_id = v_uid
       and action in ('scrape', 'score', 'pitch', 'deep_pitch', 'copilot')
     order by d desc
  loop
    if v_first then
      -- The current streak only counts if the most recent active day is
      -- today or yesterday; anything older means it is already broken.
      if v_day >= v_today - 1 then
        v_current := 1;
      end if;
      v_run := 1;
      v_first := false;
    elsif v_prev - v_day = 1 then
      v_run := v_run + 1;
      if v_current > 0 and v_current = v_run - 1 then
        v_current := v_run;
      end if;
    else
      v_run := 1;
    end if;

    if v_run > v_longest then v_longest := v_run; end if;
    v_prev := v_day;
  end loop;

  return jsonb_build_object(
    'current', v_current,
    'longest', v_longest,
    'todayActions', (
      select count(*) from public.credit_ledger
       where user_id = v_uid
         and action in ('scrape', 'score', 'pitch', 'deep_pitch', 'copilot')
         and (created_at at time zone 'Asia/Jakarta')::date = v_today
    ),
    'contactedToday', (
      select count(*) from public.leads
       where user_id = v_uid
         and status <> 'new'
         and (updated_at at time zone 'Asia/Jakarta')::date = v_today
    )
  );
end;
$$;

-- ── god_stats gains the budget line ─────────────────────────────────
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
  select pr.role into v_role from public.profiles pr where pr.id = auth.uid();
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
    'aiDailyBudget',        (select ai_daily_budget from public.app_settings where id = 1),
    'keysTotal',            (select count(*) from public.api_keys where provider = 'gemini'),
    'keysActive',           (select count(*) from public.api_keys where provider = 'gemini' and active)
  ) into v_out;

  return v_out;
end;
$$;

-- ── Budget setter ───────────────────────────────────────────────────
create or replace function public.admin_set_ai_budget(p_budget integer)
returns integer
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
  if p_budget is null or p_budget < 1 or p_budget > 100000 then
    raise exception 'INVALID_BUDGET' using errcode = '22023';
  end if;

  update public.app_settings set ai_daily_budget = p_budget, updated_at = now() where id = 1;
  return p_budget;
end;
$$;

-- ── Grants: PUBLIC first, always (see 0004) ─────────────────────────
revoke all on function public.my_streak()                    from public, anon;
revoke all on function public.god_stats()                    from public, anon;
revoke all on function public.admin_set_ai_budget(integer)   from public, anon;

grant execute on function public.my_streak()                  to authenticated;
grant execute on function public.god_stats()                  to authenticated;
grant execute on function public.admin_set_ai_budget(integer) to authenticated;
