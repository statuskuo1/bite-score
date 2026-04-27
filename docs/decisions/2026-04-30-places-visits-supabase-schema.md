# Decision: Normalize Supabase into places + visits

## Context

Restaurant and café logs were stored as flat `restaurants` and `cafes` tables (one row per visit with duplicated venue fields). We need shared venue records, clearer ownership on visits only, and an add flow that reuses venues by name.

## Decision

- Introduce **`restaurant_places`** / **`restaurant_visits`** and **`cafe_places`** / **`cafe_visits`** with UUID PKs (`uuid-ossp`).
- **RLS**: visits restricted to `user_id = auth.uid()`; places **readable/writable by any authenticated user** (shared catalog).
- **Client**: load visits with embedded `place`; map to the existing flattened UI shape in [`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js).
- **Insert restaurant**: `ensureRestaurantPlace` (name `ilike`, else insert place) → insert visit.
- **Insert café**: one `ensureCafePlace` per save batch → multiple `cafe_visits` rows sharing `place_id`.

## Alternatives considered

- **Keep flat tables / migrate in place** — rejected: duplicate venue data and weaker reuse.
- **Strict place ownership (`user_id` on places)** — rejected for now; shared catalog matches “search by name and attach visit” UX.

## Consequences

- Legacy `restaurants` / `cafes` tables are untouched; operators must run [`supabase/migrations/20260430_restaurant_cafe_places_visits.sql`](../../supabase/migrations/20260430_restaurant_cafe_places_visits.sql) and optionally backfill old data separately.
- Editing venue metadata on an existing shared place affects all visits pointing at that row; matching by name may attach a visit to an existing place created by another user.

**Primary files:** [`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js), [`src/App.jsx`](../../src/App.jsx), migration above.
