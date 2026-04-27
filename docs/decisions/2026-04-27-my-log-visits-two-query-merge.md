# Context

My Log listing depends on PostgREST reads from `restaurant_visits` / `cafe_visits` with embedded `*_places`, JWT-aligned `user_id` filters, and stable mapping to UI rows.

## Decision

- Query **`restaurant_visits`** and **`cafe_visits`** only (not legacy `restaurants` / `cafes`).
- **`select`**: `*, restaurant_places(name, cuisine, cuisine2, is_fusion, city)` and `*, cafe_places(name, city)`; **`order('visited_at')`** only (no `created_at`).
- **`.eq('user_id', canonicalUserId)`** where `canonicalUserId` comes from **`auth.getUser()`** when possible; warn if the caller passes null/empty `userId`; bail out if no resolved id.
- After each fetch, **`console.log`** full **`{ data, error }`**; on error **`console.error`** **`message`** and **`details`**.
- **`mapRestaurantVisitRow` / `mapCafeVisitRow`**: destructure nested embed, **`{ ...rest, ...(place embed) }`**, then read fields from the flattened object.
- **`await ensureProfile`** in **`App`** before loading visits (profile row aligns with visits → `profiles` FK).
- **`normalizeRestaurantVisitEmbed` / `normalizeCafeVisitEmbed`** kept exported for compatibility; community fetch maps raw embed rows through the same flattening mappers.

## Alternatives considered

- Two-query merge without embed — simpler PostgREST but diverges from desired join shape and duplicate round trips.

## Consequences

- **`src/utils/visitPlacesApi.js`**: My Log + community use embed strings above; **`src/App.jsx`**: post-insert mapping uses `map*Row` only (no `normalize*` wrap).
