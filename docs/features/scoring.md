---
title: Scoring
scope:
  - src/utils/scoring.js
  - src/constants/ratingTiers0to10.js
  - src/components/WeightSliders.jsx
  - src/components/RatingTierLegend.jsx
last_reviewed: 2026-04-28
---

## Purpose

How a single visit becomes a BITE score (0–10), how labels and colors are assigned, and how weights work. This is the math layer used by My Log, My Taste, Add, and Community.

## Pipeline (one visit → display score)

```
inputs (taste, cost, portions, wait, useR, repeatability) + weights
  → calcBite (raw, weight-dependent magnitude)
  → biteUtilityRatio = raw / calcMaxBite(weights), clamped to [0, 1]
  → utilityRatioToOutOf10 = ratio * 10, rounded to 0.01, clamped to [0, 10]
```

The same shape applies to cafés via `calcCafe` / `calcCafeMax` / `calcCafeOutOf10`.

## Restaurant formula

From [`scoring.js`](../../src/utils/scoring.js):

```
bpb = (cost / portions) / 20
wp  = min(10, log(wait + 1) / log(121) * 10)     // saturates at ~120 min
{ rt, rb, rw } = restaurantWeightRatios(weights) // normalize sliders to fractions
base = rt * t - rb * bpb - rw * wp
final = useR ? applyR(base, repeatability) : base
```

`applyR(base, r)` adds `|base| * rMult(r)` where `rMult` is `{ 3: +0.4, 2: +0.2, 1: 0, else: -0.3 }` (any value other than 1/2/3 — including 0 — penalizes).

## Café formula

Same shape, two calibration changes:

```
bpb = (cost / portions) / 5.25                   // higher sensitivity at café prices
wp  = min(10, log(wait + 1) / log(31) * 10)      // saturates at ~30 min
```

## Weights

| Tab | Default `taste` / `bpb` / `wait` | Where stored |
|---|---|---|
| Restaurants | 50 / 40 / 10 | `weights` in `App.jsx` |
| Drinks | 70 / 20 / 10 (`CAFE_WEIGHT_DEFAULTS`) | `drinkWeights` |
| Sweets | 70 / 20 / 10 (`CAFE_WEIGHT_DEFAULTS`) | `sweetWeights` |

Sliders are independent integers 0–100. The user is gated to a sum of exactly 100 before saving. Internally `restaurantWeightRatios` divides by the live sum, so the math is robust even mid-edit.

## Tier bands

Two band sets in [`ratingTiers0to10.js`](../../src/constants/ratingTiers0to10.js):

- **`RATING_010_BANDS`** (absolute, e.g. raw taste 0–10): `[0,2)` sucks · `[2,4)` meh · `[4,7)` average · `[7,8.5)` good · `[8.5,9.5)` great · `[9.5,10]` elite.
- **`RATING_010_BANDS_NORMALIZED`** (display BITE): `[0,2)` sucks · `[2,3.5)` meh · `[3.5,5)` average · `[5,6.5)` good · `[6.5,8)` great · `[8,10]` elite. Cutoffs follow percent-of-max (ratio × 100).

`scoreColor` / `scoreLabel` use the normalized bands; `tasteColor` / `tasteLabel` use the absolute bands.

## "BITE-then-mean" vs "mean-then-BITE"

Two averaging strategies, used in different places:

- **BITE-then-mean** (My Log group rows, My Taste top pick): compute BITE per visit, then mean the BITE values. Each visit votes equally regardless of cost/wait dispersion.
- **Mean-then-BITE** (Community Global leaderboard): mean each raw input (taste, cost, portions, wait, repeatability) across all visits at a place, then apply BITE *once* with the viewer's own weights. Lets a slider tweak re-rank Global without a refetch. See [`pages/community.md`](../pages/community.md).

## Decisions

- [2026-04-28 — Avg BITE vs avg taste](../decisions/2026-04-28-avg-bite-vs-avg-taste.md)
- [2026-04-28 — Global leaderboard mean-then-BITE](../decisions/2026-04-28-global-leaderboard-mean-then-bite.md)
- [2026-04-27 — Cafe weights per section](../decisions/2026-04-27-cafe-weights-per-section.md)
- [2026-04-27 — Restaurant weight sliders](../decisions/2026-04-27-restaurant-weight-sliders.md)
- [2026-04-26 — BITE out of ten](../decisions/2026-04-26-bite-out-of-ten.md)
- [2026-04-26 — Normalized BITE tier bands](../decisions/2026-04-26-normalized-bite-tier-bands.md)
- [2026-04-26 — Rating tiers 0-10 module](../decisions/2026-04-26-rating-tiers-0-10-module.md)
- [2026-04-26 — Welcome weight sliders](../decisions/2026-04-26-welcome-weight-sliders.md)
- [2026-04-26 — Welcome modal sliders & copy](../decisions/2026-04-26-welcome-modal-sliders-and-copy.md)
