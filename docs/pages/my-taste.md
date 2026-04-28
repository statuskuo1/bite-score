---
title: My Taste
scope:
  - src/components/PaletteView.jsx
  - src/components/SuggestView.jsx
  - src/components/DrinksPalette.jsx
  - src/components/SweetsPalette.jsx
  - src/components/QuestsPaletteSection.jsx
  - src/components/CuisineQuestModal.jsx
  - src/components/DonutChart.jsx
  - src/components/RatingTierLegend.jsx
  - src/components/StatCard.jsx
  - src/components/WeightSliders.jsx
  - src/utils/tastePersonality.js
  - src/utils/questMetrics.js
last_reviewed: 2026-04-28
---

## Purpose

The 😋 page (`view === "palette"`). Personal "what kind of eater am I?" view: aggregate stats, taste personality, region/cuisine breakdowns, and the entry point into the Cuisine Quests modal. Each food category (Restaurants / Drinks / Sweets) has its own tab with its own weight sliders.

## User flows

- Switch among three tabs: Restaurants, Drinks, Sweets.
- See top-level stats for the active tab (entry count, top BITE pick, averages, taste personality).
- Edit the active tab's weight sliders (taste / bang-buck / wait, sum to 100). Save commits; cancel reverts.
- Toggle "roast mode" on the Restaurants tab to swap the personality bullets for snarkier copy.
- Open the Cuisine Quest sheet from the row beneath the Restaurants donut.
- Tap "Suggest where to go next" to jump into the Suggest view.

## UI structure

- Entry: [`PaletteView.jsx`](../../src/components/PaletteView.jsx) is the page shell. `paletteTab` selects which sub-view renders.
- Restaurants tab renders inside `PaletteView` itself (donuts, stats, personality, quests row).
- Drinks tab → [`DrinksPalette.jsx`](../../src/components/DrinksPalette.jsx).
- Sweets tab → [`SweetsPalette.jsx`](../../src/components/SweetsPalette.jsx).
- Region donut: [`DonutChart.jsx`](../../src/components/DonutChart.jsx) — top 5 regions + "Other".
- Tier legend (when shown): [`RatingTierLegend.jsx`](../../src/components/RatingTierLegend.jsx).
- Stat tiles: [`StatCard.jsx`](../../src/components/StatCard.jsx).
- Weight sliders: [`WeightSliders.jsx`](../../src/components/WeightSliders.jsx).
- Quest sheet body: [`QuestsPaletteSection.jsx`](../../src/components/QuestsPaletteSection.jsx) inside the modal sheet [`CuisineQuestModal.jsx`](../../src/components/CuisineQuestModal.jsx).
- Suggest view (`view === "suggest"`): [`SuggestView.jsx`](../../src/components/SuggestView.jsx).

## Data sources

- Reads `entries` (restaurants) and `cafes` (drinks + sweets) from `App` state — same arrays the My Log page renders.
- Reads weights from `App` state: `weights` (restaurant), `drinkWeights`, `sweetWeights`. Mutations route back through `replaceRestaurantWeights` / `replaceDrinkWeights` / `replaceSweetWeights` props.
- Quest letters: `questL` (a `Set<string>` of A–Z letters in the current quest). Bootstrapped from `localStorage` (`bite_questLetters_<userId>`) → `settings.questLetters` → defaults. See [`features/quests.md`](../features/quests.md).

## Key logic & current values

- **Restaurant weight defaults**: `{ taste: 50, bpb: 40, wait: 10 }` (must sum to 100).
- **Café weight defaults**: `{ taste: 70, bpb: 20, wait: 10 }` (`CAFE_WEIGHT_DEFAULTS` in [`scoring.js`](../../src/utils/scoring.js)).
- **Top BITE pick** uses the same group-by-name as My Log, then averages `calcBiteOutOf10` per visit, then sorts.
- **Region donut** maps each entry's `cuisine` through `REGION_MAP`, takes top 5 by count, lumps the rest into "Other".
- **Body visibility guard** (`showRestaurantBody`): hide stats when there are no entries OR committed weights don't sum to 100. Editing a draft slider does *not* hide the body — only the committed state does.
- **Taste personality** comes from `getRestaurantPersonality(entries, weights)` in [`tastePersonality.js`](../../src/utils/tastePersonality.js); see [`features/taste-personality.md`](../features/taste-personality.md). Min entries threshold: `MIN_ENTRIES_FOR_PERSONALITY = 1`.
- **Quest summary row** uses `getQuestMetrics(entries, questL)` from [`questMetrics.js`](../../src/utils/questMetrics.js); progress bar combines region coverage and letter quest size 50/50.

## Decisions

- [2026-04-28 — Taste personality threshold lowered](../decisions/2026-04-28-taste-personality-threshold-lowered.md)
- [2026-04-28 — Taste personality](../decisions/2026-04-28-taste-personality.md)
- [2026-04-28 — Avg BITE vs avg taste](../decisions/2026-04-28-avg-bite-vs-avg-taste.md)
- [2026-04-28 — Roastier roast copy](../decisions/2026-04-28-roastier-roast-copy.md)
- [2026-04-28 — Stash Mandarin localization](../decisions/2026-04-28-stash-mandarin-localization.md)
- [2026-04-27 — Cafe weights per section](../decisions/2026-04-27-cafe-weights-per-section.md)
- [2026-04-27 — Restaurant weight sliders](../decisions/2026-04-27-restaurant-weight-sliders.md)
- [2026-04-27 — Quests under palette / community nav](../decisions/2026-04-27-quests-under-palette-community-nav.md)
- [2026-04-27 — Cuisine Quests modal sheet](../decisions/2026-04-27-cuisine-quests-modal-sheet.md)
