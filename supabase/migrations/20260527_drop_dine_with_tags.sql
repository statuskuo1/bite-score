-- Phase 5: drop the legacy `dine_with_tags` table + the RPCs that read
-- from it. Companion to 20260526_consolidate_to_group_visit_members which
-- backfilled all dine_with_tags rows into group_visit_members and pointed
-- every read site at the new `_v2` RPCs.
--
-- Pre-deploy checklist (manual, by the operator):
--   1. 20260526 has been applied AND the backfill function has been run
--      (it's auto-invoked at the bottom of 20260526; re-run is idempotent).
--   2. App is on the Phase 4 build (no remaining dine_with_tags reads or
--      writes from the client). `git grep dine_with_tags src/` returns
--      only doc-comments by this point.
--   3. Optional sanity check from the SQL editor:
--        select count(*) from public.dine_with_tags;
--        select count(*) from public.group_visit_members;
--      group_visit_members should equal-or-exceed dine_with_tags (per
--      backfill semantics — one tag → tagger member + tagged member).
--
-- Once dropped, this is irreversible without restoring from a backup. No
-- application code reads `dine_with_tags` post-Phase-4, but if you've
-- deployed against a paused build that still does, this migration breaks
-- it. Stage carefully.

-- ── Drop legacy RPCs (signatures must match exactly) ────────────────────────
drop function if exists public.fetch_co_diners(uuid, uuid, uuid);
drop function if exists public.fetch_co_diners_for_entries(uuid[], uuid);

-- ── Drop the table itself ───────────────────────────────────────────────────
-- CASCADE so the unique index `dine_with_tags_unique_entry_pair` and any
-- RLS policies attached to the table go with it.
drop table if exists public.dine_with_tags cascade;
