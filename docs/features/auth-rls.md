---
title: Auth & RLS
scope:
  - src/contexts/AuthContext.jsx
  - src/components/AuthModal.jsx
  - src/components/ResetPasswordModal.jsx
  - src/config/supabaseClient.js
  - src/utils/profileApi.js
  - src/utils/rowAccess.js
  - supabase/migrations/**
last_reviewed: 2026-04-28
---

## Purpose

How a user signs in, what `auth.uid()` lets them read/write, and how the client knows when auth is "ready". RLS is the single source of truth for read/write permissions; the client mirrors it with a small `canMutateVisit` guard.

## Sign-in surface

- **Email or username** + password (primary), with **Google OAuth** as a secondary option.
- Component: [`AuthModal.jsx`](../../src/components/AuthModal.jsx). Triggered from the header on sign-out, or auto-opened when `authReady && !user`.
- OAuth callback redirects to the same origin (localhost / preview / prod handled by env-aware redirect URL — see decisions).

### Identifier resolution (email or username)

The sign-in field accepts either an email or a `profiles.username`. `resolveIdentifierToEmail` in [`AuthModal.jsx`](../../src/components/AuthModal.jsx) routes by `@` presence: with `@`, the input is treated as an email and passed straight to `supabase.auth.signInWithPassword`; without `@`, it calls `fetchEmailForUsername` ([`profileApi.js`](../../src/utils/profileApi.js)) which invokes the `email_for_username` RPC. The RPC ([`20260505_auth_email_for_username_rpc.sql`](../../supabase/migrations/20260505_auth_email_for_username_rpc.sql)) is `security definer` so it can read `auth.users.email` despite RLS, and returns `null` on miss. Misses surface as the standard `authInvalidLogin` ("Wrong email or password") so the UI does not distinguish "no such username" from "wrong password." Forgot-password uses the same indirection. **Sign-up still requires an email** — a client-side `@` guard rejects bare usernames before calling Supabase.

### Google-only account detection

Supabase returns the same `Invalid login credentials` error for both wrong-password and "user has no password (Google-only)" cases. To give Google users a friendlier message instead of the generic one, [`AuthModal.signInWithPassword`](../../src/components/AuthModal.jsx) calls `accountUsesOauthOnly` ([`profileApi.js`](../../src/utils/profileApi.js)) inside the `catch` block whenever the error message matches `/invalid login credentials/i`. The helper wraps the `account_uses_oauth_only(text)` RPC ([`20260506_auth_account_uses_oauth_only.sql`](../../supabase/migrations/20260506_auth_account_uses_oauth_only.sql)), which is `security definer`, accepts either an email or a username, and returns `true` only when the account exists AND has no `email` provider in `auth.identities`. On `true`, the modal swaps the generic message for `authUseGoogleInstead` ("This account uses Google sign-in. Tap Continue with Google below."). The check runs only on failure, so happy-path sign-ins remain a single round trip.

### Email verification on sign-up

`enable_confirmations = true` in [`supabase/config.toml`](../../supabase/config.toml). After `supabase.auth.signUp(...)` resolves with `data.session === null`, [`AuthModal.jsx`](../../src/components/AuthModal.jsx) keeps the modal open and renders a "Check your email" panel showing the target address, a **Resend email** button (30s local cooldown, calls `supabase.auth.resend({ type: "signup" })`), and a **Use a different email** action that returns to the form. Clicking the link in the email returns the user to the app origin signed in. Already-registered emails (Supabase returns 200 + null session for anti-enumeration) render the same panel by design.

### Password recovery

**Forgot password?** in [`AuthModal.jsx`](../../src/components/AuthModal.jsx) calls `supabase.auth.resetPasswordForEmail`, which uses the standard **Reset password** template. When the user clicks the link they return to `/` and Supabase fires `PASSWORD_RECOVERY`; [`AuthContext.jsx`](../../src/contexts/AuthContext.jsx) flips `recoveryActive`, and [`ResetPasswordModal.jsx`](../../src/components/ResetPasswordModal.jsx) collects the new password via `supabase.auth.updateUser({ password })`.

## AuthContext

[`AuthContext.jsx`](../../src/contexts/AuthContext.jsx) exposes:

- `session`, `user` — Supabase session.
- **`authReady`** — `true` after the initial `getSession()` resolves. The app shell renders empty data until then so RLS-filtered queries don't fire prematurely.
- `profile` — the user's row from `profiles`, refreshed via `fetchProfileById`.
- `displayName` / `username` — derived: profile field if present, else email local-part.
- `recoveryActive` / `clearRecovery` — for the password-reset overlay.
- `refreshProfile()` — re-fetch after a profile edit.

`ensureProfile` runs once per session start to backfill missing username / display name / avatar from OAuth `raw_user_meta_data`.

## RLS (current)

Migrations under [`supabase/migrations/`](../../supabase/migrations/), most recent wins:

- **`20260430_restaurant_cafe_places_visits.sql`** — current visit/place tables.
  - `*_visits`: own-row CRUD (`user_id = auth.uid()`).
  - `*_places`: authenticated read; authenticated insert (so any signed-in user can add a new venue).
- **`20260428_flat_user_rls_no_admin.sql`** — removed the legacy admin role; no role-based privileges in app code anymore. Anon client cannot write `settings`.
- **`20260428_profiles_username_unique.sql`** — unique index on lowercase username.
- **`20260501_profiles_display_leaderboard.sql`** — sign-up trigger to seed profile from auth metadata.
- **`20260502_cafe_tasting_notes.sql`** + **`20260503_cafe_order_normalized_and_popular_rpc.sql`** — café tasting fields and the popular-orders RPC.
- **`20260504_profiles_username_lowercase.sql`** — username canonicalization.

Earlier migrations (`20260426_auth_rls.sql`, `20260427_*`, `20260425_legacy_schema_bootstrap.sql`) bootstrap the legacy `restaurants` / `cafes` tables; the app no longer reads/writes those.

## Client-side guard

[`rowAccess.canMutateVisit(visit, user)`](../../src/utils/rowAccess.js) returns `true` only when the visit's `ownerId === user.id`. Every edit/delete in `App.jsx` checks this before issuing a mutation. RLS would also reject the call, but the client check skips the round trip and grays out the buttons.

## Settings

`settings` (key/value) holds runtime overrides:

- `questLetters` — bootstrap A–Z quest set if user has no `localStorage`.
- `faq_override_<index>` — FAQ answer overrides ([`pages/faq.md`](../pages/faq.md)).
- `welcome_{en|zh}_title` / `welcome_{en|zh}_body` — welcome modal copy. Only loaded when `VITE_WELCOME_USE_SUPABASE=true`.

The anon client **cannot write** `settings`; curators edit it via SQL / service role.

## Decisions

- [2026-04-29 — Google OAuth account picker](../decisions/2026-04-29-google-oauth-account-picker.md)
- [2026-04-29 — Assign legacy visits to owner](../decisions/2026-04-29-assign-legacy-visits-to-owner.md)
- [2026-04-28 — Friendly error for Google-only accounts](../decisions/2026-04-28-google-only-account-friendly-error.md)
- [2026-04-28 — Sign in with email or username](../decisions/2026-04-28-username-or-email-sign-in.md)
- [2026-04-28 — Enable email verification on sign-up](../decisions/2026-04-28-enable-email-verification-on-signup.md)
- [2026-04-28 — Username lowercase & pre-check](../decisions/2026-04-28-username-lowercase-and-pre-check.md)
- [2026-04-28 — Profile identity editor](../decisions/2026-04-28-profile-identity-editor.md)
- [2026-04-27 — Replace magic link with password](../decisions/2026-04-27-replace-magic-link-with-password.md)
- [2026-04-27 — Sign-in email and errors](../decisions/2026-04-27-sign-in-email-and-errors.md)
- [2026-04-27 — Auth required before log](../decisions/2026-04-27-auth-required-before-log.md)
- [2026-04-27 — Auth redirect localhost / preview](../decisions/2026-04-27-auth-redirect-localhost-preview.md)
- [2026-04-27 — No admin equal users](../decisions/2026-04-27-no-admin-equal-users.md)
- [2026-04-27 — Per-user restaurant reads](../decisions/2026-04-27-per-user-restaurant-reads.md)
- [2026-04-26 — Supabase auth and RLS](../decisions/2026-04-26-supabase-auth-and-rls.md)
