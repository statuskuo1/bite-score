-- Google Places verification on shared *_places rows.
-- Companion to docs/decisions/2026-04-28-google-places-verified-fields.md.
-- Adds verified_* fields populated by the `places-resolve` Edge Function once
-- per new place, plus monthly usage counter + alert log used by the budget
-- guardrail. Existing rows stay as-is (verified_* null) until they're touched.

-- ---------------------------------------------------------------------------
-- restaurant_places: verified fields + dedup index
-- ---------------------------------------------------------------------------
alter table public.restaurant_places
  add column if not exists google_place_id text,
  add column if not exists verified_name text,
  add column if not exists verified_cuisine text,
  add column if not exists verified_city text,
  add column if not exists lat numeric,
  add column if not exists lng numeric,
  add column if not exists verified_at timestamptz;

create unique index if not exists restaurant_places_google_place_id_uniq
  on public.restaurant_places (google_place_id)
  where google_place_id is not null;

-- ---------------------------------------------------------------------------
-- cafe_places: same set minus verified_cuisine (cafes have no cuisine column)
-- ---------------------------------------------------------------------------
alter table public.cafe_places
  add column if not exists google_place_id text,
  add column if not exists verified_name text,
  add column if not exists verified_city text,
  add column if not exists lat numeric,
  add column if not exists lng numeric,
  add column if not exists verified_at timestamptz;

create unique index if not exists cafe_places_google_place_id_uniq
  on public.cafe_places (google_place_id)
  where google_place_id is not null;

-- ---------------------------------------------------------------------------
-- places_api_usage: one row per YYYY-MM, atomically incremented per Google call
-- ---------------------------------------------------------------------------
create table if not exists public.places_api_usage (
  year_month text primary key,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.places_api_usage enable row level security;

drop policy if exists "places_api_usage_select_auth" on public.places_api_usage;
create policy "places_api_usage_select_auth"
  on public.places_api_usage for select
  to authenticated
  using (true);
-- No insert/update/delete for clients — only service_role from Edge Functions.

-- Atomic upsert + increment. SECURITY DEFINER so the Edge Function's service
-- role identity can call it; nothing else needs to. Returns the new monthly
-- count so the function can compare against soft/hard caps in one round-trip.
create or replace function public.places_api_usage_increment(p_year_month text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.places_api_usage (year_month, count, updated_at)
  values (p_year_month, 1, now())
  on conflict (year_month)
  do update set
    count = public.places_api_usage.count + 1,
    updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.places_api_usage_increment(text) from public;
grant execute on function public.places_api_usage_increment(text) to service_role;

-- ---------------------------------------------------------------------------
-- places_api_alerts: budget guardrail + Google-error log
-- ---------------------------------------------------------------------------
create table if not exists public.places_api_alerts (
  id uuid primary key default uuid_generate_v4(),
  kind text not null,                  -- 'restaurant' | 'cafe'
  query text not null default '',
  user_id uuid,                        -- nullable: function may not always know
  reason text not null,                -- 'soft_cap' | 'hard_cap' | 'google_error'
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists places_api_alerts_created_at_idx
  on public.places_api_alerts (created_at desc);

alter table public.places_api_alerts enable row level security;

drop policy if exists "places_api_alerts_select_auth" on public.places_api_alerts;
create policy "places_api_alerts_select_auth"
  on public.places_api_alerts for select
  to authenticated
  using (true);
-- Inserts come from the Edge Functions via service_role only.
