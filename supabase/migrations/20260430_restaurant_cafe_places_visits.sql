-- Normalized restaurants/cafés: shared place rows + per-user visit rows.
-- Apply after existing auth migrations. Legacy `restaurants` / `cafes` tables unchanged.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Restaurant places & visits
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_places (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cuisine text not null default '',
  cuisine2 text not null default '',
  is_fusion boolean not null default false,
  city text not null default ''
);

create table if not exists public.restaurant_visits (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.restaurant_places (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  taste numeric not null,
  cost numeric not null,
  portions numeric not null,
  wait numeric not null default 0,
  repeatability smallint not null default 1,
  use_r boolean not null default true,
  notes text not null default '',
  visited_at timestamptz not null default now()
);

create index if not exists restaurant_visits_user_id_idx on public.restaurant_visits (user_id);
create index if not exists restaurant_visits_place_id_idx on public.restaurant_visits (place_id);
create index if not exists restaurant_visits_visited_at_idx on public.restaurant_visits (visited_at);

-- ---------------------------------------------------------------------------
-- Café places & visits
-- ---------------------------------------------------------------------------
create table if not exists public.cafe_places (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text not null default ''
);

create table if not exists public.cafe_visits (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.cafe_places (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null default 'Coffee',
  order_item text not null default '',
  taste numeric not null,
  cost numeric not null,
  portions numeric not null,
  wait numeric not null default 0,
  milk_level text not null default '',
  bean_region text not null default '',
  repeatability smallint not null default 1,
  use_r boolean not null default true,
  notes text not null default '',
  visited_at timestamptz not null default now()
);

create index if not exists cafe_visits_user_id_idx on public.cafe_visits (user_id);
create index if not exists cafe_visits_place_id_idx on public.cafe_visits (place_id);
create index if not exists cafe_visits_visited_at_idx on public.cafe_visits (visited_at);

-- ---------------------------------------------------------------------------
-- RLS: places = shared catalog (auth read/write); visits = own rows only
-- ---------------------------------------------------------------------------
alter table public.restaurant_places enable row level security;
alter table public.restaurant_visits enable row level security;
alter table public.cafe_places enable row level security;
alter table public.cafe_visits enable row level security;

drop policy if exists "restaurant_places_select_auth" on public.restaurant_places;
create policy "restaurant_places_select_auth"
  on public.restaurant_places for select
  to authenticated
  using (true);

drop policy if exists "restaurant_places_insert_auth" on public.restaurant_places;
create policy "restaurant_places_insert_auth"
  on public.restaurant_places for insert
  to authenticated
  with check (true);

drop policy if exists "restaurant_places_update_auth" on public.restaurant_places;
create policy "restaurant_places_update_auth"
  on public.restaurant_places for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "restaurant_visits_select_own" on public.restaurant_visits;
create policy "restaurant_visits_select_own"
  on public.restaurant_visits for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "restaurant_visits_insert_own" on public.restaurant_visits;
create policy "restaurant_visits_insert_own"
  on public.restaurant_visits for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "restaurant_visits_update_own" on public.restaurant_visits;
create policy "restaurant_visits_update_own"
  on public.restaurant_visits for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "restaurant_visits_delete_own" on public.restaurant_visits;
create policy "restaurant_visits_delete_own"
  on public.restaurant_visits for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "cafe_places_select_auth" on public.cafe_places;
create policy "cafe_places_select_auth"
  on public.cafe_places for select
  to authenticated
  using (true);

drop policy if exists "cafe_places_insert_auth" on public.cafe_places;
create policy "cafe_places_insert_auth"
  on public.cafe_places for insert
  to authenticated
  with check (true);

drop policy if exists "cafe_places_update_auth" on public.cafe_places;
create policy "cafe_places_update_auth"
  on public.cafe_places for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "cafe_visits_select_own" on public.cafe_visits;
create policy "cafe_visits_select_own"
  on public.cafe_visits for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "cafe_visits_insert_own" on public.cafe_visits;
create policy "cafe_visits_insert_own"
  on public.cafe_visits for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "cafe_visits_update_own" on public.cafe_visits;
create policy "cafe_visits_update_own"
  on public.cafe_visits for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "cafe_visits_delete_own" on public.cafe_visits;
create policy "cafe_visits_delete_own"
  on public.cafe_visits for delete
  to authenticated
  using (user_id = auth.uid());
