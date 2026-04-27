# Welcome modal weights and slider UX

## Context

Welcome and palette restaurant weight sliders used proportional `rebalance` on every move, which felt unpredictable when users adjust taste then bpb in order. Native range thumbs were also small and hard to drag, especially in the narrow welcome card.

## Decision

- **Restaurant weights:** Only **taste** and **bpb** are draggable, each capped so `taste + bpb ≤ 100`. **Wait** is always `100 − taste − bpb` and shown as a **read-only** bar (no `onUpdate` for `wait`). Logic lives in `App.jsx` (`adjustRestaurantWeights` + `updW`); café two-slider weights still use **`rebalance`** only in `updCafeW`.
- **UI:** Reuse **`WeightSliders`** in the welcome modal (remove duplicated markup). **`WeightSliders`** adds a **`bite-weight-range`** class with larger WebKit/Moz thumbs and a taller touch row; optional **`derivedKeys`** marks keys that render as a filled bar only.
- **Removed** unused **`WelcomeWeights.jsx`** (nothing imported it).

## Alternatives considered

- Keep proportional rebalance: rejected — conflicts with common top-to-bottom adjustment mental model.
- Third-party slider component: rejected — native range + CSS is enough surface area.
- Separate welcome-only component: rejected — one `WeightSliders` keeps palette and welcome in sync.

## Consequences

- `PaletteView` passes **`derivedKeys={["wait"]}`** for restaurant weights; drinks/sweets café sliders omit it.
- If new weight keys are added, revisit **`derivedKeys`** and caps.

**Primary files:** `src/App.jsx`, `src/components/WeightSliders.jsx`, `src/components/PaletteView.jsx`; removed `src/components/WelcomeWeights.jsx`.
