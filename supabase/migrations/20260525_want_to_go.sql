-- BITE Score: want_to_go (saved places)
-- Codifies a table that already exists on deployed DBs. Idempotent so this
-- migration is safe to re-apply on environments where the client-side writes
-- in src/utils/wantToGoApi.js implicitly created the shape earlier.
--
-- Adds the `category` column used by the Explore "Want to Go" tab to bucket
-- cafe-kind rows into Drinks vs Sweets without a cross-table join on read.

create table if not exists public.want_to_go (
  user_id    uuid not null references auth.users (id) on delete cascade,
  place_id   uuid not null,
  kind       text not null check (kind in ('rest','cafe')),
  name       text,
  cuisine    text,
  city       text,
  category   text,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id, kind)
);

alter table public.want_to_go add column if not exists category text;
alter table public.want_to_go add column if not exists created_at timestamptz not null default now();

create index if not exists want_to_go_user_created_idx
  on public.want_to_go (user_id, created_at desc);

alter table public.want_to_go enable row level security;

grant select, insert, update, delete on public.want_to_go to authenticated;

drop policy if exists "want_to_go_select_own" on public.want_to_go;
drop policy if exists "want_to_go_insert_own" on public.want_to_go;
drop policy if exists "want_to_go_update_own" on public.want_to_go;
drop policy if exists "want_to_go_delete_own" on public.want_to_go;

create policy "want_to_go_select_own"
  on public.want_to_go for select
  to authenticated
  using (user_id = auth.uid());

create policy "want_to_go_insert_own"
  on public.want_to_go for insert
  to authenticated
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "want_to_go_update_own"
  on public.want_to_go for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "want_to_go_delete_own"
  on public.want_to_go for delete
  to authenticated
  using (user_id = auth.uid());
