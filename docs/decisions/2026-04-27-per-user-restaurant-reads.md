# Decision: Private per-user reads for restaurants and cafés

## Context

All clients could `SELECT` every row from `restaurants` and `cafes`, and the app loaded `select("*")` without filtering. New accounts therefore saw another user’s visits. Product goal: each signed-in user has their own log starting empty until they add visits.

## Decision

- Keep a **single table** per entity with `user_id`; do not create per-user tables.
- **RLS**: Replace broad `SELECT` policies with **`restaurants_select_own_or_admin`** / **`cafes_select_own_or_admin`** — authenticated users see only rows where `user_id = auth.uid()`, except **admins** may read all rows (same pattern as legacy null-`user_id` mutations).
- **Client**: After `authReady`, load **`settings`** as before; load **restaurants/cafés** only with `.eq('user_id', user.id)`. If signed out, use bundled **seed** only (no bulk Supabase reads for visits). Initial state is **empty** until `authReady`, then hydrate (avoids flashing another user’s data for signed-in users).

## Alternatives considered

- **Separate DB tables per user**: Rejected — operational and migration overhead.
- **RLS only, client unfiltered**: Rejected — redundant payloads and weaker clarity in network tab.
- **Anonymous read of others’ rows for “social”**: Deferred until a deliberate social feed scope.

## Consequences

- Apply [`supabase/migrations/20260427_restaurants_cafes_select_own.sql`](../supabase/migrations/20260427_restaurants_cafes_select_own.sql) in Supabase alongside existing auth migration.
- Main UI shows **only the current user’s** visits even for admins (client filter); admins retain full **SQL/Dashboard** access via policy.
- **Quest letters** (`settings.questLetters`) remain global until a future per-user preferences model.

Primary files: `supabase/migrations/20260427_restaurants_cafes_select_own.sql`, `src/App.jsx`.
