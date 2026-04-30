-- Dine-with tagging feature
-- Lets users tag friends on their restaurant/cafe visits.

-- ── 1. Add meta column to notifications ──────────────────────────────────────
-- Stores structured data for dine_tag notifications (restaurant_name, etc.)
alter table public.notifications
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Extend the type constraint to include 'dine_tag'.
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
    check (type in ('follow', 'taste_buds', 'dine_tag'));

-- ── 2. dine_with_tags table ───────────────────────────────────────────────────
create table if not exists public.dine_with_tags (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  entry_id        uuid,                          -- restaurant_visit / cafe_visit id; null until tagged user logs it
  entry_type      text        not null check (entry_type in ('restaurant', 'cafe')),
  tagger_id       uuid        not null references public.profiles(id) on delete cascade,
  tagged_id       uuid        not null references public.profiles(id) on delete cascade,
  restaurant_name text        not null,
  city            text        not null default '',
  cuisine         text        not null default '',
  dismissed       boolean     not null default false
);

create index if not exists dine_with_tags_tagged_id_idx
  on public.dine_with_tags (tagged_id, created_at desc);

create index if not exists dine_with_tags_tagger_id_idx
  on public.dine_with_tags (tagger_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.dine_with_tags enable row level security;

-- Either party can read their own tags.
create policy "dine_with_tags select own"
  on public.dine_with_tags for select
  using (auth.uid() = tagger_id or auth.uid() = tagged_id);

-- Any authenticated user can insert a tag (tagger creates it for tagged_id).
create policy "dine_with_tags insert authenticated"
  on public.dine_with_tags for insert
  to authenticated
  with check (auth.uid() = tagger_id);

-- Tagged user can dismiss their own tags.
create policy "dine_with_tags update tagged"
  on public.dine_with_tags for update
  using (auth.uid() = tagged_id);

-- Tagger can delete their own tags (undo).
create policy "dine_with_tags delete tagger"
  on public.dine_with_tags for delete
  using (auth.uid() = tagger_id);
