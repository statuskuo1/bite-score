-- Profiles: username, display_name, avatar_url; visit FK → profiles; community read policies.

-- ---------------------------------------------------------------------------
-- profiles columns (keep is_admin for legacy)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;

-- ---------------------------------------------------------------------------
-- Ensure every auth user has a profile row (before visit FK → profiles)
-- ---------------------------------------------------------------------------
insert into public.profiles (id, is_admin)
select u.id, false
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

update public.profiles p
set
  username = coalesce(nullif(trim(username), ''), left(split_part(u.email::text, '@', 1), 80), 'user'),
  display_name = coalesce(nullif(trim(display_name), ''), left(split_part(u.email::text, '@', 1), 120), 'Member')
from auth.users u
where u.id = p.id
  and (p.username is null or trim(p.username) = '' or p.display_name is null or trim(p.display_name) = '');

-- ---------------------------------------------------------------------------
-- Sign-up trigger: populate profile from auth metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_local text;
  meta jsonb;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  email_local := split_part(coalesce(new.email, ''), '@', 1);

  insert into public.profiles (id, is_admin, username, display_name, avatar_url)
  values (
    new.id,
    false,
    left(coalesce(
      nullif(trim(meta->>'preferred_username'), ''),
      nullif(trim(meta->>'user_name'), ''),
      nullif(trim(email_local), ''),
      'user'
    ), 80),
    left(coalesce(
      nullif(trim(meta->>'full_name'), ''),
      nullif(trim(meta->>'name'), ''),
      nullif(trim(email_local), ''),
      'Member'
    ), 120),
    nullif(trim(coalesce(
      meta->>'avatar_url',
      meta->>'picture'
    )), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: profiles — any signed-in user can read (for joins / leaderboard); own insert/update
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Visits: FK → profiles(id) for PostgREST embed; broaden SELECT for community feed
-- ---------------------------------------------------------------------------
alter table public.restaurant_visits drop constraint if exists restaurant_visits_user_id_fkey;
alter table public.restaurant_visits
  add constraint restaurant_visits_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.cafe_visits drop constraint if exists cafe_visits_user_id_fkey;
alter table public.cafe_visits
  add constraint cafe_visits_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

drop policy if exists "restaurant_visits_select_own" on public.restaurant_visits;
drop policy if exists "restaurant_visits_select_authenticated" on public.restaurant_visits;
create policy "restaurant_visits_select_authenticated"
  on public.restaurant_visits for select
  to authenticated
  using (true);

drop policy if exists "cafe_visits_select_own" on public.cafe_visits;
drop policy if exists "cafe_visits_select_authenticated" on public.cafe_visits;
create policy "cafe_visits_select_authenticated"
  on public.cafe_visits for select
  to authenticated
  using (true);
