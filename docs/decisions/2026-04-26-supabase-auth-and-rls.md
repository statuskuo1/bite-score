# Decision: Supabase Auth + RLS for BITE Score

## Context

The app already used the Supabase JS client with a public anon key and client-side “admin” gating via a hardcoded password, which is unsafe for production. We needed real login and server-enforced rules before multi-user data is trustworthy.

## Decision

- Use **Supabase Auth** (email magic link + Google OAuth) with `getSession` / `onAuthStateChange` in **`AuthContext`**.
- Add **`profiles`** (`id`, `is_admin`) populated by an **`auth.users` insert trigger**; curators set `is_admin` in the SQL editor.
- Add **`user_id`** on `restaurants` and `cafes`; **RLS**: public `SELECT`, authenticated **own-row** `INSERT`/`UPDATE`/`DELETE`, **legacy null `user_id` rows** mutable only by admins; **`settings`** writes restricted to admins.
- Remove the **nomnomNOM** client password; admin UX derives from **`profiles.is_admin`** (still aligned with RLS).

## Alternatives considered

- **Third-party auth only** (e.g. Auth0 without Supabase) — extra integration and no native `auth.uid()` for RLS.
- **Email/password only** — more support burden; magic link + Google matches the product plan.

## Consequences

- Run [`supabase/migrations/20260426_auth_rls.sql`](../supabase/migrations/20260426_auth_rls.sql) and follow [`docs/SUPABASE_AUTH_SETUP.md`](../docs/SUPABASE_AUTH_SETUP.md) (Site URL, redirect URLs, providers).
- Optional env: **`VITE_AUTH_REDIRECT_URL`** for OAuth/magic-link return when origin differs from `window.location.origin`.
- Primary files: `src/contexts/AuthContext.jsx`, `src/components/AuthModal.jsx`, `src/App.jsx`, `src/utils/rowAccess.js`, `SwipeRow` / `RestRow` / `CafeGroupRow`, migration + setup docs.
