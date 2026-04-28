# Lower taste-personality unlock from 5 → 1 entry

## Context

The Restaurants "Taste palette" card was gated behind
`MIN_ENTRIES_FOR_PERSONALITY = 5` (see
[`2026-04-28-taste-personality.md`](2026-04-28-taste-personality.md)). New
users hit the locked placeholder for their first 4 logs, which made the card
feel inert in the period when engagement matters most.

## Decision

Set `MIN_ENTRIES_FOR_PERSONALITY = 1` so the card starts populating on the
first entry. The archetype + bullet engine degrades gracefully at low N:

- `ARCHETYPES` are scanned most-specific → least-specific; the only ones whose
  `match` could trip on tiny samples (`hunter`, `snob`, `splurger`,
  `patientPilgrim`, `loyalist`) require strong signals (e.g. `topPick.score
  >= 8.5`, `eliteHitRate >= 0.35`, `topRegionShare >= 0.5`) that genuinely
  hold from the first entry when they fire.
- `critic` is already gated on `s.total >= 10`, so it can't fire prematurely.
- `globetrotter` requires `regionCount >= 5` — also fine at low N.
- Otherwise the `explorer` fallback kicks in with copy designed for early
  users: "You're still mapping it out — keep logging and the personality
  sharpens."
- Bullet generators each return `null` when their signal isn't meaningful, so
  with one entry the card typically renders just the archetype title + blurb,
  which is exactly the desired "starts populating" behavior.

## Alternatives considered

- **Threshold of 3.** Compromise between "instant feedback" and "stable
  signal", but the engine already self-suppresses weak signals, so the extra
  gate would just re-introduce the locked-card UX it's meant to avoid.
- **Different copy under N=1..4 instead of unlocking.** More work, and the
  Explorer archetype already serves this role.

## Consequences

- Primary file: [`src/utils/tastePersonality.js`](../../src/utils/tastePersonality.js)
  (one-line constant change).
- The locked placeholder string `tastePersonalityLocked` in
  [`src/translations.js`](../../src/translations.js) is now reachable only at
  `entries.length === 0`, which is already covered by the `!total` empty
  state earlier in `PaletteView`. The string is effectively dead but
  harmless; leaving it in place keeps the gating logic flexible if we want to
  raise the threshold again.
- Prior ADR [`2026-04-28-taste-personality.md`](2026-04-28-taste-personality.md)
  still describes the engine accurately; only its "< 5" threshold reference
  has been updated to point here.
