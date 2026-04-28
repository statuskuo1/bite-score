-- Fresh DB: create minimal legacy tables + settings before 20260426_auth_rls.sql.
-- The live app uses restaurant_places / *_visits; legacy restaurants/cafes may stay empty.

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade
);

create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade
);

create table if not exists public.settings (
  key text primary key,
  value text not null default ''
);
