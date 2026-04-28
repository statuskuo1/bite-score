# Replace magic link with email + password

## Context

The app shipped two parallel auth UIs: **email + password** in local dev, **magic link + Google** in production (gated by `import.meta.env.DEV` in [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx)). Magic-link delivery has been the most fragile part of the stack — it depends on production SMTP being correctly configured in the Supabase dashboard and was the root cause flagged in [`2026-04-27-sign-in-email-and-errors.md`](./2026-04-27-sign-in-email-and-errors.md). Maintaining two flows also produced env-conditional UI, dev-only warning copy, and translation strings that only existed for one branch.

## Decision

- **One auth flow everywhere**: email + password sign-in and create-account, plus Google OAuth, plus **Forgot password?** via `supabase.auth.resetPasswordForEmail`.
- **Drop magic link** from the client entirely — no `signInWithOtp` call, no `sent` UI state, no `useLocalPasswordAuth` env split.
- **Google stays unchanged**, gated as before by `hideGoogleAuth = import.meta.env.DEV || VITE_HIDE_GOOGLE_AUTH === "true"` so local dev keeps Google off (OAuth still needs Google Cloud Console + Supabase redirect setup); production keeps it on.
- **Password recovery**: extend [`AuthContext`](../../src/contexts/AuthContext.jsx) to set a `recoveryActive` flag on the `PASSWORD_RECOVERY` event. New [`ResetPasswordModal`](../../src/components/ResetPasswordModal.jsx) mounted from [`App.jsx`](../../src/App.jsx) collects a new password and calls `supabase.auth.updateUser({ password })`. No new router; the modal opens whenever Supabase fires the recovery event after redirecting back to `/`.
- **No email-confirmation gate** on sign-up (matches `enable_confirmations = false` in [`supabase/config.toml`](../../supabase/config.toml)).
- **Identifier stays `email`** — no username login.

## Alternatives considered

- **Keep magic link as a secondary path** — rejected: the whole point is to remove a flow that depends on outbound email and produces opaque failure modes.
- **Username + password** (resolve username → email through `profiles`) — rejected by the user; email matches Supabase's native model and shares the row with Google sign-ins automatically.
- **Add email-confirmation gate** — rejected for now; would re-introduce dependency on production SMTP that was the original problem.

## Consequences

- **Existing magic-link-only users in production** have no password. They must use **Forgot password?** to receive a reset link and set one before they can sign in by password. Google users are unaffected — they continue to sign in with Google.
- **Supabase dashboard**: production should still have the **Email** provider enabled. The **Confirm email** dashboard toggle should mirror local config (off) unless email-confirmation is intentionally desired. The **Reset password** email template must work — same SMTP requirement that magic link used to have, but only on the recovery path now.
- The OTP/magic-link rate-limit knob in [`supabase/config.toml`](../../supabase/config.toml) (`token_verifications`, line 202) is now inert; left untouched.
- Supersedes the production half of [`2026-04-28-local-supabase-workflow.md`](./2026-04-28-local-supabase-workflow.md) (the local-dev half — Docker, seed, scripts — still applies) and the magic-link-specific guidance in [`2026-04-27-sign-in-email-and-errors.md`](./2026-04-27-sign-in-email-and-errors.md).
- **Primary files**: [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx), [`src/components/ResetPasswordModal.jsx`](../../src/components/ResetPasswordModal.jsx), [`src/contexts/AuthContext.jsx`](../../src/contexts/AuthContext.jsx), [`src/App.jsx`](../../src/App.jsx), [`src/translations.js`](../../src/translations.js), [`docs/SUPABASE_AUTH_SETUP.md`](../SUPABASE_AUTH_SETUP.md), [`docs/LOCAL_SUPABASE.md`](../LOCAL_SUPABASE.md), [`.cursor/ARCHITECTURE.md`](../../.cursor/ARCHITECTURE.md).
