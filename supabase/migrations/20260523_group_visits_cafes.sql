-- Group visits Phase 2: cafés (drinks + sweets)
--
-- Phase 1 (`20260522_group_visits.sql`) was scoped restaurants-only with the
-- comment "Adding cafés would mean a second `kind` column + nullable cafe_visits
-- FK; we'll do that in a follow-up if it's worth the complexity." This is that
-- follow-up.
--
-- The existing `dine_with_tags` system still drives co-diner pills on feed/log
-- cards for both kinds; group_visits sits on top and provides:
--   – dedupe (collapse parallel logs of the same coffee/dessert into one row),
--   – status tracking (pending → resolved/expired) for "still waiting on …" UX,
--   – structured prefill for cafe notification taps.
--
-- Approach (Option C from the plan): keep the same parent + members tables and
-- split `place_id` / `visit_id` into `restaurant_*_id` / `cafe_*_id` pairs +
-- a `kind` discriminator on the parent. Trigger and expiry RPC stay
-- kind-agnostic — they only inspect `status` / `visited_at`. RLS unchanged.
--
-- `restaurant_name` is reused as a generic "place display name" for both kinds.
-- We could rename it to `place_name` but that'd cascade through every
-- notification meta and prefill consumer for no functional gain — leaving it.

-- ── 1. group_visits: add kind + split FK columns ────────────────────────────

alter table public.group_visits
  add column if not exists kind text not null default 'restaurant';

-- Drop any prior version of the kind check (in case this migration is re-run
-- after a partial apply) before re-adding.
alter table public.group_visits
  drop constraint if exists group_visits_kind_check;

alter table public.group_visits
  add constraint group_visits_kind_check
  check (kind in ('restaurant', 'cafe'));

alter table public.group_visits
  add column if not exists restaurant_place_id uuid
  references public.restaurant_places(id) on delete restrict;

alter table public.group_visits
  add column if not exists cafe_place_id uuid
  references public.cafe_places(id) on delete restrict;

-- Backfill: every existing row is a restaurant. The legacy place_id column
-- still exists at this point; copy it over before we drop it.
update public.group_visits
   set restaurant_place_id = place_id
 where place_id is not null
   and restaurant_place_id is null;

alter table public.group_visits drop column if exists place_id;

-- Exactly one place column non-null and it agrees with kind. Guards against
-- app-side bugs writing the wrong column.
alter table public.group_visits
  drop constraint if exists group_visits_place_kind_check;

alter table public.group_visits
  add constraint group_visits_place_kind_check
  check (
    (kind = 'restaurant' and restaurant_place_id is not null and cafe_place_id is null)
    or (kind = 'cafe' and cafe_place_id is not null and restaurant_place_id is null)
  );

-- ── 2. group_visits indexes ──────────────────────────────────────────────────

-- Old combined index keyed off the dropped place_id; replace with two partial
-- indexes (one per kind) so candidate-match queries stay cheap.
drop index if exists public.group_visits_place_visited_idx;

create index if not exists group_visits_restaurant_place_visited_idx
  on public.group_visits (restaurant_place_id, visited_at desc)
  where restaurant_place_id is not null;

create index if not exists group_visits_cafe_place_visited_idx
  on public.group_visits (cafe_place_id, visited_at desc)
  where cafe_place_id is not null;

-- Pending-status index unchanged (it filters on status only).

-- ── 3. group_visit_members: split visit FK ──────────────────────────────────

alter table public.group_visit_members
  add column if not exists restaurant_visit_id uuid
  references public.restaurant_visits(id) on delete set null;

alter table public.group_visit_members
  add column if not exists cafe_visit_id uuid
  references public.cafe_visits(id) on delete set null;

-- Backfill: every existing member row points at a restaurant_visits row
-- (Phase 1 was restaurants-only).
update public.group_visit_members
   set restaurant_visit_id = visit_id
 where visit_id is not null
   and restaurant_visit_id is null;

alter table public.group_visit_members drop column if exists visit_id;

-- At-most-one constraint (vs exactly-one — visit_id is allowed to be null on
-- pending members who haven't logged yet).
alter table public.group_visit_members
  drop constraint if exists group_visit_members_visit_at_most_one_check;

alter table public.group_visit_members
  add constraint group_visit_members_visit_at_most_one_check
  check (not (restaurant_visit_id is not null and cafe_visit_id is not null));

-- The trigger and expiry RPC from 20260522_group_visits.sql don't reference
-- visit_id / place_id, so they continue to work unchanged.
