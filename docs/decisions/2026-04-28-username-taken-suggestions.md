# Suggestion chips when a username is taken

## Context

The profile editor (introduced earlier today, see
[2026-04-28-profile-identity-editor.md](2026-04-28-profile-identity-editor.md))
shows an inline "Username already taken" error when Save returns Postgres
`23505`. Users had to dream up a new alternative themselves; common pattern in
sign-up forms is to offer a few one-tap alternatives.

## Decision

When Save returns `code === "username_taken"`, fire one DB round-trip to
filter a small set of client-generated variants and render up to 3 available
ones as clickable chips below the inline error. Clicking a chip fills the
input, clears the error, and refocuses the input. Suggestions are cleared on
input edit, modal open, and successful save.

Variant generation lives in
[`src/utils/profileApi.js`](../../src/utils/profileApi.js) as
`suggestAvailableUsernames(client, typed, max = 3)`:

- Derive a base by stripping disallowed chars and trailing separators,
  capped at 22 chars (room for suffixes within the 30-char ceiling).
- Generate a small mix: numeric (`base2`, `base3`, `base4`), separator
  (`base_42`, `base.7`, `base-7k2`, `base42`, `base_7k`).
- Drop variants that fail `USERNAME_PATTERN` or exceed 30 chars.
- One `select` against `profiles` with `.in()` to filter taken ones.

UI in [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx)
shows the chip row only when both `saveError === "username_taken"` and at
least one suggestion came back.

## Alternatives considered

- **Per-keystroke availability ping with debounce.** Rejected — extra DB
  surface, race-prone with the authoritative Save check, and most useful
  *after* the user has already settled on a base they liked. Showing chips
  on the failed Save is a more focused interaction.
- **Server RPC `suggest_username(base)`.** Rejected — adds a migration and a
  deploy step for negligible UX gain over a one-shot client batch query.
- **City-suffixed suggestions like `yiren_nyc`.** Deferred — would require
  pulling `lastCity` into AuthModal which lives in `App.jsx`. Easy to layer
  in if/when we lift user prefs to context.

## Consequences

- The `.in()` filter is case-sensitive while the unique index is on
  `lower(username)`. Possible false positives (we suggest `Foo123` when
  `foo123` already exists). Acceptable: the next Save is authoritative and
  will surface fresh suggestions if the user clicks an unlucky chip.
- Suggestions can be empty (very short base, or all 8 variants happen to be
  taken). In that case the chip row is simply not rendered — the user still
  sees the inline error and can edit manually.
- Adds one query only on a Save failure path. No additional reads in the
  happy path.

## Files touched

- Modified: [`src/utils/profileApi.js`](../../src/utils/profileApi.js) — `suggestAvailableUsernames` plus helpers
- Modified: [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx) — `suggestions` state, fetch on `username_taken`, chip row, refocus on click, clear on edit/open/save
- Modified: [`src/translations.js`](../../src/translations.js) — `profileUsernameSuggest` ("Try:")
