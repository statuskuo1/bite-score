# Friends tab: always-visible compatibility + aggregated top picks

## Context

After moving Compare to restaurant-level set diffs (see
[2026-04-28-compare-restaurant-level.md](./2026-04-28-compare-restaurant-level.md)),
the Friends tab still hid each friend's compatibility behind a per-friend
expand-and-fetch. Users couldn't scan their friend list to pick the highest-
match person to compare with, and there was no surface that aggregated "what
do my friends like, in general?".

## Decision

- **Eager-load every accepted friend's restaurant visits in parallel** when
  the friends list resolves, cached by `otherUserId` in component state and
  short-circuited on subsequent renders.
- **Replace the collapsible `FriendCard`** with a flat clickable row that
  always shows: avatar (40px) · display name · "{ratings} {ratingsLabel} ·
  {city}" sub-line · tier-colored compatibility pill via the same
  `tasteColor(score / 10)` ramp as the Compare-tab badge. Click → jump to
  Compare with that friend.
- **Per-friend stats** are derived client-side from the eager visits:
  `ratings = visits.length`, `city = mode of visit.city`, `compatScore =
  pairCompatibility(myVisits, theirVisits).score`.
- **New "Friends' top picks" section** below the friends list, powered by a
  new `aggregateFriendsTopPicks(friendVisitsByUser)` helper in
  [`src/utils/compatibility.js`](../../src/utils/compatibility.js). The
  helper averages per-user means (a friend who visited a place 5x doesn't get
  5x weight over a friend who visited once), tiebreaks on `friendCount`, and
  caps display to 10. Hidden entirely when no friend visits have loaded.
- **Unfriend moves to the Compare header card.** Since the flat friend row
  is a single click target → Compare, the destructive action lives one
  drill-down deeper in the Compare detail view, gated on the active target
  still being an accepted friend (in case the user landed there from a
  search-result row).

## Alternatives considered

- **Lazy load on expand (status quo)** — rejected. Hiding compat behind a
  click means the user can't pick "who should I compare with?" by scanning;
  it also forced one round-trip per expand instead of one parallel batch.
- **Server-side RPC for compat / top picks** — rejected for now. Even with
  20 friends and ~50 visits each, the math is sub-millisecond client-side and
  visits are already RLS-readable. Revisit if N grows or if we want a
  weighted "trending" signal.
- **Show `@username` in the sub-line** — rejected. The mockup needs the
  ratings count + city to read at a glance; `@username` is still on the
  Compare detail view via `UserIdentity`.
- **Each friend's primary city = `profiles.city`** — `profiles` doesn't have
  a `city` column today, and adding one duplicates info already in their
  visits. Mode of `visit.city` is good enough and updates as they log in
  new cities.
- **Inline Unfriend button on the row** — rejected. Single-click → Compare
  is the high-volume action; making part of the row trigger a destructive
  action invites mis-clicks. The Compare-detail location keeps it reachable
  but deliberate.

## Consequences

- For a friend who has no `restaurant_visits` (or visits without `placeId`),
  the row shows "—" in the compat pill and an empty sub-line; that's fine
  and motivates them to start logging.
- N parallel requests on Friends tab open. With ~5–20 friends typical, this
  is well under PostgREST's connection budget; if friends counts grow into
  the hundreds, batch via a SECURITY DEFINER RPC.
- The aggregated top picks section is restaurant-only (cafés have no
  cuisine/place comparable to restaurants in this app yet), matching the
  scope of `pairCompatibility` and `restaurantOverlap`.
- Removed cache: there's no per-friend visit cache across tab switches; the
  Friends tab refetches each time it mounts (acceptable because of the
  parallel batch). If we add tab-state persistence later, lift `friendVisits`
  to a shared context.

**Primary files**:
[`src/utils/compatibility.js`](../../src/utils/compatibility.js)
(new `aggregateFriendsTopPicks`),
[`src/components/community/FriendsTab.jsx`](../../src/components/community/FriendsTab.jsx)
(eager visits load, flat `FriendListRow`, new `TopPickRow` section),
[`src/components/community/CompareTab.jsx`](../../src/components/community/CompareTab.jsx)
(Unfriend pill in header card),
[`src/translations.js`](../../src/translations.js)
(`myFriends`, `friendsTopPicks`, `ratingsLabel`, `matchSuffix`,
`friendsCountSuffix`, `noTopPicksYet` in en + zh).
