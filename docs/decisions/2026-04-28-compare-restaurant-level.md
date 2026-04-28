# Compare tab: restaurant-level, not cuisine-level

## Context

The Compare sub-tab told friends "you both like Korean food," which is true but
not actionable. Users opening Compare want to answer **"what should we eat?"**
or **"what do they know that I don't?"** — questions that live at the
restaurant, not the cuisine, level. Cuisine-level agreement was useful for the
overall compatibility number, but everything below the badge needed to switch
to per-place matching keyed on `place_id`.

## Decision

- **Header card** keeps the cuisine-level compatibility % from
  [`pairCompatibility`](../../src/utils/compatibility.js) (its `score` is
  already 0–100, no rescale). Below the badge, a one-liner summarizes shared
  *high-affinity* cuisines: top 2 cuisines from `agreements` where
  `min(mine, theirs) >= 7`, joined by `t.andSeparator`. Skipped silently when
  no shared cuisine clears the bar.
- **Three restaurant-level sections**, all driven by a new
  [`restaurantOverlap`](../../src/utils/compatibility.js) helper that does set
  diff on `placeId`:
  - **Both visited** — intersection. Per-row layout: flag · name · my score ·
    "vs" · their score. Sort by `(mine + theirs) / 2` desc.
  - **They tried, you haven't** — their-only. Discover badge + their score.
    Sorted by their score desc. Above the rows: a **city-filter chip row**
    derived from the cities that appear in `onlyTheirs` (sorted by row count
    desc). Chips only render when there are ≥ 2 cities.
  - **You tried, they haven't** — mine-only. Recommend badge + my score.
    Sorted by my score desc.
- **Per-place taste = mean of that user's visits to that `placeId`.** Latest
  visit would be more volatile when a user re-rates a place; the mean keeps
  the displayed score consistent with how the rest of the app aggregates.
- **Tier color via `tasteColor` for both row scores and the badge.** The spec
  asked for a "green badge"; high compatibility already lands on the green
  tier, and tier color avoids a misleadingly green pill at 30 %. The badge
  pill uses `${col}22` background + `${col}66` border so it reads as a colored
  chip rather than just colored text.

Removed: the `Where you agree` cuisine table, `You should try` and
`They might try` cuisine lists, and the `sharedCuisines` translation key.
`youAgreeOn` / `youShouldTry` / `theyShouldTry` are gone from
[`translations.js`](../../src/translations.js); `notEnoughSharedData` is kept
because [`FriendsTab.jsx`](../../src/components/community/FriendsTab.jsx) still
uses it on the friend-card collapsible.

## Alternatives considered

- **Latest-visit instead of mean per place** — rejected. A single bad re-visit
  shouldn't flip a place from agree to disagree; both users' "Both visited"
  rows should reflect a stable signal.
- **Always-green compatibility pill** — rejected. A 30 % match displayed on a
  green pill misrepresents the data; the existing `tasteColor` ramp is the
  same one Friends/Global use, so users already read it correctly.
- **City filter on every section** — rejected. "Both visited" is small enough
  that filtering it adds clutter; "You tried, they haven't" is a recommend-list
  for *them*, where the friend's location filter doesn't apply. Only the
  Discover section benefits from "I'm visiting their city, what's there?".
- **Show a row's full taste tier label** (e.g. "Excellent") — rejected; the
  numeric score plus tier color is enough density for a side-by-side view, and
  labels would force a wider score column.
- **Embed a Compare RPC server-side** — rejected. The full visit lists for
  both users are already RLS-readable, the math is O(visits), and the diff
  fits comfortably in the client. Revisit if either user routinely has
  thousands of visits.

## Consequences

- Compare now needs both users to have logged at least one visit each with a
  `placeId`. Visits without `placeId` (legacy / orphan rows) are dropped by
  `visitsByPlace`. Mid-2026 cloud data should already have `placeId` because
  visit inserts go through `ensureRestaurantPlace`.
- Restaurants with multiple cuisines (`is_fusion`) still show the primary
  cuisine flag on the row; `cuisine2` does not surface here.
- City-filter chips render only when there are ≥ 2 distinct cities in the
  "They tried" set, so a single-city user sees a clean section.
- The compatibility badge stays cuisine-level; its inputs and minimum-shared
  threshold are unchanged in `pairCompatibility`. So a friend with no rating
  overlap shows "—" in the badge but can still appear in the three
  restaurant-level sections.

**Primary files**:
[`src/utils/compatibility.js`](../../src/utils/compatibility.js) (new
`visitsByPlace`, `restaurantOverlap`),
[`src/components/community/CompareTab.jsx`](../../src/components/community/CompareTab.jsx)
(full rewrite),
[`src/translations.js`](../../src/translations.js) (en + zh keys; revised
`communityHintCompare`).
