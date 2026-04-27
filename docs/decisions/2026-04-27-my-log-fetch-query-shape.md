# Context

My Log showed no restaurant rows while `restaurant_visits` + `restaurant_places` data existed in Supabase. Fetches used a heavy embed (`place`, `profiles` FK hint) that could fail or behave inconsistently across environments; an early-return on “successful” empty `joined.data` also skipped fallbacks.

## Decision

- Load **only** `restaurant_visits` + nested `restaurant_places (...)` (no inline `profiles` embed). Attach author fields via existing `attachAuthorProfiles()`.
- Use the single-line embed string `*, restaurant_places(name, cuisine, cuisine2, is_fusion, city)` (and café analogue) — **never** order by `created_at`; visit tables only have **`visited_at`**.
- **Normalize** each row so `mapRestaurantVisitRow` always sees a `place` object (FK embed can be object or single-element array).
- **Order** by `visited_at` descending for My Log.
- **`dbLoaded`**: set `true` in `finally` unconditionally so a cancelled StrictMode run cannot leave the shell in a perpetual loading skeleton.

## Alternatives considered

- Keep `profiles` in PostgREST embed — rejected: unnecessary for listing and brittle if FK/cache names drift.
- Rely on fallback `select('*')` after failed embed — rejected in favor of one clear query path.

## Consequences

- **`visitPlacesApi.js`**: `RESTAURANT_VISIT_SELECT` / `CAFE_VISIT_SELECT` simplified; community fetch uses same pattern; in **dev**, a head `count` request logs how many visit rows the **anon + JWT** path can see (RLS on), to contrast with ad-hoc SQL in the editor (often RLS off).
- **`App.jsx`**: loading `finally` behavior updated.
