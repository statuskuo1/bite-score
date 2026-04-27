# Welcome modal weights and slider UX

## Context

Welcome and palette restaurant weight sliders used proportional `rebalance` on every move, which felt unpredictable when users adjust taste then bpb in order. Native range thumbs were also small and hard to drag, especially in the narrow welcome card.

## Decision

- **Restaurant weights:** Exactly **two** of taste / bpb / wait are the active “pair” (`restaurantSliderPair`, default taste+bpb). Moving either updates the **third** to keep sum 100. Moving the **third** swaps it into the pair (partner = last-adjusted slider in the old pair) so any two can be set first; café two-slider weights still use **`rebalance`** in `updCafeW` only.
- **UI:** Reuse **`WeightSliders`** in the welcome modal. **`WeightSliders`** uses **`bite-weight-range`** for larger thumbs; restaurant weights use **`manualKeys`** plus a **vertical stack** (one row per factor); café keeps a 2-column grid.
- **Removed** unused **`WelcomeWeights.jsx`** (nothing imported it).

## Alternatives considered

- Keep proportional rebalance: rejected — conflicts with common top-to-bottom adjustment mental model.
- Third-party slider component: rejected — native range + CSS is enough surface area.
- Separate welcome-only component: rejected — one `WeightSliders` keeps palette and welcome in sync.

## Consequences

- `PaletteView` passes **`restaurantSliderPair`** into **`WeightSliders`** as **`manualKeys`**; drinks/sweets omit **`manualKeys`** (two sliders only).
- If new weight keys are added, revisit pair logic and layout.

**Primary files:** `src/App.jsx`, `src/components/WeightSliders.jsx`, `src/components/PaletteView.jsx`; removed `src/components/WelcomeWeights.jsx`.
