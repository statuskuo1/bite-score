-- Feed reactions (hearts only) + batched co-diners RPC
--
-- Two pieces of infrastructure for the chronological Taste Buds feed:
--   1. A `feed_reactions` table for "❤" reactions on visits. Hearts are
--      the only allowed reaction type today; the column exists so a future
--      migration can extend the check constraint without a schema change.
--   2. A SECURITY DEFINER RPC that returns co-diners for a batch of
--      visit ids. Per-post calls to `fetch_co_diners` would be N round
--      trips per feed page; this version takes the whole entry-id list
--      and returns one row per (entry, tagged user) pair.
--
-- RLS posture: any authenticated user can SELECT the table (you can see
-- who hearted any post you can see). INSERT/DELETE are restricted to
-- the reactor themselves. Same shape as `follows`.

-- ── 1. feed_reactions ────────────────────────────────────────────────────────

create table if not exists public.feed_reactions (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  post_id     uuid        not null,
  post_type   text        not null check (post_type in ('restaurant', 'cafe')),
  reaction    text        not null default 'heart' check (reaction in ('heart')),
  unique (user_id, post_id, post_type, reaction)
);

create index if not exists feed_reactions_post_idx
  on public.feed_reactions (post_type, post_id);

create index if not exists feed_reactions_user_idx
  on public.feed_reactions (user_id);

alter table public.feed_reactions enable row level security;

-- Anyone authenticated can read reaction rows. Visibility of the underlying
-- visits is governed by the `*_visits` policies; it's fine to expose the
-- reaction count separately because the post itself is always readable
-- whenever the viewer can see it in the feed.
create policy "feed_reactions select authenticated"
  on public.feed_reactions for select
  to authenticated
  using (true);

create policy "feed_reactions insert own"
  on public.feed_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "feed_reactions delete own"
  on public.feed_reactions for delete
  using (auth.uid() = user_id);

-- ── 2. fetch_co_diners_for_entries ───────────────────────────────────────────

-- Returns every (entry_id, tagged user) pair for a batch of visit ids,
-- excluding the viewer. SECURITY DEFINER bypasses the per-row RLS that
-- would otherwise hide tags where the viewer is neither tagger nor
-- tagged — so a feed viewer can see who dined with whom on someone
-- else's post.
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
    and  dt.tagged_id <> p_exclude_id;
$$;

grant execute on function public.fetch_co_diners_for_entries(uuid[], uuid)
  to authenticated;
