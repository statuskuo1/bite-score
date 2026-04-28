-- BITE Score: case-insensitive uniqueness on profiles.username.
-- Run AFTER 20260501_profiles_display_leaderboard.sql (which created the column).
-- Despite the date-sort, this file's number is meant to chronologically follow 20260503;
-- the index is idempotent and safe to apply at any time after the column exists.

-- ---------------------------------------------------------------------------
-- 1) Resolve any existing case-insensitive collisions.
--    Strategy: keep the oldest profile per lower(username); rename newer ones
--    by appending '-<first 6 chars of id>' so the unique index can be created.
-- ---------------------------------------------------------------------------
with dups as (
  select
    id,
    lower(username) as luname,
    row_number() over (
      partition by lower(username)
      order by created_at, id
    ) as rn
  from public.profiles
  where username is not null and trim(username) <> ''
)
update public.profiles p
set username = p.username || '-' || left(replace(p.id::text, '-', ''), 6)
from dups
where dups.id = p.id
  and dups.rn > 1;

-- ---------------------------------------------------------------------------
-- 2) Case-insensitive unique index. Partial (skips NULL / blank) so future
--    flows that clear the field don't trip the constraint.
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_username_lower_key
  on public.profiles ((lower(username)))
  where username is not null and trim(username) <> '';
