-- fetch_co_diners_for_entries: treat NULL p_exclude_id as "no exclusion".
--
-- The batched co-diners RPC (added in 20260514) was originally written
-- to always exclude the viewer from the returned co-diner list — the
-- feed never surfaced the viewer in their own "dined with" pill. We
-- now want the viewer to appear in that pill when someone tags them,
-- so the client passes p_exclude_id => NULL.
--
-- Postgres-gotcha: `column <> NULL` is unknown for every row, so the
-- prior body would silently return zero rows when called with NULL.
-- The OR guard below makes NULL mean "include everyone"; passing a
-- real uuid keeps the original exclusion behavior for any future
-- caller that wants it.
--
-- Backwards-compatible: same signature, additive NULL semantics. No
-- new grants needed (existing GRANT EXECUTE on the function carries
-- through CREATE OR REPLACE).

create or replace function public.fetch_co_diners_for_entries(
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
  select dt.entry_id, p.id, p.username, p.display_name, p.avatar_url
  from   dine_with_tags dt
  join   profiles p on p.id = dt.tagged_id
  where  dt.entry_id = any(p_entry_ids)
    and  (p_exclude_id is null or dt.tagged_id <> p_exclude_id);
$$;
