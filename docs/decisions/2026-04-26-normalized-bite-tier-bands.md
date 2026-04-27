# Separate tier bands for normalized BITE

## Context

On-screen BITE is `(utility ratio) × 10`, where **utility ratio** = raw BITE ÷ theoretical max for current weights (`BITE_raw / BITE_max`, clamped to 0–1). That equals “percent of your theoretical ceiling” divided by 10 when shown as a 0–10 number.

## Decision

- Keep **`RATING_010_BANDS`** for absolute 0–10 taste (`tasteLabel` / `tasteColor`).
- **`RATING_010_BANDS_NORMALIZED`** tiers are defined from **percent-of-max bands** mapped to the 0–10 display score (ratio × 10):

| Tier    | Approx. % of max | Display range (0–10) |
|---------|------------------|----------------------|
| sucks   | 0–20%            | [0, 2)               |
| meh     | 20–35%           | [2, 3.5)             |
| average | 35–50%           | [3.5, 5)             |
| good    | 50–65%           | [5, 6.5)             |
| great   | 65–80%           | [6.5, 8)             |
| elite   | 80–100%          | [8, 10]              |

- **`scoreLabel` / `scoreColor` / café helpers** use normalized bands; FAQ uses `RatingTierLegend normalized`.
- **`src/utils/scoring.js`** exposes **`biteUtilityRatio`**, **`utilityRatioToOutOf10`**, **`calcBiteUtilityRatio`**, **`calcCafeUtilityRatio`** so normalization is explicit in code (not only inline division).

Earlier calibration (e.g. Great from 6.5, Elite from 8.75) is superseded by this explicit percent ladder.

## Alternatives considered

- **Earlier ad hoc cutoffs** — worked but did not tie labels to “% of theoretical max”; harder to explain.
- **Change the normalization formula** — unchanged; tiers only.

## Consequences

- Tier filter counts and labels shift vs prior bands; **relative ranking** of entries unchanged.
- **Primary files**: `src/constants/ratingTiers0to10.js`, `src/utils/scoring.js`, `App.jsx`, `RatingTierLegend.jsx`, `FaqView.jsx`, `translations.js` (welcome copy should avoid stale numeric examples).
