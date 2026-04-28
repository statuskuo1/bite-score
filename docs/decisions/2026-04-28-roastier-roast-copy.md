# Roastier Roast Mode copy

## Context

Roast Mode is the orange-pill toggle on the Restaurants / Drinks / Sweets
palette personality cards (opposite of "PR version"). Existing roast copy was
sometimes sharp ("Variety is dead and you killed it.") but often landed soft
("Yes we get it, you're cultured.", "We'll wait.", "That's the ceiling."),
which dulled the joke. Owner asked for ruthlessly funnier rewrites.

## Decision

Rewrite ~30 roast strings across three surfaces, using two different comedic
registers tuned to each surface's data shape.

- **Restaurants → mean-girl / group-chat bitchy**
  ([`src/utils/tastePersonality.js`](../../src/utils/tastePersonality.js))
  All 8 archetype `roastBlurb`s and all `.roast` strings inside the 6
  `BULLET_GENERATORS`. Restaurants have the richest signal (avg taste, avg
  cost, region share, must-return %, top BITE, wait stats) so the register
  punches at the *patterns* the data exposes, in a "babe / sweetie, I'm
  saying it because someone has to" voice.
- **Drinks + Sweets → absurd / unhinged metaphor**
  ([`src/components/DrinksPalette.jsx`](../../src/components/DrinksPalette.jsx),
  [`src/components/SweetsPalette.jsx`](../../src/components/SweetsPalette.jsx))
  Smaller signal surface and a lower bar for "weird" — these benefit from
  bigger swings (Stockholm syndrome, "structural opening in your face",
  "ghost with no unfinished business"). Numerical interpolation added to
  drinks/sweets personality lines so the roast is anchored in the user's
  actual `avgT`.

`roastTitle` strings were preserved (Hunter / Snob / Splurger / Line-Stander
/ Critic / Loyalist / Globetrotter / Explorer) — they were already
deliberate.

## Alternatives considered

- **One register everywhere.** Rejected — restaurants reward mean-girl
  specificity (numbers + names land harder as petty observations); drinks /
  sweets have less data to lean on, so unhinged metaphor carries the joke.
  A mixed register also keeps each surface from feeling samey.
- **Touch only the obviously-soft lines.** Rejected — tone consistency
  matters more than line-by-line triage; partial pass would leave the strong
  lines mismatched with sharper neighbors.
- **Make Roast Mode opt-in via a confirm dialog.** Rejected — already opt-in
  via the explicit toggle pill (`prVersion ↔ roastMe`). PR copy stays SFW;
  the toggle is the consent.

## Consequences

- **PR / English copy untouched** — `title`, `blurb`, and `.text` on the
  archetypes / bullets, plus `personality`, `milkLine`, `beanLine`,
  `mustReturnLine`, and `topOrderLine` in the drink/sweet palettes. Roast
  Mode is a parallel string set, not a replacement.
- **Drinks / sweets personality lines now interpolate `avgT`** — slight
  behavior change from before (numbers were only used in conditions, not
  surfaced). Makes the roast more specific; matches the restaurants
  pattern.
- **Off-limits guardrails** for any future roast copy: no body / weight /
  health, no slurs, no money-shame past what's already in the data, and no
  attacks on anything outside the user's own log. Punch at the data, not
  the person.
- **Files changed**: `src/utils/tastePersonality.js`,
  `src/components/DrinksPalette.jsx`, `src/components/SweetsPalette.jsx`.
- **Reviving Mandarin** (see `2026-04-28-stash-mandarin-localization.md`)
  will require a fresh translation pass for these new lines whenever it
  happens; expected per that ADR.
