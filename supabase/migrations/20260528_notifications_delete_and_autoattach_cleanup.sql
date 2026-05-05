-- Tie the bell-notification lifecycle to the group_visit_members lifecycle.
--
-- Two changes ship together because they share the same intent: when a
-- pending tagged-member row is resolved (logged via tag-back / auto-attach /
-- explicit "Tag to my entry", or skipped via banner Dismiss), the matching
-- `group_visit_tagged` notification should disappear from the bell — not
-- just sit there marked-read. Keeping them in sync addresses the UX
-- mismatch the user hit: tagging back from the notif left the /add banner
-- showing the same tag, and dismissing the banner left the bell badge
-- unchanged. Both surfaces now resolve together.

-- ── 1. DELETE policy on notifications ───────────────────────────────────────
--
-- 20260509_notifications.sql shipped SELECT/INSERT/UPDATE policies but no
-- DELETE policy, so RLS blocked all deletes. The new banner + notif-tap
-- cleanup paths need to delete the recipient's `group_visit_tagged` row.
--
-- Two clauses:
--   - `auth.uid() = user_id`     → recipient can clear their own notifs
--                                  (banner Dismiss / Tag-to-entry, notif
--                                   inline "Tag to my entry ✓")
--   - `auth.uid() = from_user_id`→ sender can clear notifs they sent
--                                  (Phase 4 syncGroupVisitMembersOnEdit
--                                   creator-side member removal already
--                                   tries this; without the policy it
--                                   silently no-ops under RLS)

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id or auth.uid() = from_user_id);

-- ── 2. auto_attach RPC: delete the matching pending notif inline ────────────
--
-- The auto-attach RPC (20260504_tagging_refactor.sql lines 199-249) flips
-- group_visit_members.status='pending' → 'logged' when a user logs a visit
-- at a place they were tagged into within ±30 days. SECURITY DEFINER, so
-- it bypasses RLS — perfect spot to also clean up the corresponding
-- `group_visit_tagged` notification so the bell badge decrements without
-- needing a follow-up client round-trip.
--
-- Same shape as before for both kinds (returns the attached
-- group_visit_ids); only addition is the DELETE step that runs after the
-- UPDATE returns. Idempotent — no rows match if the notif was already
-- cleared by the banner or notif handler.

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
declare
  v_attached uuid[];
begin
  if p_user_id is null or p_place_id is null or p_visit_id is null then
    return;
  end if;
  if p_kind not in ('restaurant', 'cafe') then
    return;
  end if;

  if p_kind = 'restaurant' then
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
    returning m.group_visit_id
    into v_attached;
  else
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
    returning m.group_visit_id
    into v_attached;
  end if;

  -- Cleanup: drop the matching pending tag notif from the bell. Filtering
  -- by `meta->>'group_visit_id'` so an unrelated notif at the same place
  -- doesn't get caught. No-op if no rows matched the UPDATE (v_attached is
  -- null / empty).
  if v_attached is not null and array_length(v_attached, 1) > 0 then
    delete from public.notifications
     where user_id = p_user_id
       and type    = 'group_visit_tagged'
       and (meta->>'group_visit_id')::uuid = any(v_attached);
  end if;

  return query select unnest(v_attached);
end;
$$;
