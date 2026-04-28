# Remove single-user info notes from "Top rated" and "Regions explored"

## Context

The Restaurants palette stat grid attached info bubbles (`StatCard`'s `note`
prop) to two cards:

- **Top rated** → `tasteTopNote` ("Irene's judgement may have been clouded by
  bias…"), a personal aside written when the app was a single-user diary.
- **Regions explored** → `regionsNote` ("Open Cuisine Quests from the
  breakdown card to explore by region."), a tutorial pointer that's now
  redundant with the "Cuisine Quests" CTA button living directly under the
  cuisine breakdown card (see
  [`2026-04-27-quests-under-palette-community-nav.md`](2026-04-27-quests-under-palette-community-nav.md)).

Now that the app is a multi-user product, both notes read as out of place.

## Decision

Drop both notes:

- Remove the `topRated` and `regions` branches from the `note={…}` ternary in
  [`src/components/PaletteView.jsx`](../../src/components/PaletteView.jsx);
  the only remaining note is `avgBite` → `avgBitePaletteNote`, which is a
  product explanation (how BITE is computed) and applies to every user.
- Drop the now-unused third tuple element on those `statRows` entries.
- Delete the dead translation keys `tasteTopNote` and `regionsNote` from both
  `T.en` and `T.zh` in
  [`src/translations.js`](../../src/translations.js).

## Alternatives considered

- **Replace the Irene note with neutral copy.** Top-rated is self-explanatory
  ("Top rated" + restaurant name); a generic rephrase would just be noise.
- **Keep `regionsNote` as discovery hint.** The Cuisine Quests button is
  already prominent and labelled, so the bubble is double-signaling.
- **Leave keys, drop only `note` props.** Worse — leaves dead strings the
  next reader has to chase. The existing parity-drift policy
  ([`2026-04-28-stash-mandarin-localization.md`](2026-04-28-stash-mandarin-localization.md))
  doesn't require keeping zh strings around when the en counterpart is gone.

## Consequences

- Files touched:
  - [`src/components/PaletteView.jsx`](../../src/components/PaletteView.jsx)
    (note ternary collapsed to a single `avgBite` check; tuple cleanup).
  - [`src/translations.js`](../../src/translations.js) (dropped
    `tasteTopNote` + `regionsNote` from both locales).
- No behavior change to BITE math, scoring, or the cuisine quests flow.
- The mention of `regionsNote` in
  [`2026-04-27-quests-under-palette-community-nav.md`](2026-04-27-quests-under-palette-community-nav.md)
  is left as historical record (ADRs describe past decisions); future
  readers should treat that bullet as superseded by this file.
