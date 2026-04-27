# Decision: Sign-in failures — email delivery vs client

## Context

Users reported sign-in not working. The app uses Supabase Auth (magic link + Google OAuth).

## Decision

- **Validated** the project’s Auth API:
  - `POST /auth/v1/otp` → **HTTP 500** `Error sending magic link email` (**outbound email / SMTP**, not client code).
  - `GET /auth/v1/authorize?provider=google` → **HTTP 400** `Unsupported provider: provider is not enabled` (**Google provider disabled** in Supabase).
- **Client UX**: `describeAuthError` in `AuthModal.jsx` appends hints for email-send failures and for disabled-provider messages (`authErrorEmailHint`, `authErrorProviderHint` in `translations.js`).
- **Dev DX**: log once if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing (`supabaseClient.js`).
- **Docs**: expanded `docs/SUPABASE_AUTH_SETUP.md` (Providers + symptom table).

## Alternatives considered

- **Replace magic link with password** — rejected for product/auth plan (magic link + Google already chosen).
- **Silent retry** — does not fix SMTP misconfiguration.

## Consequences

- **Project owners** must enable and configure **both** providers they need: **Email** (magic link + working mail delivery) and **Google** (OAuth client ID/secret + redirect URIs). See `docs/SUPABASE_AUTH_SETUP.md`.
- Primary files: `src/components/AuthModal.jsx`, `src/translations.js`, `src/config/supabaseClient.js`, `docs/SUPABASE_AUTH_SETUP.md`.
