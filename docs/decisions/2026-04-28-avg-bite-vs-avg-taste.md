# Average BITE vs average taste on My Taste

## Context

Users compare **Avg BITE** next to **Avg taste** on the Palette stats grid. **Avg taste** is an arithmetic mean of raw taste (0–10). **Avg BITE** is the mean of **normalized** per-visit scores (`calcBiteOutOf10`): each visit’s utility ratio vs `calcMaxBite(weights)`, ×10. That score intentionally weights taste **minus** bang/buck and wait, then expresses “how close to your personal ceiling,” so it often reads **much lower** than average taste — not a bug.

## Decision

- Keep the formula as-is; clarify in UI with **`x.xx/10`** on averages and an **info note** on the Avg BITE stat (`avgBitePaletteNote`).
- **`meanRestaurantBiteOutOf10`** in [`src/utils/scoring.js`](../../src/utils/scoring.js) averages only defined scores (skips null from missing portions, etc.) instead of treating null as 0.

## Consequences

- Palette and restaurant log footer use the helper + `/10` suffix; group row sort uses means over non-null BITE scores only.
