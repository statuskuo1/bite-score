# BITE displayed as 0–10

## Context

Users asked what BITE was “out of.” Raw `calcBite` magnitude depends on taste/bpb/wait weights, so there was no fixed ceiling. Welcome copy also referred to a 0–5 range that did not match the weighted formula.

## Decision

- Show **restaurant BITE** as **utility ratio × 10**, where ratio = `biteUtilityRatio(calcBite, calcMaxBite(weights))` — i.e. `clamp(BITE_raw ÷ BITE_max, 0, 1) × 10`. Implemented via `calcBiteUtilityRatio` + `utilityRatioToOutOf10` → `calcBiteOutOf10`. `calcMaxBite` is the same pipeline as a perfect visit: taste 10, zero buck/wait penalty, 3★ repeatability (`calcBite(10, 0, 1, 0, true, 3, wts)`).
- Show **café BITE** the same way with `calcCafeUtilityRatio` / `calcCafeOutOf10` against `calcCafeMax()` from `calcCafe(10, 0, 1, 0, true, 3)`.
- Tier labels/colors for any **0–10** display score are defined in **`src/constants/ratingTiers0to10.js`** (see also `RatingTierLegend.jsx`); `scoring.js` delegates to that module.
- Negative raw scores map through the ratio then clamp to **0** at the bottom (simple “out of ten” story).

## Alternatives considered

- **Show raw + dynamic “/ max”** — accurate but still awkward when comparing to others.
- **Redesign the blend** so the raw score is inherently 0–10 without normalization — larger change, same UX goal.

## Consequences

- Changing weights **rescales** all displayed restaurant scores (ordering for non-negative raw unchanged).
- FAQ and welcome strings describe 0–10; tier filter uses the same strings `scoreLabel` returns (`t.elite`, `t.great`, `t.goodTaste`, `t.average`, `t.meh`, `t.sucks`). **Label numeric ranges for that normalized number** use wider bands than raw taste; see `2026-04-26-normalized-bite-tier-bands.md`.
- **Primary files**: `src/utils/scoring.js`, `src/App.jsx`, restaurant/café components using scores, `src/components/FaqView.jsx`, `src/translations.js`, `.cursor/ARCHITECTURE.md`.
