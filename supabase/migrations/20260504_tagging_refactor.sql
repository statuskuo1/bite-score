-- Tagging notifications refactor (2026-05-04)
--
-- Simplifies the tagging notification surface around the group_visit as the
-- canonical "listening" record:
--   – Two tag notifs only: `group_visit_tagged` with variants
--     (standard / auto_linked / pick_visit). `dine_tag` inserts are dropped
--     at the application layer (this migration keeps the enum value so
--     legacy rows still render).
--   – The per-member `group_visit_logged` (creator ping) is dropped at the
--     application layer; it's replaced by a single `group_visit_all_logged`
--     notif fanned out to every member when the parent group visit resolves.
--   – `dine_tag_back` inserts are dropped at the application layer. Tag-back
--     is now a UI acknowledgement that attaches the tagger to the user's
--     existing entry (no notification round-trip).
--
-- 30-day auto-attach: a companion RPC `auto_attach_visit_to_group_visits`
-- lets the save path backfill a logged visit onto any pending group_visit
-- member rows the saver belongs to at that place within ±30 days. This is
-- the listening-window mechanism that replaces the "tag them back" round-
-- trip for saves that happen days after the original tag.

-- ── 1. notifications type-check: add group_visit_all_logged ─────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
    check (type in (
      'follow',
      'taste_buds',
      'dine_tag',
      'dine_tag_back',
      'dine_tag_accepted',
      'dine_tag_mutual',
      'heart_reaction',
      'group_visit_tagged',
      'group_visit_logged',
      'group_visit_all_logged'
    ));

-- ── 2. Auto-resolve trigger: fan out party-logged notifs ────────────────────
--
-- Same shape as 20260522_group_visits.sql, but when the parent actually
-- transitions to 'resolved' (previous status was 'pending'), insert one
-- `group_visit_all_logged` notification per member, including the creator.
-- `from_user_id` is set to the member whose status flip caused the resolve
-- (NEW.user_id) so the bell UI has a non-null avatar to render. The
-- `not exists (... still pending)` predicate guards against double-fires
-- when several members flip in the same transaction.

create or replace function public.group_visit_members_after_status_change()
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
  if new.status <> old.status and new.status in ('logged', 'skipped') then
    update public.group_visits gv
       set status      = 'resolved',
           resolved_at = coalesce(gv.resolved_at, now())
     where gv.id = new.group_visit_id
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
       where gv.id = new.group_visit_id;
      select count(*) into v_member_count
        from public.group_visit_members
       where group_visit_id = new.group_visit_id;
      insert into public.notifications (user_id, from_user_id, type, meta)
      select m.user_id,
             new.user_id,
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
       where m.group_visit_id = new.group_visit_id
         and m.status = 'logged';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_group_visit_members_auto_resolve on public.group_visit_members;
create trigger trg_group_visit_members_auto_resolve
  after update of status on public.group_visit_members
  for each row
  execute function public.group_visit_members_after_status_change();

-- ── 3. Expiry RPC: fan out party-logged on the safety-net resolve path ──────
--
-- The day-7 sweep RPC also handles the "pending parent, no pending members"
-- backstop (members deleted directly via profiles cascade, etc.). When that
-- path resolves a parent, the trigger above doesn't fire (the resolution
-- came from a direct update on group_visits, not group_visit_members). So
-- we mirror the fan-out logic here.

create or replace function public.tick_group_visits_expiry()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_member_count integer;
  v_acting_user uuid;
begin
  update public.group_visit_members m
     set status = 'skipped'
   where m.status = 'pending'
     and exists (
       select 1
       from public.group_visits gv
       where gv.id = m.group_visit_id
         and gv.status = 'pending'
         and gv.visited_at < now() - interval '7 days'
     );

  update public.group_visits gv
     set status = 'expired'
   where gv.status = 'pending'
     and gv.visited_at < now() - interval '7 days';

  for v_row in
    update public.group_visits gv
       set status      = 'resolved',
           resolved_at = coalesce(gv.resolved_at, now())
     where gv.status = 'pending'
       and not exists (
         select 1
         from public.group_visit_members m
         where m.group_visit_id = gv.id
           and m.status = 'pending'
       )
    returning gv.id, gv.created_by, gv.kind, gv.restaurant_place_id,
              gv.cafe_place_id, gv.restaurant_name, gv.visited_at
  loop
    select count(*) into v_member_count
      from public.group_visit_members
     where group_visit_id = v_row.id;
    v_acting_user := v_row.created_by;
    insert into public.notifications (user_id, from_user_id, type, meta)
    select m.user_id,
           v_acting_user,
           'group_visit_all_logged',
           jsonb_build_object(
             'group_visit_id', v_row.id,
             'kind',           v_row.kind,
             'place_id',       coalesce(v_row.restaurant_place_id, v_row.cafe_place_id),
             'restaurant_name', coalesce(v_row.restaurant_name, ''),
             'visited_at',     v_row.visited_at,
             'member_count',   v_member_count
           )
      from public.group_visit_members m
     where m.group_visit_id = v_row.id
       and m.status = 'logged';
  end loop;
end;
$$;

revoke all on function public.tick_group_visits_expiry() from public;
grant execute on function public.tick_group_visits_expiry() to authenticated;

-- ── 4. auto_attach_visit_to_group_visits RPC ────────────────────────────────
--
-- Call site: save path, right after a fresh restaurant_visits / cafe_visits
-- row is written. Finds all pending member rows for this user at this place
-- (per kind) where the parent `visited_at` is within ±30 days of the new
-- visit's `visited_at`, flips their status to 'logged', and attaches the
-- kind-appropriate visit_id column. The auto-resolve trigger above then
-- takes care of parent resolution + party fan-out.
--
-- Returns the set of group_visit_ids that got attached (caller uses this
-- to trigger UI refresh / optional confirm toast).

create or replace function public.auto_attach_visit_to_group_visits(
  p_user_id      uuid,
  p_kind         text,
  p_place_id     uuid,
  p_visited_at   timestamptz,
  p_visit_id     uuid
)
returns table (group_visit_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_place_id is null or p_visit_id is null then
    return;
  end if;
  if p_kind not in ('restaurant', 'cafe') then
    return;
  end if;

  if p_kind = 'restaurant' then
    return query
    update public.group_visit_members m
       set status              = 'logged',
           restaurant_visit_id = p_visit_id
      from public.group_visits gv
     where m.group_visit_id = gv.id
       and m.user_id        = p_user_id
       and m.status         = 'pending'
       and gv.status        = 'pending'
       and gv.kind          = 'restaurant'
       and gv.restaurant_place_id = p_place_id
       and abs(extract(epoch from (gv.visited_at - p_visited_at))) <= 30 * 24 * 60 * 60
    returning m.group_visit_id;
  else
    return query
    update public.group_visit_members m
       set status        = 'logged',
           cafe_visit_id = p_visit_id
      from public.group_visits gv
     where m.group_visit_id = gv.id
       and m.user_id        = p_user_id
       and m.status         = 'pending'
       and gv.status        = 'pending'
       and gv.kind          = 'cafe'
       and gv.cafe_place_id = p_place_id
       and abs(extract(epoch from (gv.visited_at - p_visited_at))) <= 30 * 24 * 60 * 60
    returning m.group_visit_id;
  end if;
end;
$$;

revoke all on function public.auto_attach_visit_to_group_visits(uuid, text, uuid, timestamptz, uuid) from public;
grant execute on function public.auto_attach_visit_to_group_visits(uuid, text, uuid, timestamptz, uuid) to authenticated;

-- ── 5. find_expired_group_visit_candidates RPC ──────────────────────────────
--
-- Call site: save path, right after auto_attach runs. Finds expired parent
-- group_visits where the saver is still a 'skipped' member (cascade from
-- the day-7 sweep) at the same place within ±30 days of the new visit.
-- Returns one row per candidate so the client can prompt
-- "Was this with @X on {date}?". If the user confirms, the client calls
-- joinExistingGroupVisit(...) to attach + un-expire (via a separate update).
--
-- Expired parents are those whose visited_at was >7 days old when the
-- day-7 sweep ran. The retrospective window (±30 days) covers cases where
-- the user finally logged 8+ days after the dinner — the sweep already
-- converted everyone to skipped, but the new log proves they WERE there,
-- so we let the client offer to re-attach.

create or replace function public.find_expired_group_visit_candidates(
  p_user_id    uuid,
  p_kind       text,
  p_place_id   uuid,
  p_visited_at timestamptz
)
returns table (
  group_visit_id   uuid,
  created_by       uuid,
  restaurant_name  text,
  visited_at       timestamptz,
  kind             text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_place_id is null then
    return;
  end if;
  if p_kind not in ('restaurant', 'cafe') then
    return;
  end if;

  return query
  select gv.id, gv.created_by, gv.restaurant_name, gv.visited_at, gv.kind
    from public.group_visits gv
    join public.group_visit_members m on m.group_visit_id = gv.id
   where m.user_id = p_user_id
     and gv.status = 'expired'
     and gv.kind   = p_kind
     and case when p_kind = 'restaurant'
              then gv.restaurant_place_id = p_place_id
              else gv.cafe_place_id       = p_place_id
         end
     and abs(extract(epoch from (gv.visited_at - p_visited_at))) <= 30 * 24 * 60 * 60
   order by gv.visited_at desc;
end;
$$;

revoke all on function public.find_expired_group_visit_candidates(uuid, text, uuid, timestamptz) from public;
grant execute on function public.find_expired_group_visit_candidates(uuid, text, uuid, timestamptz) to authenticated;
