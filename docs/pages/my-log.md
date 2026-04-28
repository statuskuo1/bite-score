---
title: My Log
scope:
  - src/App.jsx
  - src/state/logReducer.js
  - src/components/RestRow.jsx
  - src/components/CafeGroupRow.jsx
  - src/components/EntryCard.jsx
  - src/components/VisitsModal.jsx
  - src/components/SwipeRow.jsx
  - src/components/RestForm.jsx
  - src/components/CafeForm.jsx
  - src/utils/visitPlacesApi.js
  - src/utils/rowAccess.js
last_reviewed: 2026-04-28
---

## Purpose

The home page (📋 in the bottom nav). Shows the signed-in user's restaurant and café visits as one grouped list, sorted/filterable, with edit + delete + "log another visit" affordances. Logged-out users see a sign-in gate — no demo data is rendered.

## User flows

- Browse all my restaurant visits, grouped by venue name.
- Switch the list to drinks or sweets (café visits, also grouped by venue).
- Filter by tier (sucks → elite), cuisine, city, repeatability.
- Sort by BITE / taste / visit count / most recent.
- Tap a row to expand: see the venue's average BITE, taste, $/portion, wait, repeat, plus all individual visits.
- Swipe a row (or use action buttons) to edit or delete a visit.
- "Log another visit" jumps into the Add form prefilled with that venue's place-level fields.

## UI structure

- Entry point: [`src/App.jsx`](../../src/App.jsx) — the `st.view === "log"` branch (around lines 474–740) is the whole page.
- Skeleton loader (5 pulsing rows) while `dbLoaded` is false.
- Group rows use [`RestRow.jsx`](../../src/components/RestRow.jsx) for restaurants and [`CafeGroupRow.jsx`](../../src/components/CafeGroupRow.jsx) for drinks/sweets.
- Per-visit drill-down uses [`EntryCard.jsx`](../../src/components/EntryCard.jsx) and [`VisitsModal.jsx`](../../src/components/VisitsModal.jsx).
- Swipe gesture on each row uses [`SwipeRow.jsx`](../../src/components/SwipeRow.jsx).
- Edit mode: same `view === "log"` branch but with `editR` or `editC` set, which renders [`RestForm.jsx`](../../src/components/RestForm.jsx) or [`CafeForm.jsx`](../../src/components/CafeForm.jsx) inline.

## Data sources

- **`restaurant_visits`** joined to **`restaurant_places`** via Supabase's PostgREST embedded resource, plus author profile attached after the fact. Loader: `fetchRestaurantVisitsJoined` in [`visitPlacesApi.js`](../../src/utils/visitPlacesApi.js).
- **`cafe_visits`** joined to **`cafe_places`** the same way: `fetchCafeVisitsJoined`.
- Both fetches filter by `user_id = auth.uid()`; RLS also enforces own-row reads.
- Each visit row is flattened in the UI via `mapRestaurantVisitRow` / `mapCafeVisitRow` (see [`features/places-visits-data-model.md`](../features/places-visits-data-model.md) for the shape).
- State container: `useReducer` with [`logReducer.js`](../../src/state/logReducer.js) (`ADD` / `DEL` / `UPD` / `VIEW` / `LOAD`).
- Edit/delete go through `App.jsx` mutation handlers, gated by [`rowAccess.canMutateVisit`](../../src/utils/rowAccess.js) (only mutate when `user_id === auth.uid()`).

## Key logic & current values

- **Group-by-name**: the visible list is `Object.values(entries.reduce((acc, e) => { ...e.name as key... }, {}))`. Multiple visits to the same venue collapse to one card.
- **Group averages**: BITE / taste / cost / portions / wait / repeat are arithmetic means over the group, computed client-side every render. BITE itself is `calcBiteOutOf10(...)` per visit, then averaged ("BITE-then-mean", *not* "mean-then-BITE" — that variant is reserved for the Global leaderboard, see [`features/scoring.md`](../features/scoring.md)).
- **Sort BITE**: when sorting by BITE on the grouped list, ties break on the larger visit count.
- **Filters** are applied to the flat visit list before grouping — a venue appears if any of its visits matches.
- **Empty state**: signed-in user with zero visits sees the empty-state copy (no skeleton).
- **Auth gate**: rendered only when `user` is truthy; if `authReady && !user`, `AuthModal` overlays the page.

## Decisions

Most recent first. See [`docs/decisions/`](../decisions/) for the full history.

- [2026-04-29 — Assign legacy visits to owner](../decisions/2026-04-29-assign-legacy-visits-to-owner.md)
- [2026-04-28 — Drop score cell from expanded row grid](../decisions/2026-04-28-drop-score-cell-from-expanded-row-grid.md)
- [2026-04-28 — Avg BITE vs avg taste](../decisions/2026-04-28-avg-bite-vs-avg-taste.md)
- [2026-04-28 — Remove single-user stat notes](../decisions/2026-04-28-remove-single-user-stat-notes.md)
- [2026-04-27 — My Log visits two-query merge](../decisions/2026-04-27-my-log-visits-two-query-merge.md)
- [2026-04-27 — My Log fetch query shape](../decisions/2026-04-27-my-log-fetch-query-shape.md)
- [2026-04-27 — My Log user_id pass-through](../decisions/2026-04-27-my-log-user-id-pass-through.md)
- [2026-04-27 — My Log fetch debug logging](../decisions/2026-04-27-my-log-fetch-debug-logging.md)
- [2026-04-27 — Per-user restaurant reads](../decisions/2026-04-27-per-user-restaurant-reads.md)
- [2026-04-27 — Auth required before log](../decisions/2026-04-27-auth-required-before-log.md)
- [2026-04-27 — Shared row form chrome](../decisions/2026-04-27-shared-row-form-chrome.md)
