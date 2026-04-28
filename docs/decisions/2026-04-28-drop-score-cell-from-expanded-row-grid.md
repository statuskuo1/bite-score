# Drop "Score" cell from expanded row grid

## Context

Phase 1.4 of the row/cafe view consistency plan added a sixth `Score` cell to the
`EntryCard` expanded grid in both `RestRow` and `CafeGroupRow` so the two row
shapes lined up at 6 cells apiece (Taste / Cost / Portions / Wait / Repeat / Score).
In practice the score is already shown prominently as the "giant bite score" on
the right side of the collapsed row header, making the expanded `Score` cell
visually redundant — particularly because both numbers are the same (the bite
score for restaurants, the average bite for cafes), so the user reads the same
value twice on the same card.

## Decision

Drop the `Score` cell from the `expandedRows` arrays in both
[`src/components/RestRow.jsx`](../../src/components/RestRow.jsx) and
[`src/components/CafeGroupRow.jsx`](../../src/components/CafeGroupRow.jsx).
Both row types now show the same five cells in the expanded grid:
**Taste / Cost / Portions / Wait / Repeat**. Applies to all three My Log /
community tabs (restaurants, drinks, sweets).

## Alternatives considered

- **Keep Score, hide on small screens.** Adds responsive complexity for no
  information gain.
- **Show Score only on the row header, drop the right-side big-number display
  on expand.** Worse — the big number is the most-glanced piece of info on the
  card.
- **Show a per-component score breakdown in the expanded panel** (e.g. taste
  contribution, cost contribution). Out of scope and would compete with the
  per-visit modal's role.

## Consequences

- Visit history modal (`VisitsModal`) still shows per-visit scores next to
  each `Visit N` heading. That stays — those scores differ from the row's
  average and so are not redundant with the row header.
- Removed the now-unused `avgScore` computation from `RestRow.jsx` (cafes
  still need it for the row header in score-sort mode, so it stayed there).
- Phase 1.4 of
  [`/Users/ykuo/.cursor/plans/restaurant_cafe_view_consistency_bcb58247.plan.md`](../../../.cursor/plans/restaurant_cafe_view_consistency_bcb58247.plan.md)
  is superseded for the "add Score" half: both rows now align at five cells
  rather than six.
- Files touched: `src/components/RestRow.jsx`, `src/components/CafeGroupRow.jsx`.
