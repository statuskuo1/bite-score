# Decision: Add tab centered in bottom navigation

## Context

The bottom nav previously placed Community before Add (`My Log · My Taste · Community · Add · FAQ`, see `2026-04-27-community-before-add-nav.md`). Add is the primary call-to-action and is rendered with a raised orange circle button, so it should sit in the visual center of the five-tab strip.

## Decision

- Bottom nav order is now **My Log · My Taste · Add · Community · FAQ**.
- Add (the elevated FAB-style tab) occupies the middle slot so its prominence matches its position; Community moves to slot 4.

## Alternatives considered

- **Community before Add** — easier discovery for Community, but left the raised Add button off-center and visually unbalanced.

## Consequences

- Reverses the ordering choice in `2026-04-27-community-before-add-nav.md`; that prior ADR remains as history.
- Single file touched: `src/App.jsx` (the tab array on the bottom-nav row).
