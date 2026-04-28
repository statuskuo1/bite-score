---
title: FAQ
scope:
  - src/components/FaqView.jsx
  - src/components/RatingTierLegend.jsx
last_reviewed: 2026-04-28
---

## Purpose

The ❓ page (`view === "faq"`). Static FAQ explaining how BITE works, what the rating tiers mean, and other one-off product questions. Read-only in the app — overrides come from the `settings` table and are edited with elevated credentials.

## User flows

- Read the FAQ in the current language (English today; Mandarin scaffolding preserved but stashed — see decisions).
- See the rating tier legend rendered inline.

## UI structure

- Single component: [`FaqView.jsx`](../../src/components/FaqView.jsx).
- Renders an array of `{ q, a }` items. `a` is a React node (often JSX with `<em>` / `<br />` blocks).
- Tier legend reuses [`RatingTierLegend.jsx`](../../src/components/RatingTierLegend.jsx).

## Data sources

- Default copy lives inline in `FaqView.jsx` and uses translation keys via `useLang()`.
- Optional **`settings.faq_override_{index}`** rows can override individual answers at runtime. Loaded into `faqOverrides` in [`App.jsx`](../../src/App.jsx) and passed in as a prop.
- Overrides are edited with the service role / SQL — the anon client cannot write `settings` (see [`features/auth-rls.md`](../features/auth-rls.md)).

## Key logic & current values

- **Override key shape**: `faq_override_<numericIndex>` matches the index of the FAQ item.
- **No edit affordance** in-app — earlier triple-tap-logo admin surface was removed. Edits happen in DB.
- **Tier legend** uses `RATING_010_BANDS` from [`ratingTiers0to10.js`](../../src/constants/ratingTiers0to10.js).

## Decisions

- [2026-04-28 — Stash Mandarin localization](../decisions/2026-04-28-stash-mandarin-localization.md)
- [2026-04-27 — Remove logo triple-tap admin surface](../decisions/2026-04-27-remove-logo-triple-tap-admin-surface.md)
- [2026-04-27 — No admin equal users](../decisions/2026-04-27-no-admin-equal-users.md)
- [2026-04-26 — Rating tiers 0-10 module](../decisions/2026-04-26-rating-tiers-0-10-module.md)
- [2026-04-26 — Normalized BITE tier bands](../decisions/2026-04-26-normalized-bite-tier-bands.md)
