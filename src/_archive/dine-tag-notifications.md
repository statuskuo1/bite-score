# Archived: individual `dine_tag*` notification paths (restaurants)

Status: **Archived** — code paths below were removed from the active codebase
on 2026-05-04 as part of the restaurant-tags-via-group_visits migration. The
underlying `dine_with_tags` rows are still written everywhere (they power feed
co-diner avatars, the `/add` `DineTagsBanner`, and the LogTab unread-tags
badge); only the duplicate notifications were dropped.

This file is the authoritative source of the removed snippets so a future
revert is a copy-paste away. Do **not** import or call from this file —
treat it as documentation.

## Why dropped

Before this change, when A saved a restaurant tagging B (with B already
logged), B received TWO bell notifications and A also received TWO:

- B side: `dine_tag` (rendered as `dine_tag_mutual`) + `group_visit_tagged`
  (variant `auto_linked`).
- A side: `group_visit_logged` (fired at create-time when B was auto-linked) +
  `dine_tag_back` (fired when B tapped Tag-them-back).

Both pairs covered the same event. The new canonical path is the
`group_visit_*` notifications introduced in
`supabase/migrations/20260522_group_visits.sql`, which carries richer
variants (`standard` / `auto_linked` / `pick_visit`) and structured group
state (`group_visit_members`, auto-resolve trigger, day-7 expiry sweep).

## Scope

- **Restaurants only** — cafes still emit `dine_tag` / `dine_tag_mutual` /
  `dine_tag_back` / `dine_tag_accepted` because there is no group_visits
  equivalent for cafes yet (Phase 2). Edit-restaurant flow also still emits
  `dine_tag` because the edit path doesn't run `createGroupVisitForSave`.
- **Notification rendering** in `src/components/NotificationPanel.jsx` for
  the four `dine_tag*` types is **kept**, so legacy notifications stored in
  the DB before this change still display.
- The in-memory `dine_tag` -> `dine_tag_mutual` re-typing in `src/App.jsx`
  (`annotatedNotifications` `useMemo`) is **kept** for the same reason.

## Removed snippets

### 1. `dine_tag` notification on restaurant ADD

File: `src/App.jsx`, ADD restaurant `onSave` (around line 2014).

Before:

```javascript
const toTag = (e.dineWith || []).filter(p => p.id !== sourceTaggerId);
if (toTag.length) {
  await Promise.all(toTag.map(p=>insertDineTag(supabase,{
    taggerId: user.id,
    taggedId: p.id,
    entryId: data.id,
    entryType: "restaurant",
    restaurantName: e.name,
    city: e.city||"",
    cuisine: e.cuisine||"",
  })));
  fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
}
```

After: same call with `notify: false` added at the bottom of the options
object, suppressing the notification insert inside `insertDineTag` while
keeping the `dine_with_tags` row upsert intact.

Revert: drop the `notify: false,` line.

### 2. `dine_tag_accepted` notification on restaurant ADD (sourceTaggerId branch)

File: `src/App.jsx`, ADD restaurant `onSave` (around line 2085, inside the
`if (sourceTaggerId)` block).

Before:

```javascript
if (sourceTaggerId) {
  await Promise.all([
    supabase.from("dine_with_tags").upsert({
      tagger_id: user.id, tagged_id: sourceTaggerId,
      entry_id: data.id, entry_type: "restaurant",
      restaurant_name: e.name, city: e.city||"", cuisine: e.cuisine||"",
      dismissed: true,
    }, { onConflict: "entry_id,tagger_id,tagged_id", ignoreDuplicates: true }),
    // Loop closed — clear the original tag from this user's banner.
    supabase.from("dine_with_tags")
      .update({ dismissed: true })
      .eq("tagger_id", sourceTaggerId)
      .eq("tagged_id", user.id)
      .ilike("restaurant_name", e.name)
      .eq("dismissed", false),
    supabase.from("notifications").insert({
      user_id: sourceTaggerId, from_user_id: user.id,
      type: "dine_tag_accepted",
      meta: { restaurant_name: e.name, entry_type: "restaurant", city: e.city||"", entry_id: data.id },
    }),
  ]);
  fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
}
```

After: the `notifications.insert` of type `dine_tag_accepted` is removed.
The two `dine_with_tags` upserts/dismisses stay (they keep the banner /
co-diner data consistent).

Revert: paste the third array element (the `notifications.insert(...)` call)
back into the `Promise.all([...])` array and remove the trailing comma on
the previous element accordingly.

Replacement: `group_visit_logged` is automatically inserted by
`createGroupVisit` (when the tagged user is auto_linked at create-time, see
`src/utils/groupVisitsApi.js` lines 214-229) and by `joinExistingGroupVisit`
(when a previously-pending member transitions to logged).

### 3. `dine_tag_back` notification inside `handleGroupVisitMutualBack`

File: `src/App.jsx`, function `handleGroupVisitMutualBack` (around lines
670-706 prior to this change).

Before:

```javascript
async function handleGroupVisitMutualBack(notif) {
  if (!user?.id || !notif?.id) return;
  const fromUserId = notif.from_user_id;
  if (!fromUserId) return;
  const meta = notif.meta || {};
  const entryId = meta.auto_linked_visit_id || null;
  const restaurantName = meta.restaurant_name || "";
  const city = meta.city || "";
  if (meta.tagged_back) return;
  await Promise.all([
    supabase.from("notifications").insert({
      user_id: fromUserId,
      from_user_id: user.id,
      type: "dine_tag_back",
      meta: {
        restaurant_name: restaurantName,
        city,
        entry_id: entryId,
        entry_type: entryId ? "restaurant" : null,
      },
    }),
    supabase.from("notifications")
      .update({ meta: { ...meta, tagged_back: true } })
      .eq("id", notif.id),
  ]);
  setNotifications((prev) => prev.map((n) => (
    n.id === notif.id ? { ...n, meta: { ...(n.meta || {}), tagged_back: true } } : n
  )));
}
```

After:

- The `notifications.insert({ ..., type: "dine_tag_back", ... })` is removed.
- A lookup + dismiss of the matching `dine_with_tags` row was added so that
  the `/add` `DineTagsBanner` clears on Tag-them-back (the row was the
  banner's data source).
- A `setDineTags(...)` filter call was added so the local state matches the
  DB dismiss without waiting for a refetch.

Replacement: A keeps receiving `group_visit_logged` (fired at create-time
when this member was auto_linked — see snippet 2's replacement). Tag-them-back
is now a UI-side acknowledgement, not a notification round-trip.

Revert: restore the `notifications.insert` for `dine_tag_back` inside the
`Promise.all`, and (optionally) remove the new `dine_with_tags` lookup +
dismiss + `setDineTags` filter if you also want the banner-dismiss revert.
The `meta.tagged_back = true` stamp on the notif row should be kept either
way — it drives the past-tense panel rendering for the auto_linked variant.

## Revert procedure

1. Open this file alongside `src/App.jsx`.
2. For each numbered snippet above, locate the `// ARCHIVED 2026-05-04: see
   src/_archive/dine-tag-notifications.md ...` comment block in `src/App.jsx`
   and paste the original snippet back, removing the comment block and any
   `notify: false` flag added during the migration.
3. If you also want cafes back to single-notif (they never broke; this is
   only relevant if you're rolling back something downstream), no further
   action is needed — cafe paths were not touched in this migration.
4. Re-run `npm run lint` (or whatever linter the project uses) to confirm.

## Related

- Migration that introduced `group_visit_tagged` /
  `group_visit_logged`: `supabase/migrations/20260522_group_visits.sql`.
- Group-visit copy and inline tag-back UI:
  `src/components/NotificationPanel.jsx` (auto_linked variant, group_visit_logged).
- Group-visit save flow: `src/App.jsx` ADD restaurant `onSave` group-visits
  block (`createGroupVisitForSave` / `joinExistingGroupVisit` /
  `findCandidateGroupVisit`).
