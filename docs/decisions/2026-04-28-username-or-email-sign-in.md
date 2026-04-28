# Sign in with email or username

## Context

The earlier auth refactor in [`2026-04-27-replace-magic-link-with-password.md`](./2026-04-27-replace-magic-link-with-password.md) intentionally kept sign-in identifier as `email` only — it lined up with Supabase's native model and let Google OAuth users share an `auth.users` row automatically. Since then, [`profiles.username`](../../supabase/migrations/20260501_profiles_display_leaderboard.sql) has become a real, lowercase, case-insensitively unique field that users curate in the profile editor and that the community feed surfaces. Asking users who think of themselves as `bitescore1` to type their email instead is friction we don't need.

## Decision

- Accept either an email or a username in the sign-in field. Routing is by `@` presence: contains `@` -> treat as email; otherwise resolve via the new `email_for_username` RPC and feed the result into `supabase.auth.signInWithPassword({ email, password })`.
- New migration [`supabase/migrations/20260505_auth_email_for_username_rpc.sql`](../../supabase/migrations/20260505_auth_email_for_username_rpc.sql) adds `public.email_for_username(p_username text) returns text`, marked `security definer` so it can read `auth.users.email` despite RLS. Returns `null` on miss / out-of-range input. Granted to `anon, authenticated`; revoked from `public`.
- Client helper [`fetchEmailForUsername`](../../src/utils/profileApi.js) wraps the RPC. [`AuthModal.jsx`](../../src/components/AuthModal.jsx) gets a small `resolveIdentifierToEmail` indirection used by both `signInWithPassword` and `requestPasswordReset`. Sign-in / forgot-password show the existing generic `authInvalidLogin` text when resolution fails, so the modal does not distinguish "no such username" from "wrong password" in the visible UI.
- Sign-up still requires an email. A client-side guard in `signUpWithPassword` rejects no-`@` input with a new `authSignUpEmailRequired` string before calling Supabase. (Rationale: confirmation email needs an address; usernames are chosen post-signup in the profile editor.)
- Forgot-password also accepts username for consistency — typing your username and clicking the link is the same UX as sign-in.
- Field label changes from `authEmailLabel` to `authEmailOrUsernameLabel`; input switches from `type="email"` / `autoComplete="email"` to `type="text"` / `autoComplete="username"` so the browser doesn't reject a no-`@` username on submit.

## Alternatives considered

- **Denormalize `email` onto `public.profiles`** via the existing sign-up trigger — rejected. Adds a sync surface (email changes are rare but real), turns `profiles.email` into a SELECT-able column the anon client can scrape, and contradicts the "private email" design that sharing the `profiles` row already navigates around.
- **Edge function instead of an RPC** — rejected. RPC + `security definer` is the canonical Supabase pattern for "this query needs to bypass RLS"; an edge function adds deploy overhead and a separate auth path for no benefit here.
- **Stay email-only** — rejected for the user-curated-username reason above; it was the right call when usernames were placeholder.

## Consequences

- **Mild username-existence enumeration**: anyone can call the RPC repeatedly to learn whether a given username exists. Standard for any login-with-username surface (Twitter, Instagram, etc.) and acceptable for BITE Score's threat model. The RPC returns the email on hit, but the client never displays it; password failures still look identical to "no such user."
- **Supersedes** the username-rejected point in [`2026-04-27-replace-magic-link-with-password.md`](./2026-04-27-replace-magic-link-with-password.md). All other points (one auth flow, no magic link, password recovery wired, email confirmation on sign-up) still hold.
- **Google OAuth users**: their auto-generated username can be typed into the field, but they have no password — the password check fails with the existing generic message. No behavior change.
- **Migration order**: this migration runs after [`20260504_profiles_username_lowercase.sql`](../../supabase/migrations/20260504_profiles_username_lowercase.sql) and depends on `profiles.username` existing.
- **Primary files**: [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx), [`src/utils/profileApi.js`](../../src/utils/profileApi.js), [`src/translations.js`](../../src/translations.js), [`supabase/migrations/20260505_auth_email_for_username_rpc.sql`](../../supabase/migrations/20260505_auth_email_for_username_rpc.sql), [`docs/SUPABASE_AUTH_SETUP.md`](../SUPABASE_AUTH_SETUP.md), [`docs/features/auth-rls.md`](../features/auth-rls.md), [`.cursor/ARCHITECTURE.md`](../../.cursor/ARCHITECTURE.md).
