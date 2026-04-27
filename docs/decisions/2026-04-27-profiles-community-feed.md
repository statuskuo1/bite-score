# Decision: Profiles UX + community visit feed

## Context

Users should see a friendly **display name** from `public.profiles` instead of raw email; visits should optionally show **who logged** each row; and a **community** view lists others’ visits with RLS allowing authenticated readers to load all visits for a leaderboard-style feed.

## Decision

- Extend **`profiles`** with `username`, `display_name`, `avatar_url`; replace **`handle_new_user`** to populate from `auth.users` `raw_user_meta_data` (Google `full_name` / `picture`) with email-local fallback.
- **Client** [`src/utils/profileApi.js`](../src/utils/profileApi.js): `ensureProfile` upserts missing fields after OAuth/magic link; **`AuthContext`** exposes `profile` + **`displayName`** for header/auth UI.
- **RLS**: authenticated users may **SELECT** any `profiles` row and any **`restaurant_visits` / `cafe_visits`** row; **INSERT/UPDATE/DELETE** on visits unchanged (own rows). **Own profile UPDATE/INSERT** for sync.
- **FK**: `visit.user_id` → **`profiles(id)`** so PostgREST can embed `author:profiles(...)`.
- **My Log** still uses `.eq('user_id', user.id)`; **Community** tab loads unfiltered visits + shows author via [`fetchCommunityRestaurantVisits` / `fetchCommunityCafeVisits`](../src/utils/visitPlacesApi.js).

## Alternatives considered

- **Keep visit FK → `auth.users` only** — rejected: no clean embed to `profiles` without a second query for every row.
- **Anonymous community read** — rejected for now; requires relaxed policies or a public RPC.

## Consequences

- Apply [`supabase/migrations/20260431_profiles_display_leaderboard.sql`](../../supabase/migrations/20260431_profiles_display_leaderboard.sql) **after** [`20260430_restaurant_cafe_places_visits.sql`](../../supabase/migrations/20260430_restaurant_cafe_places_visits.sql). Orphan users without `profiles` are backfilled before FK swap.

**Primary files:** migration above, [`src/utils/profileApi.js`](../src/utils/profileApi.js), [`src/contexts/AuthContext.jsx`](../src/contexts/AuthContext.jsx), [`src/utils/visitPlacesApi.js`](../src/utils/visitPlacesApi.js), [`src/App.jsx`](../src/App.jsx), [`src/components/RestRow.jsx`](../src/components/RestRow.jsx), [`src/components/CafeGroupRow.jsx`](../src/components/CafeGroupRow.jsx), [`src/components/AuthModal.jsx`](../src/components/AuthModal.jsx).
