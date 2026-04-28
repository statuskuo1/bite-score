# Decision: Community social layer (Global / Friends / Compare / Groups)

## Context

The Community tab was a flat read-only feed of every visit. We need a social
layer so users can find friends, compare taste profiles, and plan group meals.
The product hypothesis is that **raw taste-by-cuisine** is the universal
shared variable for compatibility, while BITE bakes in personal weights
(cost / wait / repeatability) that distort agreement.

## Decision

- **Replace** the flat feed with four sub-tabs:
  **Global** (place-level leaderboard), **Friends** (search by username,
  request/accept, top picks per friend), **Compare** (one-on-one taste-by-cuisine
  agreement), **Groups** (owner-managed groups of friends with floor-score
  cuisine ranking and venue suggestions).
- **All compatibility math runs on raw `visit.taste`** — never on BITE.
- **Cuisine extractor is pluggable.** [`src/utils/compatibility.js`](../../src/utils/compatibility.js)
  takes a `getCuisine(visit)` function. Default extractor handles
  restaurant fusion (`cuisine` + optional `cuisine2`). When we add cuisine to
  cafés, we pass a different extractor with **no schema change**.
- **Restaurants only for v1.** Cafés have no cuisine field, so they're excluded
  from compatibility math but still appear in Global aggregations.
- **Compare = friends only.** Compare picker only shows accepted friends.
- **Groups = owner invites from friends only.**
  - Owner creates the group, only invites accepted friends.
  - Self-leave always allowed; only owner can remove others or delete.
  - Soft cap of 20 members enforced client-side.
- **Group cuisine ranking optimises the floor.** For every cuisine all members
  rated, score = `min(perMember avg)` — nobody gets dragged to a cuisine they
  don't enjoy. Relax to N-1 coverage for groups of 4+.
- **Group suggestions** filter `restaurant_places` to those <`ceil(n/2)`
  members have visited, then rank by community avg taste.
- **Global** = aggregated `*_places` rows with avg taste, visit count, top
  reviewers, and a "min visits" filter (default 1, options: 1/2/3/5).

## Schema

[`supabase/migrations/20260428_social_friends_groups.sql`](../../supabase/migrations/20260428_social_friends_groups.sql) adds:

- **`friendships`** (`requester_id`, `addressee_id`, `status`, `created_at`,
  `responded_at`). Unique pair index on `least(req,addr), greatest(req,addr)`
  prevents reciprocal duplicates. RLS: select either-party, insert
  requester=self, update addressee=self (accept), delete either party.
- **`groups`** (`owner_id`, `name`). RLS: owner / member can read; only owner
  inserts (with `owner_id = auth.uid()`) / updates / deletes.
- **`group_members`** (PK `group_id, user_id`). RLS uses three
  `SECURITY DEFINER` helpers (`is_group_member`, `is_group_owner`,
  `are_friends`) to avoid recursive RLS on `group_members` itself and to
  centralise the friend-pair check that gates invites.

## Alternatives considered

- **BITE-based matching** — rejected: BITE bakes in personal cost/wait
  weights, which mix circumstance with taste. Two price-sensitive friends
  with identical taste would mismatch on BITE.
- **Treat café category as pseudo-cuisine in v1** — rejected as premature.
  Restaurants alone validate the math; café cuisine can ship as a follow-up.
- **Denormalised compatibility table** — rejected. Visit reads are already
  RLS-permitted for authenticated users; pair compatibility for two users is
  O(visits) and runs fine client-side at v1 scale. Swap to a SECURITY DEFINER
  RPC if the corpus grows.
- **Search by phone / contact import** — rejected: usernames are already
  unique and lowercase, no friction to type.
- **Open Compare to any user (not just friends)** — rejected to prevent
  taste-profile stalking and to reinforce the friend graph as the primary
  social primitive.
- **Any-member group invites** — rejected. Owner-only invite keeps a clear
  authority and avoids viral expansion.

## Consequences

- Cafés are absent from compat math until they get a cuisine column. Users
  with mostly café data won't see meaningful Compare scores.
- Three new SECURITY DEFINER helpers must stay in sync with the policies that
  reference them (`is_group_member`, `is_group_owner`, `are_friends`).
- Username search hits `profiles` directly via `ilike "${q}%"`. Result count
  is capped at 8 to avoid noisy lists.
- Group detail loads each member's restaurant visits in parallel — fine for
  ~20 members, but a future RPC should compute floor scores server-side once
  groups grow.
- Friend list compatibility % is computed lazily on expand; we don't pre-fetch
  every friend's visits up front.

**Primary files:**
[`supabase/migrations/20260428_social_friends_groups.sql`](../../supabase/migrations/20260428_social_friends_groups.sql),
[`src/utils/compatibility.js`](../../src/utils/compatibility.js),
[`src/utils/friendsApi.js`](../../src/utils/friendsApi.js),
[`src/utils/groupsApi.js`](../../src/utils/groupsApi.js),
[`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js),
[`src/components/community/CommunityTab.jsx`](../../src/components/community/CommunityTab.jsx)
(+ `GlobalTab`, `FriendsTab`, `CompareTab`, `GroupsTab`, `PlaceLeaderboardRow`),
[`src/App.jsx`](../../src/App.jsx),
[`src/translations.js`](../../src/translations.js).
