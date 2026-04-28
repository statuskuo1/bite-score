-- BITE Score: lowercase profiles.username, recreate case-insensitive unique
-- index, and add a soft format CHECK constraint.
--
-- Supersedes 20260428_profiles_username_unique.sql, whose filename sorts
-- before 20260501_profiles_display_leaderboard.sql (which created the
-- username column) and therefore fails on fresh deploys. This migration is
-- idempotent and safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Resolve any case-insensitive collisions BEFORE lowercasing, so the
--    rename keys off the same lower(username) bucket the unique index uses.
--    Strategy: keep the oldest profile per lower(username); rename newer ones
--    by appending '-<first 6 chars of id>'.
-- ---------------------------------------------------------------------------
with dups as (
  select
    id,
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
-- 2) Lowercase every non-blank username. After step 1 there are no
--    case-insensitive collisions, so this is collision-free.
-- ---------------------------------------------------------------------------
update public.profiles
set username = lower(username)
where username is not null
  and trim(username) <> ''
  and username <> lower(username);

-- ---------------------------------------------------------------------------
-- 3) Case-insensitive unique index. Partial (skips NULL / blank) so future
--    flows that clear the field don't trip the constraint. Drop-and-recreate
--    so installs that missed the earlier 20260428 migration get the index.
-- ---------------------------------------------------------------------------
drop index if exists public.profiles_username_lower_key;
create unique index profiles_username_lower_key
  on public.profiles ((lower(username)))
  where username is not null and trim(username) <> '';

-- ---------------------------------------------------------------------------
-- 4) Soft format CHECK: lowercase letters, digits, dot, underscore, hyphen,
--    2–30 chars. NULL / blank are exempt to keep the partial-index semantics.
--    Validated immediately because step 2 already normalized the data.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_username_format_check;
alter table public.profiles
  add constraint profiles_username_format_check
  check (
    username is null
    or trim(username) = ''
    or username ~ '^[a-z0-9_.-]{2,30}$'
  );
