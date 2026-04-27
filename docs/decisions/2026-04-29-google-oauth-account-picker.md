# Decision: Google OAuth `prompt=select_account`

## Context

After sign-out, “Continue with Google” could resume the previous Google session without showing the account chooser, blocking easy switches to another Google account.

## Decision

Pass **`queryParams: { prompt: "select_account" }`** on `signInWithOAuth` for Google so each flow shows Google’s account picker. Supabase forwards these to the authorize URL.

## Alternatives considered

- Rely on sign-out alone: insufficient — Google’s cookie/session on `accounts.google.com` can still auto-select the last user.
- `prompt=consent`: heavier UX; not required for account switching.

## Consequences

- Primary file: [`src/components/AuthModal.jsx`](../../src/components/AuthModal.jsx).
