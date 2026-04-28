# Decision: Per-section cafe weights (Drinks and Sweets) with restaurant-style 3-slider math

## Context

The "My Taste" view's **Drinks** and **Sweets** tabs previously rendered a 2-slider (`taste` / `bpb`) weight card that was decorative only - the cafe scoring function in [`src/utils/scoring.js`](../src/utils/scoring.js) ignored the slider state and used a hardcoded `0.7*t - 0.3*bpb - softWaitDrag` blend with a magic `/1.593` normalization. Restaurants meanwhile already had a working parameterized 3-slider system (`taste` / `bpb` / `wait`) that actually drove their BITE math.

User wanted Drinks and Sweets to gain a real (taste / bpb / wait) weight system on par with restaurants, but **independent** of restaurant weights, **and independent of each other** - because how much wait matters for a coffee is not the same as how much it matters for a slice of cake.

## Decision

- Add **two independent** weight states to [`src/App.jsx`](../src/App.jsx): `drinkWeights` and `sweetWeights`, each `{taste, bpb, wait}` summing to 100. Defaults `{taste: 70, bpb: 20, wait: 10}` for both - keeps the existing 70/30 cafe lean and slots `wait` into the gap.
- Drop the old shared `cafeWeights` state and its `rebalance` helper (which auto-normalized the other slider on each drag). Replace with the same edit-draft + sum-to-100 + Save flow restaurants already use ([`src/components/PaletteView.jsx`](../src/components/PaletteView.jsx) lines 102-135).
- Parameterize the cafe scoring helpers in [`src/utils/scoring.js`](../src/utils/scoring.js) to take a `wts` argument; export `CAFE_WEIGHT_DEFAULTS` for fallbacks.
- Cafe scoring now mirrors the restaurant formula shape exactly: `base = rt*t - rb*bpb - rw*wp`, then `applyR` if useR, then `raw / calcCafeMax(wts) * 10`. The `1.593` magic constant is gone - the ratio-to-max normalization adapts to whatever weights the user picks.
- **Two cafe-specific calibrations are intentionally kept different from restaurants:**
  - **bpb divisor** `/5.25` (restaurants: `/20`) - cafe items cost much less per portion, so the divisor scales the bang/buck term into a meaningful range. Without this, a $5 latte would always look amazing on bpb.
  - **wait curve** `log(wait+1) / log(31) * 10` (restaurants: `log(121)`) - cafe waits are much shorter and a 5-min coffee wait already feels long; a 30-min coffee wait is the worst-case. Saturates at 30 min instead of 120.
- Plumb `drinkWeights` into all drinks-context `calcCafeOutOf10` callsites (My Log Drinks tab sort + summary, Drinks Palette, community drinks) and `sweetWeights` into all sweets-context ones. `<CafeGroupRow>` gains a `weights` prop that App passes per-section.
- Form-preview callsites in [`src/components/CafeItemBlock.jsx`](../src/components/CafeItemBlock.jsx) and [`src/components/CafeForm.jsx`](../src/components/CafeForm.jsx) intentionally **don't** thread weights - they compute against `CAFE_WEIGHT_DEFAULTS` so the live preview while filling the form stays stable.

## Alternatives considered

- **Shared cafe weights for both Drinks and Sweets** (existing behavior). Simpler UI, one slider card. Rejected because users naturally weight wait differently for cafe vs sweets, and the existing "Same weights as drinks" annotation in the Sweets card had always read as a workaround rather than an intentional design.
- **Identical formula and constants to restaurants** (no `/5.25` divisor, no `log(31)` calibration). Rejected because cafe items are too cheap and cafe waits are too short for the restaurant calibrations to give the sliders meaningful range; the bpb and wait sliders would feel inert.
- **Linear wait curve at +1 wp per 5 min capped at 50 min**. Considered as the literal reading of "5-min increments" - rejected in favor of the log curve because the log shape better captures "the first few minutes hurt the most" intuition for cafe waits, and matches the formula shape used by restaurants.
- **Soft `|base| * 0.1 * (wp/10)` wait drag** (preserving today's cafe behavior). Rejected to make the cafe formula structurally identical to the restaurant formula. Side-effect: past entries with non-zero wait values will see their displayed BITE drop slightly. Acceptable - relative ordering is preserved.
- **Persist weights to a `user_settings` Supabase table**. Out of scope for this change. Restaurant weights don't persist today either, so matching that keeps the diff focused. Sensible follow-up.

## Consequences

- **Backward-compat note:** under default weights, existing cafe entries' displayed BITE will shift a little because (a) the `1.593` normalizer is gone in favor of `raw/max`, and (b) the wait term is now a real subtractive component instead of a soft drag. Relative ordering between entries is preserved. No data migration needed.
- The `rebalance` helper and `cafeWErr` error state in [`src/App.jsx`](../src/App.jsx) are removed; cafe sliders now use the same "draft until you click Save, must sum to 100" UX as restaurants.
- **Primary files touched:** [`src/utils/scoring.js`](../src/utils/scoring.js), [`src/App.jsx`](../src/App.jsx), [`src/components/CafeGroupRow.jsx`](../src/components/CafeGroupRow.jsx), [`src/components/PaletteView.jsx`](../src/components/PaletteView.jsx), [`src/components/DrinksPalette.jsx`](../src/components/DrinksPalette.jsx), [`src/components/SweetsPalette.jsx`](../src/components/SweetsPalette.jsx).
- No translations were added; reuses existing `t.weights / t.editWeights / t.weightsTotal / t.weightsSumTo100 / t.weightsSave / t.cancel / t.taste / t.bangBuck / t.wait`.
