# Global leaderboard: mean-then-BITE with viewer weights

## Context

The Global tab displayed `avgTaste` for each place — a community-wide average
of just the `taste` slider, ignoring price, portions, wait, and repeatability.
That's not how anyone in this app actually thinks about a place: BITE is the
weighted blend they care about, and it depends on each user's own My Taste
sliders. Showing taste alone made Global feel like a different metric from
the rest of the app.

## Decision

Switch Global's score from `avgTaste` to **mean-then-BITE**:

1. For each place, average every BITE input across all visits — `avgTaste`,
   `avgCost`, `avgPortions`, `avgWait`, `avgRepeat` — plus a `useR` majority.
2. Apply the viewer's current weights once via `calcBiteOutOf10` (restaurants)
   or `calcCafeOutOf10` (drinks / sweets).

Rules for the two non-linear inputs:

- `useR`: majority — `useRTrue * 2 >= validCount` resolves to `true` (ties
  also resolve true, since the opt-out is intentional and rare).
- `repeatability`: `Math.round(avgRepeat)` clamped to `[0, 3]` so the
  non-linear `rMult` lookup lands on a real bucket.

A visit only contributes to the BITE averages if `portions > 0` and every
numeric input is finite (`validCount`); the displayed `visitCount` still
counts every visit so users see the same number we did before.

The leaderboard is now **personalized**: changing My Taste sliders re-ranks
Global at render time without a refetch.

## Alternatives considered

- **Option B — BITE-then-mean**: compute BITE per visit with viewer weights,
  then average. Mathematically cleanest (no integer/boolean averaging
  fudges), and `meanRestaurantBiteOutOf10` already does exactly this.
  Rejected because the user's mental model — "average all the inputs, then
  apply my weights once" — is the literal mean-then-BITE; the difference for
  realistic visit sets is small.
- **Keep `avgTaste`** with a secondary BITE chip. Rejected: two numbers per
  row clutters the row and forces users to pick which to read.
- **Filter out places with no `validCount`**. Rejected indirectly — the
  `bite != null` check in `GlobalTab` already drops these because `calcBite`
  returns `null` on bad inputs, so they never show up.

## Consequences

- `aggregatePlaces` ([src/utils/visitPlacesApi.js](../../src/utils/visitPlacesApi.js))
  now exposes `avgCost`, `avgPortions`, `avgWait`, `avgRepeat`,
  `useRMajority`, `validCount`. `avgTaste` is retained — `GroupsTab` still
  sorts its suggested-spots by it, and we didn't want to perturb that flow.
- `GlobalTab` ([src/components/community/GlobalTab.jsx](../../src/components/community/GlobalTab.jsx))
  takes `restaurantWeights` / `drinkWeights` / `sweetWeights` props; the
  `rows` memo recomputes BITE + sort whenever any of those change.
- `PlaceLeaderboardRow` now consumes the BITE-tier color/label
  (`scoreColor` / `scoreLabel`) and shows two-decimal precision, matching
  My Log's "Avg BITE" stat tile.
- `App.jsx` threads its `weights` / `drinkWeights` / `sweetWeights` state
  into `<CommunityTab>`, which forwards them to `GlobalTab`. The other
  sub-tabs ignore the props.
- `topReviewers` is still produced by the aggregator; no consumer reads it,
  but keeping it leaves room for a future "who rated this" detail surface
  with explicit consent UX.
