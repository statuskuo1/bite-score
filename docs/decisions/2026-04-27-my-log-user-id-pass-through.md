# Context

My Log queries filtered `restaurant_visits` / `cafe_visits` by a UUID from `resolveCanonicalUserId()` (`auth.getUser()` with fallback). That extra round trip could diverge from the `user.id` already provided by AuthContext and complicated debugging.

## Decision

- Remove **`resolveCanonicalUserId`** entirely.
- **`fetchRestaurantVisitsJoined`** / **`fetchCafeVisitsJoined`** use the **`userId` argument unchanged** for `.eq('user_id', userId)` — same string as **`user.id`** from Supabase Auth.
- Log **`[BITE] fetching with userId:`** at the start of each fetch; return **`[]`** immediately if `userId` is null or empty.

## Alternatives considered

- **`auth.getUser()` only** — rejected; redundant when the caller already has the JWT-derived id and caused confusion vs DB ownership.

## Consequences

- **`src/utils/visitPlacesApi.js`**: simpler fetch path; callers must pass a non-empty `user.id`.
