# Decision: Community tab before Add in bottom navigation

## Context

Bottom nav previously listed Community after Add (My Log · My Taste · Add · Community · FAQ). Requests were to **relocate** Community so it is easier to spot and to ensure the old Quests tab is gone (quests UI lives under My Taste only).

## Decision

- Bottom nav order is **My Log · My Taste · Community · Add · FAQ**.
- **`VIEW` dispatch** maps legacy **`quests`** → **`palette`** so any stale client code or bookmarks cannot leave the user on a removed root view.

## Alternatives considered

- **Community after Add** — prior layout; keeps “add visit” nearer the center but buries discovery after the primary action.

## Consequences

- **`src/App.jsx`** (tab order), **`src/state/logReducer.js`** (quests alias).
