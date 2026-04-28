# Compare tab mockup polish + Friends row Compare pill

## Context

Iteration on the restaurant-level Compare redesign
([2026-04-28-compare-restaurant-level.md](./2026-04-28-compare-restaurant-level.md))
and the Friends-tab compatibility roll-up
([2026-04-28-friends-tab-compatibility.md](./2026-04-28-friends-tab-compatibility.md)).
Designer mockup landed for Compare; user feedback also flagged that making the
whole Friends row clickable removed the "Compare" button affordance, leaving
no visible call-to-action.

## Decision

### Compare tab

- **Top affordance** is a single small grey button labeled
  `pickFriendToCompare` ("Pick a friend to compare tastes") that returns to
  the picker — replaces the previous "← Back to list".
- **Friend header** is now `Avatar(48) + display_name + "Comparing N shared
  restaurants"` (sub-line via `comparingSharedRestaurants`), no longer using
  `UserIdentity` so the sub-line can carry the share count instead of the
  `@username` handle.
- **Compatibility hero card** replaces the small badge: large `{score}%` on
  the left, "Taste compatibility" label + "You both love …" summary line on
  the right. Background/border are tier-colored via `tasteColor(score / 10)`
  so the card visually agrees with the score (mockup happens to show green
  because 78 % lands on the green tier; lower scores render in the
  appropriate tier color rather than uniformly green).
- **"Both visited" rows** are now wrapped in a **single bordered card** with
  internal dividers between rows. Row content per mockup: flag · name ·
  `{mine} vs {theirs}` (each score tier-colored). Cuisine and city are
  removed from this row to match the mockup's denser layout.
- **You-vs-Friend legend** sits centered below the Both-visited card. "You"
  always renders in `#F0997B` (brand orange); the friend's name renders in
  `#5B9BD5` (the "good" tier blue) — fixed accents picked so the legend
  reads stably even when row scores happen to share a tier color.
- **Discover / Recommend rows** drop the standalone score column. The score
  moves into the sub-line as `{cuisine} · {name} rated {score}` (or
  `You rated {score}` for the inverse section), with the badge on the right.
  The Discover badge tone shifts from orange to blue (matching the friend
  legend color); Recommend stays green (you-side).
- **Top 3 limit** on both `onlyTheirs` and `onlyMine` (constant
  `TOP_DISCOVER_LIMIT = 3`). The previous city-filter chip row is removed —
  with only 3 rows the filter is unnecessary clutter, and friend-name in the
  section header (`{name} tried, you haven't`) gives enough context.
- **Section labels** flip to `#F0997B` orange + 600 weight, matching the
  brand-accent treatment used elsewhere in the app.

### Friends tab

- **Compare pill restored** on each friend row. Sits inline next to the
  match pill on the right side. The whole row stays clickable — clicking
  anywhere (including the pill) jumps to Compare. The pill is rendered as a
  styled `<span>` (not a `<button>`) so it nests inside the row's `<button>`
  without invalid HTML.
- **Section labels** also flip to orange + 600 weight, consistent with
  Compare. Local override only — `S.lbl` in
  [`src/styles/sharedStyles.js`](../../src/styles/sharedStyles.js) is left
  alone so Palette / Drinks / Sweets keep their existing grey labels until
  they're explicitly redesigned.

## Alternatives considered

- **Always-green compatibility card** (literal mockup) — rejected. A 30 %
  match in green misrepresents the data; tier color on the card mirrors the
  number color and matches the Friends-tab match pills.
- **Drop the row click on Friends, keep only the Compare pill** — rejected.
  Whole-row clickability is the lower-effort default for users scanning a
  list; the explicit pill just makes the action visible. Cost is one tiny
  redundancy.
- **Keep city filter chips on Discover** — moot once we cap to 3 rows. If
  Discover ever grows back into a longer scrollable list, the chips can come
  back gated on `onlyTheirs.length > N`.
- **Make `S.lbl` orange globally** — too broad. Three other surfaces use it
  with the original grey treatment; flipping all of them was beyond the
  scope of this change. Doing it consciously per-surface keeps the diff
  reviewable.
- **Personalize section headers via a synthetic "they" key** — rejected.
  Adding `{name}` to `theyTriedYouHavent` reads more naturally
  ("Connor tried, you haven't") and the same template fits both languages
  via the existing `fmtTemplate` substitution.

## Consequences

- The compatibility number still requires `MIN_SHARED_CUISINES = 2` shared
  cuisines (in
  [`src/utils/compatibility.js`](../../src/utils/compatibility.js)). Below
  that threshold the hero card shows "—" with the
  `notEnoughSharedData` message; users won't see a number until they and
  their friend each rate at least 2 of the same cuisines. Lowering the
  threshold to 1 was discussed but deferred — the existing message is
  actionable and the threshold was already exposed via `pairCompatibility`'s
  `opts.minShared`.
- The Both-visited section ditching cuisine/city from rows means a user who
  wants those details has to look at My Log or Global. Acceptable trade for
  the denser scan-friendly layout.
- "You tried, {name} hasn't" uses singular "hasn't" in English. ZH renders
  as `你吃過，{name} 還沒` which is grammatical without subject-verb
  agreement.

**Primary files**:
[`src/components/community/CompareTab.jsx`](../../src/components/community/CompareTab.jsx)
(full layout rewrite),
[`src/components/community/FriendsTab.jsx`](../../src/components/community/FriendsTab.jsx)
(Compare pill restored, orange section labels),
[`src/translations.js`](../../src/translations.js) (new keys
`tasteCompatibility`, `comparingSharedRestaurants`, `friendRatedText`,
`youRatedText`, `youLegend`; reworded `pickFriendToCompare`,
`theyTriedYouHavent`, `youTriedTheyHavent` to take `{name}`; dropped
`cityAll`).
