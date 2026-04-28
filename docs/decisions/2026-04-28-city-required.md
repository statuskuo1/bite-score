# City required on both forms

## Decision

`city` is now a required field on both [`CafeForm`](../../src/components/CafeForm.jsx)
and [`RestForm`](../../src/components/RestForm.jsx). Save is blocked
until the user provides one. Label changed from
`City (optional)` to `City *`, matching the existing convention used for
required name + cost fields. Inline `Required` error appears below the
input on submit attempt.

## Rationale

City is the cornerstone of any future location-aware feature
(suggest-near-me, city leaderboards, community-feed-by-city). Letting
it stay blank meant the slow accrual of unusable rows. Cheap to make
required now; expensive to backfill later.

## Consequences

- **Editing legacy rows with blank city** will now block save until the
  user fills one in. That's the intended cleanup nudge - acceptable
  friction for a one-time fix per row.
- **No DB constraint added.** Validation is client-side only; the
  `city` column on `restaurant_places` / `cafe_places` continues to
  default to `''`. A `not null` check would also break legacy reads
  and isn't worth the migration churn for a UX-level requirement.
- **No backfill.** Any existing blank-city rows surface as "needs
  city" the next time the user edits them. Acceptable; alternative is
  a destructive guess.
- **Files touched:** [`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx)
  (`validate()` + city label + error display),
  [`src/components/RestForm.jsx`](../../src/components/RestForm.jsx)
  (`save()` + city label + error display).

## Out of scope

- Adding a DB-level `check (city <> '')` constraint.
- Backfilling city for existing blank rows (heuristics or admin UI).
- Adding a city autocomplete / dropdown - free text remains.
