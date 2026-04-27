> **Note:** Verbose `BITE_DEBUG_MY_LOG` / `isMyLogDebugEnabled` was removed in favor of a single, reliable query path and dev-only logs. See `2026-04-27-my-log-fetch-query-shape.md`.

# Context

My Log appeared empty despite rows existing in Supabase; we needed traceability for auth timing, query execution, RLS errors, and state updates.

## Decision

- Add optional verbose logging around `fetchRestaurantVisitsJoined` (diagnostic `restaurant_visits` + `restaurant_places` embed, `auth.getUser()`, joined select, fallback path) and around `App.jsx` load/dispatch.
- Logs run in **`import.meta.env.DEV`** or when **`localStorage.BITE_DEBUG_MY_LOG === '1'`**.

## Alternatives considered

- **Permanent `console.log` in production** — rejected (noise); opted for dev + opt-in flag.

## Consequences

- **`visitPlacesApi.js`**: exported `isMyLogDebugEnabled()` for reuse.
- **`App.jsx`**: logs user id/email and counts before/after fetch/dispatch.
