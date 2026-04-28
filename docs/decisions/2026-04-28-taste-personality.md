# Restaurants taste personality: archetype + responsive bullets

## Context

The Restaurants palette card titled "Taste personality" was four lines of
templated copy keyed off four signals (`topRegion`, `avgT`, `avgC`, `rCount`)
through very wide buckets (taste `>=8 / >=6.5 / else`, cost `>70 / >40 / else`,
regions `>=4 / else`). In practice most users land in the same bucket on every
axis, so the card felt static and unrelated to their data — even though it
technically did read it.

Only 4 dimensions were used; the entry record has more (`repeatability`,
`useR`, `wait`, BITE distribution, region concentration, top dish/cafe) that
the card never touched.

## Decision

Replace the inline `pr0..pr3` / `r0..r3` block in
[`src/components/PaletteView.jsx`](../../src/components/PaletteView.jsx) with a
small "personality engine" living in
[`src/utils/tastePersonality.js`](../../src/utils/tastePersonality.js):

1. **Compute richer signals** from the same entries: avg taste + elite-hit
   rate, avg cost, avg wait + long-wait count, must-return rate, recommend
   rate, region concentration + region count + region-share entropy, distinct
   cuisine count, top-BITE pick by restaurant.
2. **Pick one archetype** via first-match rules ordered most-specific →
   least-specific: `Hunter`, `Snob/Connoisseur`, `Splurger`, `Patient
   Pilgrim`, `Critic`, `Loyalist`, `Globetrotter`, default `Explorer`. Each
   archetype carries a PR title/blurb pair and a Roast title/blurb pair, with
   numeric values interpolated from the user's signals.
3. **Layer 1–3 bullets** from a generator chain (`regionMix`, `taste`,
   `value`, `repeat`, `topPick`, `wait`). Each generator can return `null` if
   its signal isn't meaningful; archetypes can mark themselves
   `coversRegion` / `coversValue` to suppress the corresponding bullet so the
   same fact isn't said twice.
4. **Locked state** when `entries.length < 5` (`MIN_ENTRIES_FOR_PERSONALITY`):
   the card shows a single italic line ("Log a few more meals to unlock your
   taste personality.") instead of forcing an archetype on noise. The new
   string lives only in `T.en` per the parity-drift policy below.

Render shape inside the existing card (preserves the PR / Roast toggle):

- big archetype title (accent color)
- one-paragraph blurb with the user's actual numbers in it
- up to 3 muted bullet lines, each backed by a separate signal

## Alternatives considered

- **Just narrow the buckets.** Produces more templated copy that still reads
  the same. Doesn't unlock the unused signals.
- **LLM-generated blurb** (Edge Function calling an LLM with a JSON of
  signals). Cost, latency, network surface, and a degraded offline experience
  for a card that's purely cosmetic. The signals are already plenty rich for
  good templated copy. Could revisit later as an opt-in mode.
- **Persist a derived "type" in the DB.** Premature — recomputing on render
  is cheap (the entries list is already in memory and `<= ~hundreds` of rows)
  and the rules will iterate; not worth a migration to cache string output.

## Consequences

- **English-only.** Per
  [`docs/decisions/2026-04-28-stash-mandarin-localization.md`](2026-04-28-stash-mandarin-localization.md),
  `lang` is hard-coded to `"en"` and "future English copy changes don't have
  to be mirrored in `T.zh` until we re-enable; expect parity drift". The old
  `lang_==="zh"` ternaries in the `pr*/r*` block were dead code and have been
  **removed wholesale** (including the zh strings inside them) — restoring zh
  on revival is a translation pass, not a UI toggle. The unused `lang:lang_`
  destructure in `PaletteView` was also dropped.
- **Files touched:**
  - new: [`src/utils/tastePersonality.js`](../../src/utils/tastePersonality.js)
  - modified: [`src/components/PaletteView.jsx`](../../src/components/PaletteView.jsx)
    (engine call + new card body)
  - modified: [`src/translations.js`](../../src/translations.js) (added
    `tastePersonalityLocked` to `T.en` only)
- **Sweets and Coffee personality cards are unchanged** by this commit. Their
  shape is the same wide-bucket templated copy; the engine here is structured
  to be extended with `getSweetsPersonality` / `getDrinksPersonality` when
  we're ready to port them.
- **Threshold tuning is the new soft cost.** Adding archetypes or shifting
  cutoffs is a one-file change in `tastePersonality.js`; no migration, no
  schema, no other components to touch.
- **Tests** are not added in this pass — the module is pure, but we don't yet
  have a test setup in this repo. Future ADR if we add Vitest.
