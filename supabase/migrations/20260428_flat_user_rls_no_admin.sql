-- Equal treatment: only own rows for restaurants/cafes (no admin bypass).
-- Settings: remove client writes (curators use SQL Editor / service role).

-- SELECT: drop admin variant from 20260427, replace with own-only
drop policy if exists "restaurants_select_own_or_admin" on public.restaurants;
drop policy if exists "cafes_select_own_or_admin" on public.cafes;

create policy "restaurants_select_own"
  on public.restaurants for select
  to authenticated
  using (user_id = auth.uid());

create policy "cafes_select_own"
  on public.cafes for select
  to authenticated
  using (user_id = auth.uid());

-- UPDATE / DELETE: drop admin + legacy-null paths; own rows only
drop policy if exists "restaurants_update_own_or_admin" on public.restaurants;
drop policy if exists "restaurants_delete_own_or_admin" on public.restaurants;

create policy "restaurants_update_own"
  on public.restaurants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "restaurants_delete_own"
  on public.restaurants for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "cafes_update_own_or_admin" on public.cafes;
drop policy if exists "cafes_delete_own_or_admin" on public.cafes;

create policy "cafes_update_own"
  on public.cafes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cafes_delete_own"
  on public.cafes for delete
  to authenticated
  using (user_id = auth.uid());

-- Global settings: read stays; remove authenticated writes from the app
drop policy if exists "settings_write_admin" on public.settings;
