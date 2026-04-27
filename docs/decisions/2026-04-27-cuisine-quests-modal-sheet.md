# Decision: Cuisine quests as full-screen modal sheet

## Context

Quest A–Z and cuisine checklist lived inline under My Taste → Restaurants, making the palette long and busy. Product asked for a **summary row** on the Cuisine breakdown card and a **full-screen bottom sheet** (centered card on desktop) with the same quest behavior.

## Decision

- **`getQuestMetrics`** in `src/utils/questMetrics.js` — shared `doneCount`, `totalCuisines`, `letterQuestSize`, `combinedProgress` for the summary row and modal pills.
- **`CuisineQuestModal.jsx`** — fixed `z-index` 200, backdrop fade; sheet uses `transform` + `transition` (no `display:none`); mobile full-height sheet from bottom (`translateY`); desktop `min-width: 768px` uses centered `max-width: 560px` with scale/opacity; drag handle + × close; stat pills; scroll body.
- **`QuestSheetBody`** (in `QuestsPaletteSection.jsx`) — modal-only content: simplified A–Z (green in-quest / dark otherwise, no orange, no legend), cuisine regions unchanged, full-width suggest CTA at bottom.
- **`PaletteView`** — inline quest block removed; summary row is the last block inside the Cuisine breakdown card.

## Alternatives considered

- **Accordion inline** — rejected in favor of modal to match native sheet UX and reduce scroll length on the main palette.

## Consequences

- **`src/components/PaletteView.jsx`**, **`src/components/CuisineQuestModal.jsx`**, **`src/components/QuestsPaletteSection.jsx`**, **`src/utils/questMetrics.js`**, **`src/translations.js`**.
