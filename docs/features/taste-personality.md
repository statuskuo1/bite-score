---
title: Taste personality
scope:
  - src/utils/tastePersonality.js
  - src/components/PaletteView.jsx
last_reviewed: 2026-04-28
---

## Purpose

The "you're a Hunter / Connoisseur / Patient Pilgrim / …" card on the My Taste Restaurants tab. Pure-function engine that turns the user's entry list + restaurant weights into one archetype + 1–3 supporting bullets. English-only.

## Pipeline

```
entries + weights
  → computeRestaurantSignals(entries, weights)   // pure, deterministic
  → first ARCHETYPE whose match(signals) is true
  → up to 3 supporting bullets (each gated by its own threshold)
  → roast vs. nice toggle picks roastTitle/roastBlurb or title/blurb
```

Single entry point: `getRestaurantPersonality(entries, weights)`.

## Signals (`computeRestaurantSignals`)

Derived in [`tastePersonality.js`](../../src/utils/tastePersonality.js):

| Signal | Definition |
|---|---|
| `total` | entry count |
| `avgTaste` / `avgCost` / `avgWait` | arithmetic means |
| `eliteHitRate` | share of entries with `taste >= 8` |
| `mustReturnRate` | share of entries with `repeatability === 3` |
| `recommendRate` | share of entries with `useR === true` |
| `longWaits` | count of entries with `wait >= 30` |
| `topRegion` / `topRegionShare` | most common region from `REGION_MAP` and its share |
| `secondRegion` / `secondRegionShare` | second-most-common |
| `regionCount` | number of distinct regions logged |
| `regionDiversity` | normalized Shannon entropy of region distribution |
| `cuisineCount` / `topCuisine` | distinct cuisines + most common |
| `topPick` | best BITE-then-mean restaurant: `{ name, score, visits }` |

## Thresholds

- **`MIN_ENTRIES_FOR_PERSONALITY = 1`** — below this, the card shows a "log more meals" placeholder. Was previously higher; lowered so single-entry users still get a card. See decisions.
- Each archetype has its own match predicate (e.g. `Hunter`: `topPick.score >= 8.5 && avgCost < 35`); first match wins. Most-specific → least-specific is the order in `ARCHETYPES`.

## Roast mode

Each archetype defines both a friendly `(title, blurb)` and a snarky `(roastTitle, roastBlurb)`. The component flips which one renders based on the roast toggle in `PaletteView`. See [2026-04-28 — Roastier roast copy](../decisions/2026-04-28-roastier-roast-copy.md).

## Why a separate module

Replaces the older `pr0..pr3` / `r0..r3` block that lived inline in `PaletteView.jsx` and read 4 dimensions through wide if/else buckets. Pulling the logic out gives:

- richer signal layer (entropy, hit rates, top pick) without crowding the view;
- pure functions that are easy to test;
- one archetype + 1–3 bullets per render instead of always-on copy.

## i18n note

English-only. Mandarin support requires either threading a `lang` arg through `getRestaurantPersonality` or mirroring this file with a parallel zh build. See [`features/i18n.md`](i18n.md).

## Decisions

- [2026-04-28 — Taste personality](../decisions/2026-04-28-taste-personality.md)
- [2026-04-28 — Taste personality threshold lowered](../decisions/2026-04-28-taste-personality-threshold-lowered.md)
- [2026-04-28 — Roastier roast copy](../decisions/2026-04-28-roastier-roast-copy.md)
- [2026-04-28 — Stash Mandarin localization](../decisions/2026-04-28-stash-mandarin-localization.md)
