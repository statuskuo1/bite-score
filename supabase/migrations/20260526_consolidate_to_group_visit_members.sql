-- Consolidate the "dined with" surface onto group_visit_members.
--
-- Today the save flow writes to BOTH `dine_with_tags` (for feed/log pill +
-- /add banner + LogTab badge) AND `group_visit_members` (for bell notifs +
-- 30-day auto-attach + party-logged celebration). The edit flow writes to
-- ONLY `dine_with_tags`, so editing breaks consistency between the two.
--
-- This migration is Phase 1 of a 5-phase deprecation: it ships the schema
-- and backfill needed to drive every "dined with" surface off
-- `group_visit_members` instead. App-side reads switch in Phase 2 (a
-- separate PR), writes switch in Phase 3, edit-flow gets fixed in Phase 4,
-- legacy table is dropped in Phase 5.
--
-- Safe to ship standalone: no app changes are required for this migration
-- to be deployed. New RPCs sit unused, new policy + trigger sit dormant
-- until edit-flow code (Phase 4) starts deleting member rows. The
-- backfill is idempotent (`on conflict do nothing` on every member upsert)
-- so re-running is safe — though only useful before Phase 3 cuts off new
-- `dine_with_tags` writes.

-- ── 1. DELETE policy on group_visit_members ─────────────────────────────────
--
-- Currently no DELETE policy exists, so deletes are blocked for everyone.
-- Symmetric with the INSERT policy: the original tagger can untag.

drop policy if exists "group_visit_members delete tagger" on public.group_visit_members;
create policy "group_visit_members delete tagger"
  on public.group_visit_members for delete
  to authenticated
  using (auth.uid() = tagged_by);

-- ── 2. AFTER DELETE trigger: mirror auto-resolve fan-out ────────────────────
--
-- Mirrors the AFTER UPDATE OF status trigger from
-- 20260504_tagging_refactor.sql lines 52-104. Without this, removing the
-- last pending member during edit (Phase 4) would leave the parent stuck
-- on 'pending' until the day-7 sweep backstop ran.
--
-- Acting user falls back to the group's `created_by` because the deleter
-- might not be a member of the group anymore (or might never have been —
-- delete RLS only requires `tagged_by = auth.uid()`).

create or replace function public.group_visit_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resolved_count integer;
  v_gv record;
  v_member_count integer;
begin
  update public.group_visits gv
     set status      = 'resolved',
         resolved_at = coalesce(gv.resolved_at, now())
   where gv.id = old.group_visit_id
     and gv.status = 'pending'
     and not exists (
       select 1
       from public.group_visit_members m
       where m.group_visit_id = gv.id
         and m.status = 'pending'
     );
  get diagnostics v_resolved_count = row_count;
  if v_resolved_count > 0 then
    select gv.id, gv.created_by, gv.kind, gv.restaurant_place_id,
           gv.cafe_place_id, gv.restaurant_name, gv.visited_at
      into v_gv
      from public.group_visits gv
     where gv.id = old.group_visit_id;
    select count(*) into v_member_count
      from public.group_visit_members
     where group_visit_id = old.group_visit_id;
    insert into public.notifications (user_id, from_user_id, type, meta)
    select m.user_id,
           v_gv.created_by,
           'group_visit_all_logged',
           jsonb_build_object(
             'group_visit_id', v_gv.id,
             'kind',           v_gv.kind,
             'place_id',       coalesce(v_gv.restaurant_place_id, v_gv.cafe_place_id),
             'restaurant_name', coalesce(v_gv.restaurant_name, ''),
             'visited_at',     v_gv.visited_at,
             'member_count',   v_member_count
           )
      from public.group_visit_members m
     where m.group_visit_id = old.group_visit_id
       and m.status = 'logged';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_group_visit_members_after_delete on public.group_visit_members;
create trigger trg_group_visit_members_after_delete
  after delete on public.group_visit_members
  for each row
  execute function public.group_visit_members_after_delete();

-- ── 3. v2 RPCs: read co-diners + pending tags from group_visit_members ──────
--
-- Replaces the legacy `fetch_co_diners*` family (which read
-- `dine_with_tags`). Same return shapes so the app can swap call sites
-- one at a time during Phase 2 without breaking existing components.
--
-- Naming: `_v2` suffix to avoid clashing with the live legacy functions.
-- Phase 5 drops the legacy ones; renaming back is purely cosmetic.

-- 3a. fetch_co_diners_for_entries_v2 ─ batched co-diners by entry id
--
-- For each entry_id passed in, finds the group_visit it's tied to via the
-- entry owner's member row (where restaurant_visit_id|cafe_visit_id =
-- entry_id) and returns OTHER members' profiles. Skipped members are
-- excluded from the pill. Pending members ARE included so the
-- pre-attach window keeps showing tagged friends who haven't logged yet.
create or replace function public.fetch_co_diners_for_entries_v2(
  p_entry_ids  uuid[],
  p_exclude_id uuid
)
returns table(
  entry_id     uuid,
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text
)
language sql
security definer
set search_path = public
as $$
  with owner_rows as (
    select coalesce(m.restaurant_visit_id, m.cafe_visit_id) as entry_id,
           m.group_visit_id,
           m.user_id as owner_user_id
      from public.group_visit_members m
     where m.restaurant_visit_id = any(p_entry_ids)
        or m.cafe_visit_id       = any(p_entry_ids)
  )
  select o.entry_id,
         p.id, p.username, p.display_name, p.avatar_url
    from owner_rows o
    join public.group_visit_members other on other.group_visit_id = o.group_visit_id
    join public.profiles p on p.id = other.user_id
   where other.status <> 'skipped'
     and other.user_id <> o.owner_user_id
     and (p_exclude_id is null or other.user_id <> p_exclude_id);
$$;

revoke all on function public.fetch_co_diners_for_entries_v2(uuid[], uuid) from public;
grant execute on function public.fetch_co_diners_for_entries_v2(uuid[], uuid) to authenticated;

-- 3b. fetch_co_diners_v2 ─ single-entry version (used by /add prefill)
--
-- Mirrors the legacy fetch_co_diners signature so callers like
-- applyDineTagPrefill can swap in directly. The "tagger" parameter is
-- ignored in this version — the group_visit already encodes the canonical
-- party, so we don't filter by tagger_id any more.
create or replace function public.fetch_co_diners_v2(
  p_entry_id   uuid,
  p_exclude_id uuid
)
returns table(
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text
)
language sql
security definer
set search_path = public
as $$
  with owner_row as (
    select m.group_visit_id, m.user_id as owner_user_id
      from public.group_visit_members m
     where m.restaurant_visit_id = p_entry_id
        or m.cafe_visit_id       = p_entry_id
     limit 1
  )
  select p.id, p.username, p.display_name, p.avatar_url
    from owner_row o
    join public.group_visit_members other on other.group_visit_id = o.group_visit_id
    join public.profiles p on p.id = other.user_id
   where other.status <> 'skipped'
     and other.user_id <> o.owner_user_id
     and (p_exclude_id is null or other.user_id <> p_exclude_id);
$$;

revoke all on function public.fetch_co_diners_v2(uuid, uuid) from public;
grant execute on function public.fetch_co_diners_v2(uuid, uuid) to authenticated;

-- 3c. fetch_pending_tags_for_user ─ /add banner + LogTab badge data source
--
-- Replaces fetchUnloggedDineTags. Returns one row per pending member-row
-- the user has, hydrated with the tagger's profile and the parent
-- group_visit's restaurant_name/place_id/visited_at so the banner can
-- prefill the Add form without a second round-trip. Filters out members
-- of expired/resolved groups since those don't represent live prompts.
create or replace function public.fetch_pending_tags_for_user(p_user_id uuid)
returns table(
  member_id           uuid,
  group_visit_id      uuid,
  restaurant_name     text,
  city                text,
  place_id            uuid,
  kind                text,
  visited_at          timestamptz,
  tagger_id           uuid,
  tagger_username     text,
  tagger_display_name text,
  tagger_avatar_url   text
)
language sql
security definer
set search_path = public
as $$
  select m.id,
         gv.id,
         gv.restaurant_name,
         coalesce(rp.city, cp.city, ''),
         coalesce(gv.restaurant_place_id, gv.cafe_place_id),
         gv.kind,
         gv.visited_at,
         m.tagged_by,
         p.username, p.display_name, p.avatar_url
    from public.group_visit_members m
    join public.group_visits gv on gv.id = m.group_visit_id
    left join public.restaurant_places rp on rp.id = gv.restaurant_place_id
    left join public.cafe_places       cp on cp.id = gv.cafe_place_id
    left join public.profiles p on p.id = m.tagged_by
   where m.user_id = p_user_id
     and m.status  = 'pending'
     and gv.status = 'pending'
   order by gv.visited_at desc;
$$;

revoke all on function public.fetch_pending_tags_for_user(uuid) from public;
grant execute on function public.fetch_pending_tags_for_user(uuid) to authenticated;

-- 3d. count_pending_tags_for_user ─ LogTab badge count
create or replace function public.count_pending_tags_for_user(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.group_visit_members m
    join public.group_visits gv on gv.id = m.group_visit_id
   where m.user_id = p_user_id
     and m.status  = 'pending'
     and gv.status = 'pending';
$$;

revoke all on function public.count_pending_tags_for_user(uuid) from public;
grant execute on function public.count_pending_tags_for_user(uuid) to authenticated;

-- ── 4. Backfill: dine_with_tags → group_visits + group_visit_members ────────
--
-- Walks every dine_with_tags row with `entry_id IS NOT NULL` (rows where
-- entry_id is null are pre-log placeholder tags — group_visit_members
-- already represents that as `status='pending'` once a parent group exists,
-- so they're dropped). For each tag:
--
--   1. Resolve (kind, place_id, visited_at) from restaurant_visits or
--      cafe_visits via the entry_type discriminator.
--   2. Find or create a group_visit at the same place ±7 days, with
--      `created_by = tagger_id`. Reusing existing matches avoids creating
--      duplicates alongside groups that were already created by
--      createGroupVisit during the dine_with_tags era (post 2026-05-22).
--   3. Upsert tagger as `status='logged'` member with their entry_id
--      attached to the kind-appropriate column.
--   4. Upsert tagged user as a member. Try to auto-link them first by
--      finding a matching restaurant_visits/cafe_visits row at the same
--      place ±30 days (mirrors auto_attach_visit_to_group_visits' window).
--      If found → status='logged' + visit_id. Otherwise → status='pending'.
--      `on conflict do nothing` so an existing member row (e.g. with
--      status='skipped') is left alone.
--
-- Idempotent: re-running with no new dine_with_tags rows is a no-op. Pass 2
-- calls tick_group_visits_expiry() so any newly-fully-logged groups
-- auto-resolve and fan out group_visit_all_logged.
--
-- This function is called once at the bottom of this migration.

create or replace function public.backfill_dine_with_tags_to_group_visits()
returns table(
  group_visits_created  integer,
  tagger_members_upserted integer,
  tagged_members_inserted integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer := 0;
  v_tagger_upserts integer := 0;
  v_tagged_inserts integer := 0;
  v_row record;
  v_visit record;
  v_gv_id uuid;
  v_tagged_match uuid;
  v_step_count integer;
begin
  for v_row in
    select dt.tagger_id, dt.tagged_id, dt.entry_id, dt.entry_type,
           dt.restaurant_name, dt.created_at
      from public.dine_with_tags dt
     where dt.entry_id is not null
     order by dt.created_at
  loop
    -- Resolve visit metadata for the entry the tag is on.
    if v_row.entry_type = 'restaurant' then
      select rv.place_id, rv.visited_at
        into v_visit
        from public.restaurant_visits rv
       where rv.id = v_row.entry_id;
    else
      select cv.place_id, cv.visited_at
        into v_visit
        from public.cafe_visits cv
       where cv.id = v_row.entry_id;
    end if;

    -- Entry was deleted (orphaned tag). Skip — no group to attach to.
    if v_visit is null or v_visit.place_id is null then
      continue;
    end if;

    -- Find an existing group_visit at this place, this kind, created by
    -- the tagger, within ±7 days of the entry's visited_at.
    select gv.id
      into v_gv_id
      from public.group_visits gv
     where gv.created_by = v_row.tagger_id
       and gv.kind = v_row.entry_type
       and case when v_row.entry_type = 'restaurant'
                then gv.restaurant_place_id = v_visit.place_id
                else gv.cafe_place_id       = v_visit.place_id
           end
       and abs(extract(epoch from (gv.visited_at - v_visit.visited_at))) <= 7 * 24 * 60 * 60
     order by gv.created_at
     limit 1;

    if v_gv_id is null then
      insert into public.group_visits
        (created_by, kind, restaurant_place_id, cafe_place_id,
         restaurant_name, visited_at, status, created_at)
      values (
        v_row.tagger_id,
        v_row.entry_type,
        case when v_row.entry_type = 'restaurant' then v_visit.place_id end,
        case when v_row.entry_type = 'cafe'       then v_visit.place_id end,
        v_row.restaurant_name,
        v_visit.visited_at,
        'pending',
        v_row.created_at
      )
      returning id into v_gv_id;
      v_created := v_created + 1;
    end if;

    -- Upsert tagger as logged member with entry_id attached. We use the
    -- entry's visited_at as a stable created_at so re-running doesn't
    -- shift the audit timestamp.
    insert into public.group_visit_members
      (group_visit_id, user_id, restaurant_visit_id, cafe_visit_id,
       tagged_by, status, created_at)
    values (
      v_gv_id,
      v_row.tagger_id,
      case when v_row.entry_type = 'restaurant' then v_row.entry_id end,
      case when v_row.entry_type = 'cafe'       then v_row.entry_id end,
      v_row.tagger_id,
      'logged',
      v_row.created_at
    )
    on conflict (group_visit_id, user_id) do update
      set status              = 'logged',
          restaurant_visit_id = coalesce(excluded.restaurant_visit_id,
                                         public.group_visit_members.restaurant_visit_id),
          cafe_visit_id       = coalesce(excluded.cafe_visit_id,
                                         public.group_visit_members.cafe_visit_id);
    get diagnostics v_step_count = row_count;
    v_tagger_upserts := v_tagger_upserts + v_step_count;

    -- Try to auto-link the tagged user to one of their existing visits at
    -- the same place ±30 days. Mirrors auto_attach_visit_to_group_visits'
    -- window but runs once at backfill time instead of on save.
    if v_row.entry_type = 'restaurant' then
      select rv.id
        into v_tagged_match
        from public.restaurant_visits rv
       where rv.user_id = v_row.tagged_id
         and rv.place_id = v_visit.place_id
         and abs(extract(epoch from (rv.visited_at - v_visit.visited_at))) <= 30 * 24 * 60 * 60
       order by abs(extract(epoch from (rv.visited_at - v_visit.visited_at)))
       limit 1;
    else
      select cv.id
        into v_tagged_match
        from public.cafe_visits cv
       where cv.user_id = v_row.tagged_id
         and cv.place_id = v_visit.place_id
         and abs(extract(epoch from (cv.visited_at - v_visit.visited_at))) <= 30 * 24 * 60 * 60
       order by abs(extract(epoch from (cv.visited_at - v_visit.visited_at)))
       limit 1;
    end if;

    -- Upsert tagged member. `do nothing` on conflict so existing member
    -- rows (e.g. status='skipped' from day-7 sweep, or status='logged'
    -- from a prior createGroupVisit run) are left alone.
    insert into public.group_visit_members
      (group_visit_id, user_id, restaurant_visit_id, cafe_visit_id,
       tagged_by, status, notified_at, created_at)
    values (
      v_gv_id,
      v_row.tagged_id,
      case when v_row.entry_type = 'restaurant' then v_tagged_match end,
      case when v_row.entry_type = 'cafe'       then v_tagged_match end,
      v_row.tagger_id,
      case when v_tagged_match is not null then 'logged' else 'pending' end,
      v_row.created_at,
      v_row.created_at
    )
    on conflict (group_visit_id, user_id) do nothing;
    get diagnostics v_step_count = row_count;
    v_tagged_inserts := v_tagged_inserts + v_step_count;

    -- Reset locals for next iteration. Without this, a continue-from-stale
    -- variable could leak across rows in some edge cases.
    v_visit := null;
    v_gv_id := null;
    v_tagged_match := null;
  end loop;

  -- Pass 2: tick the expiry sweep. Any group whose memberships are now
  -- fully logged (because backfill flipped tagged users to logged via
  -- auto-link) hits the resolve-backstop pass, which fans out
  -- group_visit_all_logged to logged members. Day-7 expiry pass also runs
  -- here and sweeps any newly-created-but-already-old groups.
  perform public.tick_group_visits_expiry();

  return query select v_created, v_tagger_upserts, v_tagged_inserts;
end;
$$;

revoke all on function public.backfill_dine_with_tags_to_group_visits() from public;
-- Not granted to authenticated — this is a one-shot admin function. Run
-- it from the SQL editor as the postgres role.

-- Run the backfill once. Output appears in the SQL editor results pane.
select * from public.backfill_dine_with_tags_to_group_visits();
