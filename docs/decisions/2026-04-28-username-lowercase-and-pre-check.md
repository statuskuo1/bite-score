# Username: lowercase-only alphabet + client pre-check for "taken"

## Context

After landing the
[profile editor](2026-04-28-profile-identity-editor.md) and
[suggestion chips](2026-04-28-username-taken-suggestions.md), saving a username
that was already taken silently succeeded — no inline error, no chips. Two
issues were in play:

1. The case-insensitive unique index on `lower(username)` lives in
   [`supabase/migrations/20260428_profiles_username_unique.sql`](../../supabase/migrations/20260428_profiles_username_unique.sql),
   whose filename sorts **before**
   [`20260501_profiles_display_leaderboard.sql`](../../supabase/migrations/20260501_profiles_display_leaderboard.sql)
   (which actually creates `profiles.username`). On a fresh deploy the index
   migration aborts, so there's no DB-level uniqueness backstop and
   `updateOwnProfile`'s `23505` mapping never fires.
2. The username pattern `^[a-zA-Z0-9_.-]{2,30}$` allowed mixed case, which made
   the case-insensitive unique index more error-prone (users with
   `Test`/`test` could survive in legacy rows) and complicated the suggestion
   chip filter, which compares lowercase candidates against the raw column.

Product wanted a clear "Username already taken" error + 3 available
alternatives, and to restrict usernames to lowercase letters, digits, dot,
underscore, and hyphen.

## Decision

Defense in depth at three layers, with the **client pre-check** as the
primary "taken" detector so the UX works even where the DB index is missing.

### Client (primary)

- Tighten `USERNAME_PATTERN` to `/^[a-z0-9_.-]{2,30}$/` (lowercase only) in
  [`src/utils/profileApi.js`](../../src/utils/profileApi.js).
- Normalize input to lowercase before validation in `updateOwnProfile`. The
  AuthModal also lowercases on every keystroke
  ([`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx)) so
  the displayed value matches what gets saved.
- New pre-check in `updateOwnProfile`: one `select` with
  `.ilike("username", u).neq("id", userId).limit(1).maybeSingle()`. A hit
  returns `{ ok: false, code: "username_taken" }` immediately, bypassing the
  update entirely. The existing `23505` mapping is kept as a backstop for the
  pre-check↔update race window.
- `deriveUsernameBase` and `profilePayloadFromUser` lowercase their output so
  suggestion chips and OAuth/email-prefix seeds always conform to the new
  alphabet.

### Translations

- `profileUsernameHelp` → "2–30 chars, lowercase letters, numbers, dot,
  underscore, or hyphen".
- `profileUsernameInvalid` → "Use 2–30 lowercase letters, numbers, dot,
  underscore, or hyphen".

### DB (backstop)

New migration
[`supabase/migrations/20260504_profiles_username_lowercase.sql`](../../supabase/migrations/20260504_profiles_username_lowercase.sql)
runs after the column-creating migration so the index and constraint actually
land. Idempotent. Steps:

1. Resolve any case-insensitive collisions by suffixing newer rows with
   `-<6-char id slice>` (same dedupe pattern as the original
   `20260428` migration, keyed off `lower(username)`).
2. Lowercase every non-blank `username`.
3. Drop and re-create the partial unique index `profiles_username_lower_key`
   on `lower(username)` so installs that missed `20260428` get it.
4. Add a soft `check (username ~ '^[a-z0-9_.-]{2,30}$')` constraint
   (NULL/blank exempt to match the partial index).

The original `20260428` migration is left in place — idempotent and harmless
to leave; the new file supersedes it operationally.

## Alternatives considered

- **DB-only fix (re-date and re-run the existing migration).** Rejected as
  the sole fix — even with the index in place, the user would have to wait
  for a Postgres `23505` round-trip to see the error, and the pattern would
  still permit uppercase. The pre-check also makes the UX resilient to future
  deploys where the migration order regresses.
- **Per-keystroke availability ping with debounce.** Still rejected for the
  same reasons as in the
  [chip suggestion doc](2026-04-28-username-taken-suggestions.md): more DB
  surface, race-prone, and most useful *after* the user has settled on a base.
  The Save-time pre-check covers the moment users actually need feedback.
- **CITEXT or generated `lower(username)` column.** Overkill: a partial unique
  index on `lower(username)` plus the lowercase-on-write rule is already
  sufficient and avoids a column rewrite.
- **Auto-suggest replacements on input change (not just on Save failure).**
  Deferred — keeps the chip surface tied to a clear failure event so users
  aren't bombarded with chips while still typing.

## Consequences

- Existing mixed-case usernames are rewritten to lowercase by the migration.
  Step 1's dedupe will rename a small number of legacy collisions (suffix
  with the 6-char id slice). Anyone whose username changes will see the new
  one in the header pill on next refresh.
- The pre-check adds one `select` round-trip on every Save attempt. Cost is
  negligible (single row by indexed column) and only happens on Save, not on
  every keystroke.
- The CHECK constraint will reject any future writes that bypass the
  validator (e.g., direct SQL or buggy admin tools). Acceptable; matches
  intent.
- Suggestion chips are now guaranteed lowercase, so clicking one always
  yields a value that round-trips through the validator and pre-check
  cleanly.

## Files touched

- Modified: [`src/utils/profileApi.js`](../../src/utils/profileApi.js) —
  `USERNAME_PATTERN`, `validateUsername` semantics, pre-check in
  `updateOwnProfile`, `deriveUsernameBase` lowercase, `profilePayloadFromUser`
  lowercase
- Modified: [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx)
  — lowercase username draft on input change
- Modified: [`src/translations.js`](../../src/translations.js) —
  `profileUsernameHelp`, `profileUsernameInvalid` copy
- New: [`supabase/migrations/20260504_profiles_username_lowercase.sql`](../../supabase/migrations/20260504_profiles_username_lowercase.sql)
