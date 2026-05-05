-- Fix the auto_attach_visit_to_group_visits RPC introduced in 20260528.
--
-- The previous version tried to capture the affected group_visit_ids via:
--
--   update ...
--   returning m.group_visit_id
--   into v_attached;          -- v_attached is uuid[]
--
-- That doesn't work in plpgsql: `INTO` on a multi-row UPDATE expects a
-- scalar/record target; assigning to a `uuid[]` requires aggregation.
-- The function failed at call time with a 400 from PostgREST, breaking
-- every save that hit `runPostSaveGroupVisitBackfill`.
--
-- The fix wraps the UPDATE in a CTE and uses `array_agg` to populate the
-- array. Same return shape (one group_visit_id per attached row), same
-- inline notif cleanup, just structurally valid plpgsql.

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
    with updated as (
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
    )
    select array_agg(updated.group_visit_id) into v_attached from updated;
  else
    with updated as (
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
    )
    select array_agg(updated.group_visit_id) into v_attached from updated;
  end if;

  -- Cleanup: drop the matching pending tag notif from the bell. Filtering
  -- by `meta->>'group_visit_id'` so an unrelated notif at the same place
  -- doesn't get caught. Guard on non-empty since array_agg over an empty
  -- set returns NULL.
  if v_attached is not null and array_length(v_attached, 1) > 0 then
    delete from public.notifications
     where user_id = p_user_id
       and type    = 'group_visit_tagged'
       and (meta->>'group_visit_id')::uuid = any(v_attached);
  end if;

  return query select unnest(coalesce(v_attached, array[]::uuid[]));
end;
$$;
