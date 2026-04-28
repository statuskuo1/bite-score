# Community shared UI + global leaderboard goes anonymous

## Context

Community tabs (Friends / Compare / Groups / Global) had grown three nearly
identical copies of the same `avatar()` helper and a parallel collection of
inline-styled pill buttons. Refactoring was overdue. At the same time, the
Global tab — which aggregates **every** user's visits — was decorating each
place row with `@username` chips for the highest-taste reviewers. Since the
section is meant to read as community-level (not "here's who logged what"), we
wanted those chips gone everywhere it appears (restaurants, drinks, sweets).

Separately, "Add Friend" silently swallowed any failure from
`sendFriendRequest`. If RLS rejected, the network blipped, or the row was
already `pending`, the button just snapped back without explanation, which
read to users as "doesn't work".

## Decision

1. **Drop @username chips from `PlaceLeaderboardRow`** so the Global
   leaderboard reads as community-level for restaurants, drinks, *and* sweets
   (single component, single edit).
2. **Extract three shared community primitives** under
   `src/components/community/`:
   - `Avatar.jsx` — image-or-monogram, `referrerPolicy="no-referrer"` so
     Google avatars render.
   - `Pill.jsx` — primary / default / muted / danger tones; replaces the
     inline-styled `<button>` copies.
   - `UserIdentity.jsx` — `Avatar` + display name + `@handle`, with `row` /
     `header` variants and an optional `nameSuffix` slot for `· you` / `· owner`.
3. **`FriendsTab` / `CompareTab` / `GroupsTab` consume the new primitives.**
   The local `avatar()` helpers and bespoke `<button>` blocks are removed.
4. **Surface add-friend failures inline.** `handleAdd` now reads the
   `{ ok, code }` result, maps codes through `describeAddFriendError(code, t)`,
   and renders a small red message immediately under the row that failed.
   `already_pending` / `already_friends` still trigger a `reload()` so the
   button can flip to the correct state.

## Alternatives considered

- **Tiny `<UserCard>` that also owned the action button slot** — rejected;
  every caller wants a different action layout (single Pill, two-Pill cluster,
  toggle chevron, ›). Forcing a slot prop didn't simplify call sites.
- **Toast/snackbar for add-friend errors** — rejected for v1; we have no
  toast primitive yet, and the error is row-specific, so an inline message
  next to the offending row is more legible.
- **Strip the leaderboard subtitle entirely** — rejected; cuisine / category /
  city are aggregate facts about the place, not a per-user attribution, so
  they stay.

## Consequences

- New shared components: `src/components/community/{Avatar,Pill,UserIdentity}.jsx`.
- Touched: `PlaceLeaderboardRow.jsx`, `FriendsTab.jsx`, `CompareTab.jsx`,
  `GroupsTab.jsx`, `translations.js` (added `addFriendFailed`,
  `cannotAddSelf` for EN + ZH).
- Future community surfaces (e.g. invite picker, public profile) should reach
  for `Avatar` / `Pill` / `UserIdentity` first instead of re-rolling avatars.
- The `topReviewers` field on aggregated places is still produced by
  `fetchAggregatedRestaurantPlaces` / `fetchAggregatedCafePlaces` — no
  consumer reads it now, but keeping it leaves the door open for a future
  per-place "who rated this" detail view (with explicit user consent UX).
