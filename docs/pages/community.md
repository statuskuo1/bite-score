---
title: Community
scope:
  - src/components/community/CommunityTab.jsx
  - src/components/community/GlobalTab.jsx
  - src/components/community/FriendsTab.jsx
  - src/components/community/CompareTab.jsx
  - src/components/community/GroupsTab.jsx
  - src/components/community/PlaceLeaderboardRow.jsx
  - src/components/community/UserIdentity.jsx
  - src/components/community/Avatar.jsx
  - src/components/community/Pill.jsx
  - src/utils/profileApi.js
  - src/utils/friendsApi.js
  - src/utils/groupsApi.js
  - src/utils/compatibility.js
last_reviewed: 2026-04-28
---

## Purpose

The 🌐 page (`view === "community"`). Social layer: see how the world rates places, manage friends, compare palates with another user, and share a Group's collective leaderboard.

## User flows

- Switch among four sub-tabs: Global, Friends, Compare, Groups.
- **Global**: top places by aggregated BITE in Restaurants / Drinks / Sweets, with a min-visits filter (default 1).
- **Friends**: list of accepted friends + pending invites. Send an invite by username. Each friend card has a "Compare with" button.
- **Compare**: 1-on-1 palate comparison with the selected friend (compatibility score from [`compatibility.js`](../../src/utils/compatibility.js)).
- **Groups**: create / join a group, see the group's combined leaderboard.

## UI structure

- Tab router: [`CommunityTab.jsx`](../../src/components/community/CommunityTab.jsx). Holds local `active` state and a `compareTarget` so the Friends tab can hand off into Compare with one tap.
- Sub-tabs:
  - [`GlobalTab.jsx`](../../src/components/community/GlobalTab.jsx)
  - [`FriendsTab.jsx`](../../src/components/community/FriendsTab.jsx)
  - [`CompareTab.jsx`](../../src/components/community/CompareTab.jsx)
  - [`GroupsTab.jsx`](../../src/components/community/GroupsTab.jsx)
- Shared row UI: [`PlaceLeaderboardRow.jsx`](../../src/components/community/PlaceLeaderboardRow.jsx).
- Shared identity UI: [`Avatar.jsx`](../../src/components/community/Avatar.jsx), [`UserIdentity.jsx`](../../src/components/community/UserIdentity.jsx), [`Pill.jsx`](../../src/components/community/Pill.jsx).

## Data sources

- **Profiles**: `profiles` table; helpers in [`profileApi.js`](../../src/utils/profileApi.js) (`ensureProfile`, `fetchProfileById`, search-by-username for invites).
- **Friends**: `friend_requests` / `friendships` tables (or equivalent — see `20260428_social_friends_groups.sql`); helpers in [`friendsApi.js`](../../src/utils/friendsApi.js).
- **Groups**: `groups` + `group_members`; helpers in [`groupsApi.js`](../../src/utils/groupsApi.js).
- **Global leaderboard**: `fetchAggregatedRestaurantPlaces` / `fetchAggregatedCafePlaces` in [`visitPlacesApi.js`](../../src/utils/visitPlacesApi.js). Pulls aggregated visit stats per place across all users.

## Key logic & current values

- **Mean-then-BITE**: the Global leaderboard averages each raw input (taste / cost / portions / wait / repeat) across all visits at a place, then applies BITE *once* with the *viewer's own* weights. Bumping My Taste sliders re-ranks Global without a refetch.
- **Per-tab weights**: Restaurants tab uses `restaurantWeights`; Drinks uses `drinkWeights`; Sweets uses `sweetWeights` — different weights per category, identical math.
- **Min-visits filter**: default 1, user-tunable. Keeps single-visit places off the top until they get a second confirmation.
- **Anonymity**: leaderboards display venue stats, not per-user lines. Identifiable rows (Friends, Compare, Groups) use `username` over `display_name`.
- **Username canonicalization**: lowercased on write (see decisions). Search/lookup uses the lowercase form.
- **Compatibility score** (Compare): see [`compatibility.js`](../../src/utils/compatibility.js).

## Decisions

- [2026-04-28 — Community shared UI & leaderboard anonymity](../decisions/2026-04-28-community-shared-ui-and-leaderboard-anonymity.md)
- [2026-04-28 — Community social layer](../decisions/2026-04-28-community-social-layer.md)
- [2026-04-28 — Global leaderboard collapsable rows](../decisions/2026-04-28-global-leaderboard-collapsable-rows.md)
- [2026-04-28 — Global leaderboard mean-then-BITE](../decisions/2026-04-28-global-leaderboard-mean-then-bite.md)
- [2026-04-28 — Username over display_name in community](../decisions/2026-04-28-username-over-displayname-in-community.md)
- [2026-04-28 — Username lowercase & pre-check](../decisions/2026-04-28-username-lowercase-and-pre-check.md)
- [2026-04-28 — Username taken suggestions](../decisions/2026-04-28-username-taken-suggestions.md)
- [2026-04-28 — Profile identity editor](../decisions/2026-04-28-profile-identity-editor.md)
- [2026-04-27 — Profiles community feed](../decisions/2026-04-27-profiles-community-feed.md)
- [2026-04-27 — Community before Add nav](../decisions/2026-04-27-community-before-add-nav.md)
