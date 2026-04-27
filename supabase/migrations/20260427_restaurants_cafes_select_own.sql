-- Restrict SELECT on restaurants/cafes to the owning user or admins (read all).
-- Anonymous clients no longer receive rows from these policies (fail closed).

drop policy if exists "restaurants_select_all" on public.restaurants;
drop policy if exists "cafes_select_all" on public.cafes;

create policy "restaurants_select_own_or_admin"
  on public.restaurants for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "cafes_select_own_or_admin"
  on public.cafes for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
