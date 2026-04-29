-- Add `followers_last_seen_at` to profiles for the unseen-followers badge.
--
-- Default to now() so existing users start at zero unseen — the badge only
-- lights up for follows that arrive AFTER this column exists / after the
-- user last opened the Friends sub-tab.

alter table public.profiles
  add column if not exists followers_last_seen_at timestamptz not null default now();
