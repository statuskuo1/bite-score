# Global leaderboard rows: tap-to-expand with averaged inputs

## Context

Global tab rows previously showed only the BITE score, tier label, and visit
count — no way to see *why* a place ranks where it does. My Log already has
the right pattern: tap a row to expand a 3-column grid of the raw BITE inputs
(`EntryCard`'s `expandedRows`). Users asked for the same affordance on Global,
with values shown as community averages instead of personal ones.

## Decision

`PlaceLeaderboardRow` now toggles a collapsable detail panel on tap, mirroring
the My Log row layout (chevron in the same spot, identical 3-col grid styling
and padding offsets so the detail visually hangs off the title block).

The averaged inputs come straight from the `aggregatePlaces` payload that
`GlobalTab` already consumes for mean-then-BITE — no new fetches or RPCs:

- **Taste** — `avgTaste.toFixed(1)`
- **Cost** — `"$" + avgCost.toFixed(2)`
- **Portions** — `avgPortions.toFixed(1) + "x"`
- **Wait** — `avgWait.toFixed(0) + " min"`
- **Repeat** — stars from `Math.round(avgRepeat)` clamped to `[0,3]`, or
  `t.off` if `useRMajority === false`

Any cell with no valid contributing visits renders `—`. A small footer line
under the grid (`avg · {validCount}/{visitCount} visits`) makes the
provenance explicit so the numbers don't read as a single user's data.

## Alternatives considered

- **Reuse `EntryCard` directly.** Cleanest in terms of DRY, but `EntryCard`'s
  brown icon plate and lack of a "visits below score" slot would have meant
  either a visual regression on Global or growing `EntryCard`'s API for one
  caller. Inlining the same chevron + grid was lighter.
- **Show per-user breakdowns inside the panel** (à la `VisitsModal`).
  Rejected for the global feed — it would force username surfacing back into
  a view we deliberately keep community-anonymous (see
  `2026-04-28-community-shared-ui-and-leaderboard-anonymity.md`).
- **Median instead of mean.** Mean keeps parity with the BITE computation
  (`mean-then-BITE`) so the expanded inputs and the headline score tell a
  consistent story.

## Consequences

- Primary file: `src/components/community/PlaceLeaderboardRow.jsx`. No
  `GlobalTab` / aggregation changes needed — the avg fields were already on
  the row payload from
  `2026-04-28-global-leaderboard-mean-then-bite.md`.
- The `validCount` / `visitCount` split surfaces in the UI for the first
  time; future copy work could use `t.visitsCount` plurals if we localize
  Mandarin again.
