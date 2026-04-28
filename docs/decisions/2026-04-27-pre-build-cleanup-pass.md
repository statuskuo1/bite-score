# Pre-build cleanup: dev-only logging, single profile sync owner, valid migration date

## Context

Audit before starting the next feature found three small but real discrepancies:

1. `src/utils/visitPlacesApi.js` had **6 unconditional `console.log` calls** that fire on every fetch (including in production), leaking `userId` and full row payloads.
2. `ensureProfile(supabase, user)` was called **twice** on every sign-in — once by `AuthContext.jsx` and again by `App.jsx`'s `load()`. Idempotent but redundant.
3. Migration filename `20260431_profiles_display_leaderboard.sql` used an **invalid calendar date** (April has 30 days). It still sorted correctly after `20260430`, but blocked any "May 1" migration from being added without confusion.

## Decision

1. Add a `devLog` helper in `visitPlacesApi.js` that no-ops outside `import.meta.env.DEV`; replace the six `console.log` call sites with it. `console.warn` / `console.error` paths kept as-is (we want errors visible everywhere).
2. Drop the redundant `await ensureProfile(supabase, user)` from `App.jsx`'s `load()` and the now-unused import. Profile sync stays owned by `AuthContext`'s `useEffect` keyed on `session?.user?.id`.
3. Rename the migration to **`20260501_profiles_display_leaderboard.sql`** and update the three docs that referenced it (`.cursor/ARCHITECTURE.md`, `docs/SUPABASE_AUTH_SETUP.md`, `docs/decisions/2026-04-27-profiles-community-feed.md`). Used `git mv` so history follows.

## Alternatives considered

- **Delete the logs entirely** — rejected; they're useful when debugging RLS / embed weirdness in dev.
- **Keep `ensureProfile` in `App.jsx` "for safety"** — rejected; two owners means two failure modes and double network traffic; `AuthContext` is the single source of truth for the current user.
- **Leave the bad date** — rejected; the next person adding a May migration would either accidentally lexically sort before `20260431` or have to invent another fake date.

## Consequences

- Production console is now quiet for normal visit fetches (errors still surface).
- Anyone wiring future profile-related work should put it in `AuthContext` (or a sibling hook), not in `App.jsx`'s data-load effect.
- Migration ordering convention is restored: real `YYYYMMDD` dates only. Next migration after `20260501` should be `20260502_*` or later.

**Primary files:** [`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js), [`src/App.jsx`](../../src/App.jsx), [`supabase/migrations/20260501_profiles_display_leaderboard.sql`](../../supabase/migrations/20260501_profiles_display_leaderboard.sql), [`.cursor/ARCHITECTURE.md`](../../.cursor/ARCHITECTURE.md), [`docs/SUPABASE_AUTH_SETUP.md`](../SUPABASE_AUTH_SETUP.md), [`docs/decisions/2026-04-27-profiles-community-feed.md`](./2026-04-27-profiles-community-feed.md).
