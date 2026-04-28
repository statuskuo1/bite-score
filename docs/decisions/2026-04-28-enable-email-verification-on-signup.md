# Enable email verification on sign-up

## Context

Sign-up previously created an immediately-active session (`enable_confirmations = false`, see [`2026-04-27-replace-magic-link-with-password.md`](./2026-04-27-replace-magic-link-with-password.md)). That decision avoided SMTP fragility, but it leaves us without any guard against typo'd emails or basic spam, and a verified email materially improves the **Forgot password?** flow that already depends on SMTP working anyway. With password-reset deliverability already a hard requirement in production, the marginal cost of also requiring confirmation on sign-up is small.

## Decision

- Set `enable_confirmations = true` in [`supabase/config.toml`](../../supabase/config.toml) (email provider block) and turn **Confirm email** on in the production Supabase dashboard.
- After `supabase.auth.signUp(...)` resolves, [`AuthModal.jsx`](../../src/components/AuthModal.jsx) inspects `data.session`:
  - If a session is present (confirmations off / project misconfig), close the modal as before.
  - If null, show a **Check your email** panel with the target address, a **Resend email** button (30s local cooldown, calls `supabase.auth.resend({ type: "signup" })`), and a **Use a different email** action that returns to the sign-in form.
- The empty-`identities` response Supabase returns for already-registered emails (anti-enumeration) is treated identically to a fresh sign-up — both render the verification panel. The pre-existing `formatPasswordSignUpError` "already registered" branch still handles explicit error responses.
- New i18n strings (`authVerifySentTitle`, `authVerifySentBody`, `authVerifyResend`, `authVerifyResendCooldown`, `authVerifyResent`, `authVerifyChangeEmail`) added to en/zh in [`translations.js`](../../src/translations.js); the body uses a `{email}` placeholder filled via `String.replace` to avoid pulling a templating dep.
- **Forgot password is unchanged** — the existing reset flow ([`ResetPasswordModal.jsx`](../../src/components/ResetPasswordModal.jsx) + `PASSWORD_RECOVERY` handler in [`AuthContext.jsx`](../../src/contexts/AuthContext.jsx)) already covers password recovery and was never the gap.

## Alternatives considered

- **Stay opt-out (current)** — rejected; the original SMTP-fragility argument is weakened now that the reset flow already requires SMTP.
- **Soft "Account created — sign in" message without actually requiring confirmation** — rejected; gives the impression of verification without the protection (no anti-spam, no typo guard).
- **Confirmation gate via OTP token entered into the app instead of click-link redirect** — rejected; more friction, and the click-link flow already lands the user back at `/` signed in.

## Consequences

- **Existing users** are unaffected (`email_confirmed_at` was set when they signed up under the old setting). Only sign-ups *after* this change must confirm.
- **Production must have working SMTP** — unchanged hard requirement; a misconfigured project will silently fail to deliver verification emails. Configure a real provider in **Project Settings → Auth → SMTP Settings** before any meaningful launch (Supabase default SMTP is rate-limited).
- **Local dev**: confirmations land in the local **Inbucket** mailbox (already wired in [`supabase/config.toml`](../../supabase/config.toml)); no behavioral surprise during dev.
- **Supersedes** the "No email-confirmation gate on sign-up" point in [`2026-04-27-replace-magic-link-with-password.md`](./2026-04-27-replace-magic-link-with-password.md). All other points of that ADR (one auth flow, no magic link, password recovery wired) still hold.
- **Primary files**: [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx), [`src/translations.js`](../../src/translations.js), [`supabase/config.toml`](../../supabase/config.toml), [`docs/SUPABASE_AUTH_SETUP.md`](../SUPABASE_AUTH_SETUP.md), [`docs/features/auth-rls.md`](../features/auth-rls.md), [`.cursor/ARCHITECTURE.md`](../../.cursor/ARCHITECTURE.md).
