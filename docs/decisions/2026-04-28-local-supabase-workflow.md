# Local Supabase dev workflow

## Context

Developers wanted a fast loop without pushing to Git or relying on cloud Supabase for every change. Docker-based `supabase start` provides Postgres, Auth, and RLS locally.

## Decision

- Add **Supabase CLI** as a **devDependency**, **`supabase init`** output in-repo, and npm scripts: `db:start` / `db:stop` / `db:reset` / `db:status`.
- Point local Auth **`site_url`** and **redirect allow list** at **Vite** (`http://localhost:5173` and `http://127.0.0.1:5173`) in [`supabase/config.toml`](../supabase/config.toml).
- **Seed** only **`restaurant_places`** and **`cafe_places`** in [`supabase/seed.sql`](../supabase/seed.sql); visits remain user-created after real Auth sessions.
- **`npm run dev`**: **email + password** only (no magic link); Google button disabled. **Production builds**: unchanged **magic link + Google** (`import.meta.env.DEV` gates the split). Optional `VITE_HIDE_GOOGLE_AUTH` still greys Google on non-dev builds if set.

## Alternatives considered

- **Second cloud Supabase + preview deploys** — rejected for this iteration (more moving parts than desired).
- **Local Google OAuth** — high friction (extra redirect URIs / clients); magic link + Mailpit is enough for dev.

## Consequences

- New migration [`20260425_legacy_schema_bootstrap.sql`](../supabase/migrations/20260425_legacy_schema_bootstrap.sql) creates minimal **`restaurants`**, **`cafes`**, and **`settings`** so older migrations apply on a brand-new database (including `supabase db reset`). Existing cloud databases that already had those tables are unaffected when this file is applied (uses `if not exists`).
- Migration [`20260429_assign_existing_visits_to_bitescore1.sql`](../supabase/migrations/20260429_assign_existing_visits_to_bitescore1.sql) **no longer throws** if no `bitescore1` user exists (fresh local DB); cloud projects that need the one-time assign should ensure that user exists before relying on the migration, or run equivalent SQL in the Dashboard.
- **Primary files:** [`supabase/config.toml`](../supabase/config.toml), [`supabase/seed.sql`](../supabase/seed.sql), [`package.json`](../package.json), [`src/components/AuthModal.jsx`](../src/components/AuthModal.jsx), [`src/translations.js`](../src/translations.js), [`docs/LOCAL_SUPABASE.md`](../docs/LOCAL_SUPABASE.md), [`.env.example`](../.env.example), [`.gitignore`](../.gitignore).
- **2026-04-27 restore note:** A destructive branch checkout earlier in the day silently overwrote [`package.json`](../package.json), losing the `db:start` / `db:stop` / `db:reset` / `db:status` scripts and the `supabase` CLI devDependency mandated above. Restored via `npm install -D supabase@latest` (pinned `supabase ^2.95.5`); no other `supabase/` or `docs/` files needed restoring (audit confirmed they were already on disk after re-apply).
