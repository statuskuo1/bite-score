# Restaurant weight sliders: compact UI + relative mix

## Context

Restaurant taste/Bang-Buck/wait sliders in My Taste (Palette) and the welcome modal were tall (stacked label + slider rows). Totals that do not sum to 100 previously broke the intended “percentage” semantics of BITE. A **pair + derived third** implementation made the three sliders feel coupled; users expect **independent** controls.

## Decision

- **Sliders:** `updW` updates **one** dimension at a time (0–100 each); no pair refs or forced sum to 100 in UI.
- **Scoring:** [`restaurantWeightRatios`](../../src/utils/scoring.js) converts stored weights to **ratios that sum to 1** (same numeric mix as `/100` when the three sum to 100). [`calcBite`](../../src/utils/scoring.js) uses those ratios so BITE reflects **relative** importance.
- **Layout:** For **three sliders only**, `WeightSliders` uses a **single compact row** per factor (label | range | %), smaller `--compact` track/thumb CSS, and tighter vertical gap; café two-slider grid keeps the previous two-row cell layout and full-size range.
- **Copy:** Single guard string **`weightsSumTo100`** (“Needs to sum to 100” / “需總計為 100”) whenever **sum ≠ 100** (welcome + palette).
- **Welcome:** Continue disabled until **sum === 100**; show total line + `weightsSumTo100` when invalid.
- **Palette (restaurants tab):** **Edit weights** opens draft sliders; **Save** calls **`replaceRestaurantWeights`** only when draft sums to 100; **Cancel** exits edit. Taste personality / breakdown / stats render when **`total > 0`** and **committed weights sum to 100** (hidden if invalid until user fixes + saves); **not** hidden during edit so the rest of the page doesn’t vanish while adjusting sliders.

## Alternatives considered

- **Pair-based coupling** so the UI always totals 100: rejected — sliders did not feel independent.
- **Proportional `rebalance` on change:** rejected earlier for restaurants (unpredictable); café two-slider flow still uses `rebalance`.

## Consequences

- Stored `{ taste, bpb, wait }` may sum to anything > 0; meaning comes from **ratios** until user aligns to 100 for UX gates.
- Primary files: [`src/App.jsx`](../../src/App.jsx), [`src/components/PaletteView.jsx`](../../src/components/PaletteView.jsx), [`src/components/WeightSliders.jsx`](../../src/components/WeightSliders.jsx), [`src/utils/scoring.js`](../../src/utils/scoring.js), [`src/translations.js`](../../src/translations.js).
