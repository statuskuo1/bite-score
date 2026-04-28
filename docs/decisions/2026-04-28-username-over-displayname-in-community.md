# Use `profiles.username` (not `display_name`) at user-identifying surfaces

## Context

The header button, the community feed's "Logged by ..." line, and the AuthModal
"Signed in as" line all rendered `profiles.display_name` (e.g., `"Yi Ren"`).
We want the community surface to feel handle-based — same identifier the user
sees for themselves in the header and for everyone else in the feed — so that
authorship is consistent and recognizable across screens.

## Decision

Switch the three identifying surfaces from `display_name` to the existing
`profiles.username` (e.g., `"yiren"`), rendered as **plain text** (no `@`
prefix). Auto-derived usernames (Google `preferred_username` / `user_name` /
email-local) are accepted as-is for now.

Concretely:

- [`src/contexts/AuthContext.jsx`](../../src/contexts/AuthContext.jsx) now
  exposes `username` alongside `displayName` on the memoized context value,
  same fallback chain (profile field → email-local → empty).
- [`src/App.jsx`](../../src/App.jsx) header button renders `username`.
- [`src/components/RestRow.jsx`](../../src/components/RestRow.jsx) and
  [`src/components/CafeGroupRow.jsx`](../../src/components/CafeGroupRow.jsx)
  community `authorLine` reads `authorUsername`, falling back to
  `authorDisplayName` defensively for any legacy row missing a username.
- [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx)
  "Signed in as" span renders `username`. The full email line directly below
  it stays as the source of truth for the actual identity.

`displayName` remains on `AuthContext` for future surfaces (welcome modal,
profile screen) that want the long human name.

## Alternatives considered

- **`@`-prefixed handle (`@yiren`).** Rejected — the user explicitly chose
  plain. Easy to revisit later by changing only the rendered template strings.
- **Add an editable Username field now (with uniqueness check).** Rejected —
  scope creep; auto-derived usernames are good enough to ship and the change
  stays a 4-file read-site swap.
- **Backfill `username` defensively in the migration.** Not needed —
  [`supabase/migrations/20260501_profiles_display_leaderboard.sql`](../../supabase/migrations/20260501_profiles_display_leaderboard.sql)
  lines 19-25 already populate `username` for every existing profile.

## Consequences

- "Logged by" lines now read e.g. `"Logged by yiren"` instead of
  `"Logged by Yi Ren"`. Users who shared an account with a recognizable real
  name will see a less personal label in the community feed.
- Two users with the same email-local part on different domains
  (`alice@a.com`, `alice@b.com`) will both render as `alice`. Accepted risk;
  uniqueness/editable handle is a tracked follow-up.
- No DB / RLS / migration changes; no API changes; pure client read-site swap.
- Primary files: `src/contexts/AuthContext.jsx`, `src/App.jsx`,
  `src/components/RestRow.jsx`, `src/components/CafeGroupRow.jsx`,
  `src/components/AuthModal.jsx`.
