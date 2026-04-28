---
title: Add
scope:
  - src/App.jsx
  - src/components/RestForm.jsx
  - src/components/CafeForm.jsx
  - src/components/PlacePicker.jsx
  - src/components/OrderCombobox.jsx
  - src/components/FormScoreHeader.jsx
  - src/components/ScoreDisplay.jsx
  - src/components/CuisineInput.jsx
  - src/components/RepeatPicker.jsx
  - src/components/SectionLabel.jsx
  - src/components/FieldLabel.jsx
  - src/components/Toggle.jsx
  - src/utils/visitPlacesApi.js
  - src/utils/googlePlacesApi.js
last_reviewed: 2026-04-28
---

## Purpose

The ➕ page (`view === "add"`). Center button in the bottom nav. A single form surface that toggles between three add types — Restaurant, Drinks, Sweets — and writes one visit + (optionally) one place row to Supabase.

## User flows

- Pick add type at the top (Restaurant / Drinks / Sweets) — toggles the form chrome.
- Set City first (required, free text) — this scopes Google Places predictions to that city instead of the browser's IP location, so logging a Chicago spot from an NYC IP works out of the box.
- Type or pick the venue via [`PlacePicker.jsx`](../../src/components/PlacePicker.jsx). Selecting an existing place pulls its cuisine, fusion flag, and city forward (and may overwrite the typed city with the place's canonical `verified_city`).
- Fill in score inputs (taste / cost / portions / wait) and repeatability — the live BITE score updates in [`FormScoreHeader.jsx`](../../src/components/FormScoreHeader.jsx).
- For Drinks/Sweets, also pick `category`, an `order` via [`OrderCombobox.jsx`](../../src/components/OrderCombobox.jsx) (suggests past orders + cross-user popular orders), plus optional coffee tasting fields (bean origin, milk level, roast, acidity / body / sweetness, flavor notes).
- Save → returns to My Log. Café form also has "save and continue" for batching multiple items at one café.

## UI structure

- Wrapper: `view === "add"` branch in [`App.jsx`](../../src/App.jsx) (around line 807). Switches between [`RestForm.jsx`](../../src/components/RestForm.jsx) and [`CafeForm.jsx`](../../src/components/CafeForm.jsx) based on `addType`.
- Both forms share chrome: `FormScoreHeader`, `SectionLabel`, `FieldLabel`, `Toggle`, `RepeatPicker`, `PlacePicker`.
- Coffee-specific fields live only in `CafeForm` and only when `category` is Coffee/Espresso (controls visibility of `BEAN_ORIGINS`, roast levels, flavor notes).

## Data sources

- Place catalog (`places` prop): `restaurantPlaces` / `cafePlaces` — loaded once on auth boot via `fetchAllRestaurantPlaces` / `fetchAllCafePlaces` from [`visitPlacesApi.js`](../../src/utils/visitPlacesApi.js). Shared cross-user, used to power autocomplete and prevent dup place rows.
- Save flow:
  - `ensureRestaurantPlace` / `ensureCafePlace` resolves the venue by case-insensitive name (`ilike`) and inserts a new place row if none exists.
  - Then inserts a visit row via `restaurantVisitInsertPayload` / `cafeVisitInsertPayload` (or update payload for edits).
- Edit mode reuses the same form but pre-fills from the visit being edited.
- Past-order autofill: same-place visits in the user's own log; cross-user popular orders via `fetchPopularOrdersForPlace` (RPC).

## Key logic & current values

- **Required fields (restaurants)**: `name`, `cost`, `city`. `portions` defaults to 1. City sits **above** the venue name so the user sets geographic context before searching.
- **Required fields (cafés)**: same plus `category`.
- **Google Places location bias**: `PlacePicker` forwards the typed City to [`searchGooglePlaces`](../../src/utils/googlePlacesApi.js) as `cityHint`, which appends it to the Google Text Search `textQuery` (e.g. `"joe's pizza chicago"`). Empty City falls back to Google's IP-based bias. Coordinate-based `locationBias` is supported by the function but not wired up — reserved for a future geocoded upgrade.
- **Live score** uses [`scoring.js`](../../src/utils/scoring.js) with the active tab's committed weights:
  - Restaurants → `calcBiteOutOf10(t, cost, portions, wait, useR, repeatability, weights)`.
  - Cafés → `calcCafeOutOf10(...)`.
  - See [`features/scoring.md`](../features/scoring.md).
- **Place autofill priority**: when picking an existing place, the form pulls `cuisine`/`isFusion`/`city` from the place row (place is the source of truth for venue identity), and layers visit-level defaults (`portions`, `wait`, `useR`, `repeatability`) from the user's most recent visit at that place if any.
- **Order combobox** suggests in this order: past orders at this exact place > past orders by category > cross-user popular orders at this place.

## Decisions

- [2026-04-28 — City biases Google search](../decisions/2026-04-28-city-biases-google-search.md)
- [2026-04-28 — Cafe form tweaks](../decisions/2026-04-28-cafe-form-tweaks.md)
- [2026-04-28 — Unify cafe/restaurant forms](../decisions/2026-04-28-unify-cafe-restaurant-forms.md)
- [2026-04-28 — City required](../decisions/2026-04-28-city-required.md)
- [2026-04-28 — Place picker shared catalog](../decisions/2026-04-28-place-picker-shared-catalog.md)
- [2026-04-28 — Order combobox & popular orders](../decisions/2026-04-28-order-combobox-and-popular-orders.md)
- [2026-04-28 — Coffee tasting fields](../decisions/2026-04-28-coffee-tasting-fields.md)
- [2026-04-28 — Bean origin countries](../decisions/2026-04-28-bean-origin-countries.md)
- [2026-04-28 — Roastier roast copy](../decisions/2026-04-28-roastier-roast-copy.md)
- [2026-04-28 — Google Places verification deferred](../decisions/2026-04-28-google-places-verification-deferred.md)
- [2026-04-27 — Add centered in bottom nav](../decisions/2026-04-27-add-centered-in-bottom-nav.md)
- [2026-04-27 — Shared row form chrome](../decisions/2026-04-27-shared-row-form-chrome.md)
