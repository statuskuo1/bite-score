-- Migration: friendships → follows + Taste Buds (mutual follows)
--
-- Model change:
--   OLD: `friendships` — one row per unordered pair, status pending/accepted
--   NEW: `follows` — one row per directed edge, no status. Mutual = Taste Buds.
--
-- Steps:
--   1. Create `follows` table with RLS
--   2. Migrate existing friendships data
--   3. Replace `are_friends()` with `are_taste_buds()` (+ keep `are_friends` as alias)
--   4. Update group_members RLS to use new helper
--   5. Drop old `friendships` table

-- ---------------------------------------------------------------------------
-- 1. follows table
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_no_self check (follower_id <> following_id)
);

-- One directed edge per pair — prevents duplicate follows.
create unique index if not exists follows_unique_edge_idx
  on public.follows (follower_id, following_id);

-- Fast lookups in both directions.
create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

-- SELECT: you can see follows you're part of (either side).
drop policy if exists "follows_select_involved" on public.follows;
create policy "follows_select_involved"
  on public.follows for select
  to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

-- INSERT: you can only create follows where you are the follower.
drop policy if exists "follows_insert_self" on public.follows;
create policy "follows_insert_self"
  on public.follows for insert
  to authenticated
  with check (follower_id = auth.uid() and following_id <> auth.uid());

-- DELETE: you can only remove follows you created (unfollow).
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Migrate existing friendships data
-- ---------------------------------------------------------------------------
-- Accepted friendships → two follow rows (mutual = Taste Buds).
insert into public.follows (follower_id, following_id, created_at)
select requester_id, addressee_id, created_at
from public.friendships
where status = 'accepted'
on conflict do nothing;

insert into public.follows (follower_id, following_id, created_at)
select addressee_id, requester_id, coalesce(responded_at, created_at)
from public.friendships
where status = 'accepted'
on conflict do nothing;

-- Pending requests → single follow (requester follows addressee).
insert into public.follows (follower_id, following_id, created_at)
select requester_id, addressee_id, created_at
from public.friendships
where status = 'pending'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Replace helper functions
-- ---------------------------------------------------------------------------
-- are_taste_buds: true when both directions exist in follows.
create or replace function public.are_taste_buds(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.follows
    where follower_id = p_a and following_id = p_b
  ) and exists (
    select 1 from public.follows
    where follower_id = p_b and following_id = p_a
  );
$$;

grant execute on function public.are_taste_buds(uuid, uuid) to authenticated;

-- Keep are_friends as an alias so any other consumers don't break.
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.are_taste_buds(p_a, p_b);
$$;

-- ---------------------------------------------------------------------------
-- 4. Update group_members RLS — no change needed!
--    The `group_members_insert_owner_invites_friend` policy calls
--    `are_friends(auth.uid(), user_id)` which now delegates to
--    `are_taste_buds`. Nothing to alter.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Drop old friendships table
-- ---------------------------------------------------------------------------
drop table if exists public.friendships cascade;
