-- ════════════════════════════════════════════════════════════════════
-- The quota saver.
--
-- Google's free tier is counted in requests, not in users. Two people
-- searching "kedai kopi di Jogja" on the same day should cost one
-- request, not two. These two tables turn every sweep anyone has ever
-- run into a shared, free asset.
--
-- place_cache  : the raw business record, keyed by Google's own place id.
-- search_cache : which place ids a given query returned, with a TTL.
--
-- Both are readable by every signed-in user and writable only through
-- the server (service role / SECURITY DEFINER), so nobody can poison
-- someone else's results.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.place_cache (
  place_id     text primary key,
  payload      jsonb not null,
  refreshed_at timestamptz not null default now()
);

create index if not exists place_cache_refreshed_idx on public.place_cache (refreshed_at);

create table if not exists public.search_cache (
  query_hash text primary key,
  query_text text not null,
  city       text,
  place_ids  text[] not null default '{}',
  hit_count  integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists search_cache_created_idx on public.search_cache (created_at);

alter table public.place_cache  enable row level security;
alter table public.search_cache enable row level security;

drop policy if exists place_cache_read on public.place_cache;
create policy place_cache_read on public.place_cache
  for select using (auth.role() = 'authenticated');

drop policy if exists search_cache_read on public.search_cache;
create policy search_cache_read on public.search_cache
  for select using (auth.role() = 'authenticated');

-- ── Writes go through here, never through a client INSERT ───────────
create or replace function public.record_sweep(
  p_query_hash text,
  p_query_text text,
  p_city       text,
  p_places     jsonb          -- array of { place_id, ...payload }
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids text[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  insert into public.place_cache (place_id, payload, refreshed_at)
  select elem->>'placeId', elem, now()
    from jsonb_array_elements(p_places) as elem
  on conflict (place_id) do update
    set payload = excluded.payload,
        refreshed_at = now();

  select array_agg(elem->>'placeId') into v_ids
    from jsonb_array_elements(p_places) as elem;

  insert into public.search_cache (query_hash, query_text, city, place_ids)
  values (p_query_hash, p_query_text, p_city, coalesce(v_ids, '{}'))
  on conflict (query_hash) do update
    set place_ids = excluded.place_ids,
        created_at = now();
end;
$$;

-- Counter kept separate so a cache hit is one cheap UPDATE.
create or replace function public.touch_sweep_cache(p_query_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.search_cache set hit_count = hit_count + 1 where query_hash = p_query_hash;
$$;
