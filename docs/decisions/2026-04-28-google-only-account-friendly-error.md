# Friendly error for Google-only accounts on password sign-in

## Context

After [`2026-04-28-username-or-email-sign-in.md`](./2026-04-28-username-or-email-sign-in.md), users can type either an email or a username plus a password. If the account they're trying to log into was created via Google OAuth and has no password, Supabase rejects with the same `"Invalid login credentials"` it returns for an actual wrong password — there is no way to tell the two cases apart from the auth response alone. The result was that Google users who forgot how they signed up would get the generic "Wrong email or password" message and assume the form was broken.

## Decision

- New migration [`supabase/migrations/20260506_auth_account_uses_oauth_only.sql`](../../supabase/migrations/20260506_auth_account_uses_oauth_only.sql) adds `public.account_uses_oauth_only(p_identifier text) returns boolean`, marked `security definer` so it can read `auth.identities`. The function takes either an email (detected by `@`) or a username, looks up the matching `auth.users` row, and returns `true` iff that row has zero rows in `auth.identities` with `provider = 'email'`. Returns `false` for non-existent accounts (so we don't enumerate) and for accounts that do have a password identity.
- New client helper [`accountUsesOauthOnly`](../../src/utils/profileApi.js) wraps the RPC. [`AuthModal.signInWithPassword`](../../src/components/AuthModal.jsx) calls it inside the `catch` block, but **only when** the Supabase error matches `/invalid login credentials/i`. On `true`, the modal shows the new `authUseGoogleInstead` string ("This account uses Google sign-in. Tap Continue with Google below.") instead of `formatPasswordSignInError`'s generic text.
- Detection happens **after** the failed sign-in attempt, not before. Trade-off: one extra RPC round trip on every wrong-credentials failure, vs zero extra latency on the happy path and zero new enumeration surface beyond what `signInWithPassword` already leaks.
- Phrased Google-specific because Google is the only OAuth provider the app currently supports. If we add Apple later, the migration's logic is already provider-agnostic (it checks for absence of the `email` provider) — only the i18n string needs extending.

## Alternatives considered

- **Preemptive check before `signInWithPassword`** — call the RPC on every sign-in attempt, refuse to even ask for a password if the account is Google-only. Rejected: adds a round trip to every successful sign-in (the common case) and creates a clearer enumeration vector ("type any username/email, learn instantly whether it's a Google account").
- **Extend [`email_for_username`](../../supabase/migrations/20260505_auth_email_for_username_rpc.sql) to also return provider info** — fold both lookups into one RPC. Rejected for now: the username path doesn't need provider info until *after* a failed sign-in, so doing the work earlier wastes a query on the happy path; and the email-input path doesn't call `email_for_username` at all today, so a unified resolver would still need a parallel email-input call. Two narrow RPCs are cleaner than one wide one.
- **Parse the Supabase error code more strictly** instead of regex on the message text — Supabase doesn't expose a stable code that distinguishes "wrong password" from "no password identity". Both paths produce the same `AuthApiError` with `status: 400`. Regex on the message is the only signal available client-side.

## Consequences

- **Mild enumeration on failure**: anyone who can submit a wrong password can also learn whether the target account is Google-only. The blast radius is "is this email/username registered with Google?" which is the same kind of leak existing OAuth-aware login surfaces have (e.g., Google itself shows "this account uses email/password" when you click Sign in with Google on a password-only account). Acceptable for the app's threat model.
- **One extra RPC per wrong-credentials failure** — happy path unaffected. Right answers stay free.
- **Provider-agnostic SQL**: returns `true` whenever there's no `email` identity, so a future Apple sign-in user would also trigger the Google message until we add a smarter UI string. Tracked as a small follow-up; for today the only OAuth in the app is Google.
- **Primary files**: [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx), [`src/utils/profileApi.js`](../../src/utils/profileApi.js), [`src/translations.js`](../../src/translations.js), [`supabase/migrations/20260506_auth_account_uses_oauth_only.sql`](../../supabase/migrations/20260506_auth_account_uses_oauth_only.sql), [`docs/SUPABASE_AUTH_SETUP.md`](../SUPABASE_AUTH_SETUP.md), [`docs/features/auth-rls.md`](../features/auth-rls.md), [`.cursor/ARCHITECTURE.md`](../../.cursor/ARCHITECTURE.md).
