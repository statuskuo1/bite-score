# Archived: individual `dine_tag*` + per-member `group_visit_logged`
# notification paths

Status: **Archived** — code paths below were removed from the active
codebase on 2026-05-04 as part of the tagging notifications refactor.

**Update (2026-05-04, dine_with_tags deprecation):** The
`dine_with_tags` table itself was dropped in
`20260527_drop_dine_with_tags.sql` — the snippets below reference a table
that no longer exists. Reverting any of them now requires first restoring
the table via `20260510_dine_with_tags.sql` +
`20260516_dine_with_tags_unique.sql`, plus re-creating the legacy
`fetch_co_diners*` RPCs (see `20260513_co_diners_rpc.sql` /
`20260514_feed_reactions_and_co_diners_batch.sql` /
`20260521_co_diners_no_exclude.sql`). Co-diner avatars + `/add` banner +
LogTab badge are now driven by `group_visit_members` via the `_v2` RPCs.

This file is the authoritative source of the removed snippets so a future
revert is a copy-paste away. Do **not** import or call from this file —
treat it as documentation.

## Why dropped

The 2026-05-04 refactor consolidated tagging notifications to exactly two
live types plus one new party-logged signal:

| Kept / new                 | Dropped (inserts; legacy rows still render)   |
|---------------------------|-----------------------------------------------|
| `group_visit_tagged`       | `dine_tag`                                    |
| `group_visit_all_logged`   | `dine_tag_back`                               |
|                            | `dine_tag_accepted`                           |
|                            | `dine_tag_mutual` (was synthetic, never DB)   |
|                            | `group_visit_logged` (per-member creator ping)|

The two live types carry:

- `group_visit_tagged` with `meta.variant`:
  - `standard` — "All bark no BITE 🐶 @X tagged you at Y. Log your BITE?"
  - `auto_linked` — "Looks like you already logged! Tag them to your entry?"
  - `pick_visit` — "Which visit was with @X?" (opens a picker)
- `group_visit_all_logged` — "Look at you! The whole party logged at Y."
  Fanned out by the Postgres auto-resolve trigger
  (`supabase/migrations/20260504_tagging_refactor.sql`) once the parent
  `group_visits` row transitions from `pending` to `resolved`.

## Scope

- Applies to both **restaurants and cafes**. The previous
  restaurants-only scoping was lifted — `group_visit_tagged` is the single
  tag notif for both kinds.
- Notification **rendering** in
  `src/components/NotificationPanel.jsx` for the legacy `dine_tag*` and
  `group_visit_logged` types is **kept** so DB rows written before this
  refactor still display sensibly.
- The in-memory `dine_tag` -> `dine_tag_mutual` re-typing `useMemo` in
  `src/App.jsx` **was removed** — no new `dine_tag` rows are written, so
  nothing else to re-type.

## Removed snippets

### 1. `dine_tag` notification on ADD (both restaurant + cafe)

File: `src/utils/dineWithApi.js`, `insertDineTag(...)`.

Before:

```javascript
if (notify) {
  const { error: nErr } = await client.from("notifications").insert({
    user_id: taggedId,
    from_user_id: taggerId,
    type: "dine_tag",
    meta: { restaurant_name: restaurantName, entry_type: entryType, city, cuisine, entry_id: entryId || null },
  });
  if (nErr) console.warn("[BITE] insertDineTag notification:", nErr.message);
}
```

After: the block is removed entirely. The `notify` parameter was also
dropped from the function signature — the `dine_with_tags` row insert /
reverse-row dismiss is the only thing `insertDineTag` does now.

Revert: restore the `notify = true` parameter and the `if (notify) { ... }`
block.

### 2. `dine_tag_accepted` notification on ADD (sourceTaggerId branch)

File: `src/App.jsx`, ADD `onSave` (both restaurant + cafe). This path was
originally removed for restaurants only in an earlier migration; the
2026-05-04 refactor extends that to cafes by making `group_visit_tagged`
the canonical tag notif across both kinds. The `dine_with_tags` upsert +
dismiss still runs (keeps banner / co-diner data consistent).

Replacement: `group_visit_all_logged` fires to **all** members once the
whole party has logged. `dine_tag_accepted` was "your tagger was told you
accepted"; the new party-logged fan-out is strictly better (one notif when
there's something meaningful to celebrate instead of one ping per tag-back
round-trip).

### 3. Per-member `group_visit_logged` on create + join

File: `src/utils/groupVisitsApi.js`, `createGroupVisit(...)` +
`joinExistingGroupVisit(...)`.

Before (`createGroupVisit`):

```javascript
// For auto-linked members, also notify the creator that B "logged" their
// visit (which is exactly what auto-link is — no further action required).
await Promise.all((taggedMembers || [])
  .filter((m) => m.status === "logged" && m.visitId)
  .map((m) => insertNotification(client, {
    userId: creatorId,
    fromUserId: m.userId,
    type: "group_visit_logged",
    meta: { group_visit_id: gv.id, kind: k, place_id: placeId, restaurant_name: restaurantName || "", entry_id: m.visitId, entry_type: k },
  })));
```

Before (`joinExistingGroupVisit`):

```javascript
if (wasPending) {
  if (gv.created_by) {
    await insertNotification(client, {
      userId: gv.created_by,
      fromUserId: userId,
      type: "group_visit_logged",
      meta: { group_visit_id: groupVisitId, kind: k, place_id: placeId, restaurant_name: gv.restaurant_name || "", entry_id: visitId || null, entry_type: k },
    });
  }
}
```

After: both blocks removed. The Postgres auto-resolve trigger
(`group_visit_members_after_status_change`) fans out one
`group_visit_all_logged` notification per member when the parent transitions
from pending to resolved.

Side effect: `createGroupVisit` now inserts all members as `status='pending'`
first, then UPDATEs the creator + auto-linked members to `'logged'`. The
UPDATE path is what fires the trigger; if we inserted them as `'logged'`
directly (the previous shape) the trigger wouldn't fire and the party-
logged fan-out would miss the all-auto-linked edge case.

### 4. `dine_tag_back` notification inside `handleGroupVisitMutualBack`

File: `src/App.jsx`, `handleGroupVisitMutualBack`.

This was already partially archived in an earlier migration; the
2026-05-04 refactor additionally renames the user-facing action from
"Tag them back" to "Tag to my entry" and clarifies that the handler
attaches the tagger onto the user's existing log (no reciprocal save, no
tag-back notif). See the handler's updated JSDoc for the new contract.

### 5. `dine_tag_back` notification inside `handleDineTagMutualBack`

File: `src/App.jsx`, `handleDineTagMutualBack`.

Before:

```javascript
await Promise.all([
  dismissDineTag(supabase, incomingTag.id),
  outgoingTag && dismissDineTag(supabase, outgoingTag.id),
  supabase.from("notifications").insert({
    user_id: fromUserId, from_user_id: user.id,
    type: "dine_tag_back",
    meta: {
      restaurant_name: restaurantName,
      city: notif.meta?.city || "",
      entry_id: outgoingTag?.entry_id || null,
      entry_type: outgoingTag?.entry_type || null,
    },
  }),
].filter(Boolean));
```

After: the `notifications.insert` is removed. The handler now only
dismisses the inbound/outbound `dine_with_tags` rows. It only runs for
legacy `dine_tag_mutual` panel rows — new notifications use
`handleGroupVisitMutualBack` via `group_visit_tagged` / `auto_linked`.

### 6. `dine_tag_back` notification inside `DineTagsBanner.handleTagBack`

File: `src/components/DineTagsBanner.jsx`, `handleTagBack`.

Before:

```javascript
supabase.from("notifications").insert({
  user_id: tag.tagger_id,
  from_user_id: userId,
  type: "dine_tag_back",
  meta: { restaurant_name: tag.restaurant_name, entry_type: existingEntryType, city: tag.city || "", entry_id: existingEntry.id },
}),
```

After: the insert is removed and the function was renamed
`handleTagToMyEntry`. The button label flipped from "Tag them back" to
"Tag to my entry". `dine_with_tags` upsert/dismiss is unchanged —
co-diner pills still populate off the reciprocal row.

## Revert procedure

1. Open this file alongside `src/App.jsx` / `src/utils/dineWithApi.js` /
   `src/utils/groupVisitsApi.js` / `src/components/DineTagsBanner.jsx` /
   `src/components/NotificationPanel.jsx`.
2. For each numbered snippet above, paste the original code back into the
   corresponding function. Restore the `notify` parameter on
   `insertDineTag` if reverting snippet 1.
3. Drop `group_visit_all_logged` from the notifications type-check
   constraint added in `supabase/migrations/20260504_tagging_refactor.sql`
   (or simply skip running that migration).
4. Re-run `npm run lint` to confirm.

## Related

- Refactor migration:
  `supabase/migrations/20260504_tagging_refactor.sql` (adds
  `group_visit_all_logged`, extends the auto-resolve trigger + expiry RPC
  to fan it out, adds `auto_attach_visit_to_group_visits` +
  `find_expired_group_visit_candidates` RPCs for the 30-day listening
  window).
- Group-visit migration that introduced `group_visit_tagged` /
  `group_visit_logged`: `supabase/migrations/20260522_group_visits.sql`.
- Retrospective "Was this with @X on {date}?" prompt:
  `src/components/RetroAttachSheet.jsx` +
  `src/App.jsx` `runPostSaveGroupVisitBackfill`.
- Visit-date Basics field (drives the ±30-day auto-attach + retro prompt):
  `src/components/RestForm.jsx`, `src/components/CafeForm.jsx`,
  `src/utils/visitDate.js`.
