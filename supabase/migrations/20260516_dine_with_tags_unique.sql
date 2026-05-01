-- Dine-with tags: deduplicate + add unique constraint
--
-- The schema in 20260510 didn't prevent two rows with the same
-- (entry_id, tagger_id, tagged_id). Several client paths could insert
-- the same triple twice — edit save (no delete pass), tag-back inserts
-- (no existence check), retroactive accept on cold cache. The result
-- was "dined with beta and beta" rendering in any feed code path that
-- doesn't dedupe client-side.
--
-- This migration:
--   1. Deletes duplicate rows, keeping the oldest per
--      (entry_id, tagger_id, tagged_id) group. Only operates on rows
--      where entry_id is not null — null-entry rows are pre-link drafts
--      (tagger created the tag before the tagged user logged the visit)
--      and are deduped separately by the retroactive-accept guard in
--      DineTagsBanner.
--   2. Adds a partial unique index covering the same triple, so future
--      inserts with the same triple either no-op (via .upsert with
--      ignoreDuplicates) or fail loudly.

-- ── 1. Cleanup ────────────────────────────────────────────────────────────────
delete from public.dine_with_tags
where  id in (
  select id from (
    select id, row_number() over (
      partition by entry_id, tagger_id, tagged_id
      order by created_at asc, id asc
    ) as rn
    from public.dine_with_tags
    where entry_id is not null
  ) ranked
  where rn > 1
);

-- ── 2. Unique constraint (partial — entry_id may be null pre-link) ────────────
create unique index if not exists dine_with_tags_unique_entry_pair
  on public.dine_with_tags (entry_id, tagger_id, tagged_id)
  where entry_id is not null;
