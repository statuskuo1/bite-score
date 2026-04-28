---
title: Quests
scope:
  - src/components/QuestsPaletteSection.jsx
  - src/components/CuisineQuestModal.jsx
  - src/utils/questMetrics.js
  - src/constants/cuisineConstants.js
  - src/App.jsx
last_reviewed: 2026-04-28
---

## Purpose

Two parallel cuisine "quests": the **A–Z letter quest** (have I logged a cuisine starting with each letter?) and the **regional cuisine checklist** (have I tried every cuisine in each region?). Surfaced from the My Taste Restaurants tab.

## Surfaces

- **Summary row** under the Cuisine breakdown donut on My Taste Restaurants — one tappable strip with combined progress bar, "covered N letters · M of K cuisines done" copy.
- **Modal sheet** ([`CuisineQuestModal.jsx`](../../src/components/CuisineQuestModal.jsx)) opens on tap. Body lives in [`QuestsPaletteSection.jsx`](../../src/components/QuestsPaletteSection.jsx) → `QuestSheetBody`. Full-width "Suggest where to go next" CTA at the bottom routes to the Suggest view.

## Data model

- **`questL`**: a `Set<string>` of single-letter strings (A–Z) that the user has marked as "in my quest". Toggled by tapping a letter tile.
- **Storage priority**: `localStorage("bite_questLetters_<userId>")` → `settings.questLetters` (global default for first-time users) → empty.
- Persistence is per-user, client-side. There is no `quests` table today.

## Computed metrics ([`questMetrics.js`](../../src/utils/questMetrics.js))

```
covered          = Set of unique starting letters across the user's entries
loggedC          = Set of unique cuisine names across the user's entries
totalCuisines    = count of all cuisines listed in CUISINE_REGIONS
doneCount        = how many of those cuisines the user has logged
letterQuestSize  = questL.size
combinedProgress = (doneCount / totalCuisines + letterQuestSize / 26) / 2  // 50/50 split
```

## UI rules

- **Letter tile colors**: green when the letter is in `questL` (regardless of coverage); dark otherwise. There is no orange "logged" state — see decision below.
- **Click target**: only logged letters (`covered`) are clickable in the body view (cursor pointer); unlogged letters render flat.
- **Full cuisine list** is grouped by region from `CUISINE_REGIONS` and rendered with flag emojis (`FLAGS`).

## Where this is wired

- Open/close state lives in `PaletteView.jsx` (`questSheetOpen`).
- `toggleQ(letter)` is passed in from `App.jsx` and persists to `localStorage`.

## Decisions

- [2026-04-27 — Quests under palette / community nav](../decisions/2026-04-27-quests-under-palette-community-nav.md)
- [2026-04-27 — Cuisine Quests modal sheet](../decisions/2026-04-27-cuisine-quests-modal-sheet.md)
