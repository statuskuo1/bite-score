# Central 0–10 rating tiers + legend component

## Context

BITE / 10 and taste (0–10) used duplicated threshold logic in `scoring.js` and prose in FAQ. We wanted one place to change band edges and labels later, plus a reusable UI for the legend.

## Decision

- **`src/constants/ratingTiers0to10.js`** — exports `RATING_010_BANDS` (lo, hi, `translationKey`, color), `label010`, `color010`, `formatRating010Range`, `rating010FilterRows`, and `rating010LegendInline`.
- **`src/components/RatingTierLegend.jsx`** — reads `RATING_010_BANDS` + `useLang()`; props `inline` for compact vs stacked layout.
- **`scoring.js`** — `scoreLabel`, `tasteLabel`, `scoreColor`, `cafeScoreColor` delegate to `label010` / `color010` so all 0–10 labeling stays aligned.

## Alternatives considered

- **Prop-drill `tr` into the legend** instead of `useLang` — fewer hooks, but every caller would pass `t`; context matches the rest of the app.

## Consequences

- Change cutoffs in **one array** (`RATING_010_BANDS`); FAQ and filters follow via component / helpers.
- **Primary files**: `ratingTiers0to10.js`, `RatingTierLegend.jsx`, `scoring.js`, `App.jsx`, `CafeGroupRow.jsx`, `FaqView.jsx`.
