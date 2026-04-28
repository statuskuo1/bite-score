# Profile identity editor (v1) inside AuthModal

## Context

Clicking the username pill (top right) opened the existing
[`AuthModal`](../../src/components/AuthModal.jsx), which only showed a static
"Signed in as ..." line and a Sign-out button. Users had no way to change
their auto-derived `username` (or `display_name`) and the avatar URL stored
in `profiles.avatar_url` was never rendered. A profile/settings surface was
the obvious next step.

## Decision

v1 covers **identity only**, lives inside `AuthModal` (no new route, no new
view), and ships behind the existing username-pill click:

- **Avatar** — render `profiles.avatar_url` (Google `picture` from sign-up);
  fall back to a circular orange tile with the first letter of the username.
  Read-only.
- **Username** — editable text input with client-side validation
  `^[a-zA-Z0-9_.-]{2,30}$`. Case-insensitive uniqueness enforced by a new
  partial unique index on `lower(username)`. Inline error on the field for
  invalid format or `Username already taken`.
- **Display name** — editable, max 120 chars, optional. Empty input writes
  `NULL` so the column can be cleared cleanly.
- **Email** — read-only line; `auth.users.email` is the source of truth and
  isn't editable from this surface.
- **Save changes** — single Save button driving one
  `supabase.from("profiles").update().eq("id", auth.uid())` call via a new
  helper [`updateOwnProfile`](../../src/utils/profileApi.js). On success,
  AuthContext's new `refreshProfile()` re-fetches the row so the header pill,
  community feed, and AuthModal all re-render with the new value.
- **Sign out** — kept where it was, below Save.

The unauthed sign-in form (email/password + Google + reset) is unchanged.

## Alternatives considered

- **New full-screen `st.view === "profile"` view** matching the bottom-nav
  pattern. Rejected: more files to touch, the Add nav slot would feel
  duplicative with a hidden profile route, and a modal feels right for a
  small identity panel.
- **In-modal multi-section settings (tabs/sections for Identity / Account /
  Preferences / Data).** Rejected for v1 — the user explicitly scoped to
  identity-only and the rest are tracked follow-ups.
- **Pre-check username availability with a `select` before update.**
  Rejected as the primary mechanism — the DB unique index is the source of
  truth and we already get a clean `23505` to map to a friendly error. A
  pre-check would also race; we can add it later as a UX polish if needed.
- **Force lowercase on save.** Rejected — preserves what the user typed; the
  `lower(username)` unique index handles collisions.

## Consequences

- New migration
  [`supabase/migrations/20260428_profiles_username_unique.sql`](../../supabase/migrations/20260428_profiles_username_unique.sql)
  must be applied. It deduplicates any existing case-insensitive collisions
  by suffixing the newer row with `-<6-char id slice>`, then creates the
  unique index. The dedupe step is idempotent and safe to re-run.
- The case-insensitive partial unique index allows multiple `NULL` /
  blank usernames (matches today's nullable column shape).
- `AuthContext` now exposes `refreshProfile()`. Existing consumers are
  unaffected (additive).
- Mandarin parity: per the
  [Mandarin stash decision doc](2026-04-28-stash-mandarin-localization.md),
  `T.zh` parity is allowed to drift while stashed. New keys
  (`profileTitle`, `profileUsernameLabel`, etc.) are EN-only and will be
  filled in during the unstash translation pass.
- Editing display_name to empty stores `NULL`. Header / community fall back
  to `username` then email-prefix, so empty display_name never produces a
  blank UI.

## Out of scope (deferred follow-ups)

- Avatar upload (would need a Supabase Storage bucket + image picker).
- In-app password change (today: rely on "Forgot password?" reset email).
- Persist scoring weights to a `user_settings` table.
- Delete account, data export (JSON/CSV), replay welcome / onboarding.
- Language toggle (waiting on Mandarin unstash).
- Privacy toggle for community visibility.

## Files touched

- New: [`supabase/migrations/20260428_profiles_username_unique.sql`](../../supabase/migrations/20260428_profiles_username_unique.sql)
- Modified: [`src/utils/profileApi.js`](../../src/utils/profileApi.js) — `USERNAME_PATTERN`, `validateUsername`, `updateOwnProfile`
- Modified: [`src/contexts/AuthContext.jsx`](../../src/contexts/AuthContext.jsx) — `refreshProfile()`
- Modified: [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx) — identity editor panel
- Modified: [`src/translations.js`](../../src/translations.js) — EN profile editor strings
