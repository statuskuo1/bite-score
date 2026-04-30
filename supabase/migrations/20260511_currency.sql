-- Currency support migration
-- Adds home_currency to profiles and currency_code to visit tables.

-- ── 1. Profiles: home currency preference ────────────────────────────────────
alter table public.profiles
  add column if not exists home_currency text not null default 'USD';

-- ── 2. Restaurant visits: per-entry currency ─────────────────────────────────
alter table public.restaurant_visits
  add column if not exists currency_code text not null default 'USD';

-- ── 3. Cafe visits: per-entry currency ───────────────────────────────────────
alter table public.cafe_visits
  add column if not exists currency_code text not null default 'USD';
