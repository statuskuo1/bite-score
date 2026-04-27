-- BITE Score: profiles, user_id columns, RLS
-- Run in Supabase SQL Editor once per project (or via supabase db push).

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

-- New signups: mirror auth.users into profiles (SECURITY DEFINER bypasses RLS)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, is_admin)
  values (new.id, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- Authenticated users read only their own profile (for is_admin in UI)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- No direct client inserts/updates/deletes on profiles (admin flag via SQL editor)

-- ---------------------------------------------------------------------------
-- restaurants / cafes: ownership
-- ---------------------------------------------------------------------------
alter table public.restaurants add column if not exists user_id uuid references auth.users (id);
alter table public.cafes add column if not exists user_id uuid references auth.users (id);

create index if not exists restaurants_user_id_idx on public.restaurants (user_id);
create index if not exists cafes_user_id_idx on public.cafes (user_id);

alter table public.restaurants enable row level security;
alter table public.cafes enable row level security;

-- Drop legacy permissive policies if re-running migration (names may vary)
drop policy if exists "restaurants_select_all" on public.restaurants;
drop policy if exists "restaurants_insert_own" on public.restaurants;
drop policy if exists "restaurants_update_own_or_admin" on public.restaurants;
drop policy if exists "restaurants_delete_own_or_admin" on public.restaurants;

create policy "restaurants_select_all"
  on public.restaurants for select
  using (true);

create policy "restaurants_insert_own"
  on public.restaurants for insert
  to authenticated
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "restaurants_update_own_or_admin"
  on public.restaurants for update
  to authenticated
  using (
    user_id = auth.uid()
    or (
      user_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
      )
    )
  )
  with check (
    user_id = auth.uid()
    or (
      user_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
      )
    )
  );

create policy "restaurants_delete_own_or_admin"
  on public.restaurants for delete
  to authenticated
  using (
    user_id = auth.uid()
    or (
      user_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
      )
    )
  );

drop policy if exists "cafes_select_all" on public.cafes;
drop policy if exists "cafes_insert_own" on public.cafes;
drop policy if exists "cafes_update_own_or_admin" on public.cafes;
drop policy if exists "cafes_delete_own_or_admin" on public.cafes;

create policy "cafes_select_all"
  on public.cafes for select
  using (true);

create policy "cafes_insert_own"
  on public.cafes for insert
  to authenticated
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "cafes_update_own_or_admin"
  on public.cafes for update
  to authenticated
  using (
    user_id = auth.uid()
    or (
      user_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
      )
    )
  )
  with check (
    user_id = auth.uid()
    or (
      user_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
      )
    )
  );

create policy "cafes_delete_own_or_admin"
  on public.cafes for delete
  to authenticated
  using (
    user_id = auth.uid()
    or (
      user_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
      )
    )
  );

-- ---------------------------------------------------------------------------
-- settings: admins only for writes; public read
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;

drop policy if exists "settings_select_all" on public.settings;
drop policy if exists "settings_write_admin" on public.settings;

create policy "settings_select_all"
  on public.settings for select
  using (true);

create policy "settings_write_admin"
  on public.settings for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
