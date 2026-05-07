/**
 * Group visits API over `public.group_visits` and `public.group_visit_members`.
 *
 * Group visits coordinate the "we all ate dinner together — log it" flow:
 *   1. User A saves a visit with tagged friends → createGroupVisit(...)
 *      inserts one parent row + one member row per tagger/tagged user + one
 *      `group_visit_tagged` notification per tagged friend (variant chosen
 *      per-friend based on whether they already have a matching visit).
 *   2. A tagged friend B taps the notification → applyGroupVisitPrefill() in
 *      App.jsx loads the group + members and prefills the Add form. On save,
 *      App.jsx detects an active addGroupVisitId and calls
 *      joinExistingGroupVisit(...) instead of createGroupVisit(...).
 *   3. Auto-resolve: when every member transitions to logged/skipped, a
 *      Postgres trigger flips the parent to status='resolved' and fans out
 *      one `group_visit_all_logged` notification to every member (the
 *      "whole party logged" ping). The per-member `group_visit_logged`
 *      creator ping was removed on 2026-05-04 — see
 *      `src/_archive/dine-tag-notifications.md`.
 *   4. Day-7 expiry: tick_group_visits_expiry() runs on every notif-panel
 *      open and skips/expires stale rows.
 *   5. 30-day retroactive attach: on save, the client calls
 *      `auto_attach_visit_to_group_visits` so a late log at the same place
 *      within ±30 days automatically attaches to any pending group_visit
 *      the user was tagged into (same mechanism as "tag them back", just
 *      driven by the save itself instead of a user action).
 *
 * As of the dine_with_tags deprecation
 * (20260526_consolidate_to_group_visit_members /
 * 20260527_drop_dine_with_tags), `group_visit_members` is the SOLE
 * source of truth for co-diner relationships. Feed cards, the /add banner,
 * the LogTab badge, and the CompareTab "dined together" filter all read
 * from `group_visit_members` via the v2 RPCs (see helpers at the bottom
 * of this file). The legacy `dine_with_tags` table no longer exists.
 *
 * Phase 2 (`20260523_group_visits_cafes.sql`) extends this to cafes (drinks
 * + sweets). Each function takes a `kind: 'restaurant' | 'cafe'` parameter
 * that picks the right place table (`restaurant_places` / `cafe_places`)
 * and the right visit table (`restaurant_visits` / `cafe_visits`). On the
 * parent `group_visits` row, kind is stored explicitly and the FK is split
 * into `restaurant_place_id` / `cafe_place_id`; the same split applies to
 * `group_visit_members.{restaurant,cafe}_visit_id`.
 */

const PROFILE_FIELDS = "id, username, display_name, avatar_url";

const NOTIFICATION_VARIANTS = new Set(["standard", "auto_linked", "pick_visit"]);

const VALID_KINDS = new Set(["restaurant", "cafe"]);

function normalizeKind(kind) {
  return VALID_KINDS.has(kind) ? kind : "restaurant";
}

function placeColumnFor(kind) {
  return kind === "cafe" ? "cafe_place_id" : "restaurant_place_id";
}

function memberVisitColumnFor(kind) {
  return kind === "cafe" ? "cafe_visit_id" : "restaurant_visit_id";
}

function visitsTableFor(kind) {
  return kind === "cafe" ? "cafe_visits" : "restaurant_visits";
}

// Flatten a member row from the DB (which has both restaurant_visit_id and
// cafe_visit_id columns) into a single visitId regardless of kind. Callers
// only ever care about "this member's visit, whichever table it's in".
function memberVisitId(row) {
  return row?.restaurant_visit_id || row?.cafe_visit_id || null;
}

const GROUP_VISIT_SELECT =
  "id, created_by, kind, restaurant_place_id, cafe_place_id, restaurant_name, visited_at, status";

const MEMBER_SELECT =
  "id, user_id, restaurant_visit_id, cafe_visit_id, status, tagged_by";

/**
 * Find a pending group_visit at `placeId` (resolved against the kind-specific
 * place column) whose visited_at is within ±7 days of `visitedAt` and which
 * has at least one overlapping member with `memberIds` (the candidate save's
 * [creator, ...tagged]). Returns the most recent match or null.
 *
 * Members are returned alongside so the caller can render the "Is this the
 * same dinner as @{creator} on {date}?" sheet without a second round-trip.
 */
export async function findCandidateGroupVisit(client, { kind, placeId, memberIds, visitedAt }) {
  if (!placeId || !memberIds?.length) return null;
  const k = normalizeKind(kind);
  const at = visitedAt ? new Date(visitedAt) : new Date();
  const lower = new Date(at.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const upper = new Date(at.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await client
    .from("group_visits")
    .select(`${GROUP_VISIT_SELECT}, group_visit_members(user_id, status)`)
    .eq("kind", k)
    .eq(placeColumnFor(k), placeId)
    .eq("status", "pending")
    .gte("visited_at", lower)
    .lte("visited_at", upper)
    .order("visited_at", { ascending: false });

  if (error) {
    console.warn("[BITE] findCandidateGroupVisit:", error.message);
    return null;
  }
  if (!rows?.length) return null;

  const want = new Set(memberIds);
  const match = rows.find((r) =>
    (r.group_visit_members || []).some((m) => want.has(m.user_id)),
  );
  if (!match) return null;

  // Hydrate creator profile so the prompt can render "@username on {date}".
  const { data: creator } = await client
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", match.created_by)
    .maybeSingle();

  return {
    id: match.id,
    createdBy: match.created_by,
    kind: match.kind,
    placeId: match.restaurant_place_id || match.cafe_place_id,
    restaurantName: match.restaurant_name,
    visitedAt: match.visited_at,
    status: match.status,
    members: match.group_visit_members || [],
    creatorProfile: creator || null,
  };
}

/**
 * Search the tagged user's restaurant_visits / cafe_visits (per kind) for an
 * entry at `placeId` with `visited_at` within ±3 days of the group's
 * `visitedAt`. Returns at most a handful of rows ordered newest-first. Used
 * at create-time to pick a notification variant per tagged member:
 *   length === 0 → 'standard'    (send the standard "Log your visit" prompt)
 *   length === 1 → 'auto_linked' (auto-link + tag-back prompt)
 *   length >= 2  → 'pick_visit'  (ask which visit was the group dinner)
 */
export async function findAlreadyLoggedMatch(client, { kind, userId, placeId, visitedAt }) {
  if (!userId || !placeId) return [];
  const k = normalizeKind(kind);
  const at = visitedAt ? new Date(visitedAt) : new Date();
  const lower = new Date(at.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const upper = new Date(at.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from(visitsTableFor(k))
    .select("id, visited_at")
    .eq("user_id", userId)
    .eq("place_id", placeId)
    .gte("visited_at", lower)
    .lte("visited_at", upper)
    .order("visited_at", { ascending: false })
    .limit(5);

  if (error) {
    console.warn("[BITE] findAlreadyLoggedMatch:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Insert one notification row. Centralized so variants and types stay
 * consistent. Failures log and swallow — notifications are best-effort.
 */
async function insertNotification(client, { userId, fromUserId, type, meta }) {
  if (!userId || !fromUserId) return;
  const { error } = await client.from("notifications").insert({
    user_id: userId,
    from_user_id: fromUserId,
    type,
    meta: meta || {},
  });
  if (error && error.code !== "23505") console.warn(`[BITE] insertNotification(${type}):`, error.message);
}

/**
 * Create a new group visit with the creator + tagged members. Caller is
 * expected to have already decided per-member variant + status (see App.jsx
 * save flow): `taggedMembers` is a list of
 *   { userId, variant, status, visitId?, candidateVisitIds? }
 *
 * `variant` is one of 'standard' | 'auto_linked' | 'pick_visit'. One
 * `group_visit_tagged` notification is fired per tagged member. The creator
 * does not receive any per-member notifications; they see the single
 * `group_visit_all_logged` notification when the whole party has logged
 * (fanned out by the Postgres auto-resolve trigger).
 *
 * `kind` decides which place column gets `placeId` and which member visit
 * column gets `creatorVisitId` / `m.visitId`. Notification meta also carries
 * `kind` so consumers (NotificationPanel, applyGroupVisitPrefill,
 * handleGroupVisitMutualBack, feed scroll target) can dispatch correctly.
 *
 * Returns { id, members } on success, null on hard failure.
 */
export async function createGroupVisit(client, {
  kind,
  creatorId,
  placeId,
  restaurantName,
  visitedAt,
  creatorVisitId,
  taggedMembers,
}) {
  if (!creatorId || !placeId) return null;
  const k = normalizeKind(kind);
  const placeCol = placeColumnFor(k);
  const memberVisitCol = memberVisitColumnFor(k);
  try {
    const { data: gv, error: gvErr } = await client
      .from("group_visits")
      .insert({
        created_by: creatorId,
        kind: k,
        [placeCol]: placeId,
        restaurant_name: restaurantName || "",
        visited_at: visitedAt || new Date().toISOString(),
      })
      .select("id")
      .single();
    if (gvErr || !gv?.id) {
      console.warn("[BITE] createGroupVisit parent:", gvErr?.message);
      return null;
    }

    // Insert every member as 'pending' first, then flip to 'logged' via an
    // UPDATE for the creator + any auto-linked members. The UPDATE path is
    // what fires the `group_visit_members_after_status_change` trigger; if
    // we inserted with status='logged' directly, the trigger wouldn't fire
    // and the parent would never auto-resolve (so the
    // `group_visit_all_logged` fan-out would never happen in the all-
    // auto-linked edge case).
    const memberInsertRows = [
      {
        group_visit_id: gv.id,
        user_id: creatorId,
        [memberVisitCol]: creatorVisitId || null,
        tagged_by: creatorId,
        status: "pending",
      },
      ...(taggedMembers || []).map((m) => ({
        group_visit_id: gv.id,
        user_id: m.userId,
        [memberVisitCol]: m.visitId || null,
        tagged_by: creatorId,
        status: "pending",
        notified_at: new Date().toISOString(),
      })),
    ];

    const { error: memErr } = await client
      .from("group_visit_members")
      .insert(memberInsertRows);
    if (memErr) {
      console.warn("[BITE] createGroupVisit members:", memErr.message);
      return null;
    }

    // Flip creator to logged (always). Trigger runs after this UPDATE and
    // checks whether the parent can resolve yet.
    {
      const { error: cErr } = await client
        .from("group_visit_members")
        .update({ status: "logged" })
        .eq("group_visit_id", gv.id)
        .eq("user_id", creatorId);
      if (cErr) console.warn("[BITE] createGroupVisit flip creator:", cErr.message);
    }

    // Flip auto-linked tagged members to logged. Each UPDATE fires the
    // trigger once; the final one that clears the pending set also fans
    // out `group_visit_all_logged`.
    const autoLinked = (taggedMembers || []).filter((m) => m.status === "logged" && m.userId);
    if (autoLinked.length) {
      await Promise.all(autoLinked.map((m) => client
        .from("group_visit_members")
        .update({ status: "logged" })
        .eq("group_visit_id", gv.id)
        .eq("user_id", m.userId)
        .then(({ error: uErr }) => {
          if (uErr) console.warn("[BITE] createGroupVisit flip auto-linked:", uErr.message);
        })));
    }

    // Fire one group_visit_tagged notification per tagged member.
    await Promise.all((taggedMembers || []).map((m) => {
      const variant = NOTIFICATION_VARIANTS.has(m.variant) ? m.variant : "standard";
      const meta = {
        group_visit_id: gv.id,
        kind: k,
        place_id: placeId,
        restaurant_name: restaurantName || "",
        visited_at: visitedAt || null,
        variant,
        ...(m.visitId ? { auto_linked_visit_id: m.visitId } : {}),
        ...(m.candidateVisitIds?.length ? { candidate_visit_ids: m.candidateVisitIds } : {}),
      };
      return insertNotification(client, {
        userId: m.userId,
        fromUserId: creatorId,
        type: "group_visit_tagged",
        meta,
      });
    }));

    // Per-member `group_visit_logged` (creator ping when an auto-linked
    // member was already logged at create-time) was dropped 2026-05-04 —
    // the Postgres auto-resolve trigger now fans out a single
    // `group_visit_all_logged` notification to every member once the whole
    // party has logged. See `src/_archive/dine-tag-notifications.md`.

    return { id: gv.id, members: memberInsertRows };
  } catch (err) {
    console.warn("[BITE] createGroupVisit threw:", err);
    return null;
  }
}

/**
 * Tagged user logged their own visit and is joining an existing group_visit.
 * Updates their member row to status='logged' with the new visit_id (written
 * to the kind-appropriate column). Idempotent — repeat calls just re-write
 * the same status. When the status flip causes the parent to resolve, the
 * Postgres auto-resolve trigger fans out `group_visit_all_logged`
 * notifications to every member.
 *
 * `kind` is loaded from the group_visits row, not passed in — so the caller
 * doesn't need to know it ahead of time.
 */
export async function joinExistingGroupVisit(client, { groupVisitId, userId, visitId }) {
  if (!groupVisitId || !userId) return false;
  try {
    const [{ data: gv, error: gvErr }, { data: existing, error: loadErr }] = await Promise.all([
      client
        .from("group_visits")
        .select("created_by, kind, restaurant_place_id, cafe_place_id, restaurant_name")
        .eq("id", groupVisitId)
        .maybeSingle(),
      client
        .from("group_visit_members")
        .select("id, status, restaurant_visit_id, cafe_visit_id, group_visit_id")
        .eq("group_visit_id", groupVisitId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (gvErr || !gv) {
      console.warn("[BITE] joinExistingGroupVisit load gv:", gvErr?.message);
      return false;
    }
    if (loadErr) {
      console.warn("[BITE] joinExistingGroupVisit load member:", loadErr.message);
      return false;
    }
    if (!existing) {
      // RLS-friendly fallback: the user wasn't a member yet (unusual but
      // possible if the prompt was answered Yes from a manually-entered
      // place). The tagger is the only one allowed to insert, so we
      // can't add ourselves — fail soft.
      console.warn("[BITE] joinExistingGroupVisit: no member row for user", userId);
      return false;
    }
    const k = normalizeKind(gv.kind);
    const memberVisitCol = memberVisitColumnFor(k);

    const { error: updErr } = await client
      .from("group_visit_members")
      .update({
        status: "logged",
        [memberVisitCol]: visitId || existing[memberVisitCol] || null,
      })
      .eq("id", existing.id);
    if (updErr) {
      console.warn("[BITE] joinExistingGroupVisit update:", updErr.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[BITE] joinExistingGroupVisit threw:", err);
    return false;
  }
}

/**
 * Load a group visit + all members + each member's profile + creator profile.
 * Used by the notification tap handler to populate the prefill (members) and
 * the "Pick which visit was with @A?" sheet (visited_at + member status).
 */
export async function fetchGroupVisitWithMembers(client, groupVisitId) {
  if (!groupVisitId) return null;
  const { data, error } = await client
    .from("group_visits")
    .select(`${GROUP_VISIT_SELECT}, group_visit_members(${MEMBER_SELECT})`)
    .eq("id", groupVisitId)
    .maybeSingle();
  if (error) {
    console.warn("[BITE] fetchGroupVisitWithMembers:", error.message);
    return null;
  }
  if (!data) return null;

  const userIds = [
    data.created_by,
    ...(data.group_visit_members || []).map((m) => m.user_id),
  ].filter(Boolean);
  const uniq = [...new Set(userIds)];
  let profileMap = {};
  if (uniq.length) {
    const { data: profs } = await client
      .from("profiles")
      .select(PROFILE_FIELDS)
      .in("id", uniq);
    for (const p of profs || []) profileMap[p.id] = p;
  }

  return {
    id: data.id,
    createdBy: data.created_by,
    kind: normalizeKind(data.kind),
    placeId: data.restaurant_place_id || data.cafe_place_id,
    restaurantName: data.restaurant_name,
    visitedAt: data.visited_at,
    status: data.status,
    creatorProfile: profileMap[data.created_by] || null,
    members: (data.group_visit_members || []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      visitId: memberVisitId(m),
      status: m.status,
      taggedBy: m.tagged_by,
      profile: profileMap[m.user_id] || null,
    })),
  };
}

/**
 * Fetch a few specific restaurant_visits / cafe_visits (per kind) by id.
 * Used by the pick_visit sheet to show date options. Returns rows ordered
 * newest-first.
 */
export async function fetchVisitsByIds(client, { kind, visitIds }) {
  if (!visitIds?.length) return [];
  const k = normalizeKind(kind);
  const { data, error } = await client
    .from(visitsTableFor(k))
    .select("id, visited_at, place_id")
    .in("id", visitIds)
    .order("visited_at", { ascending: false });
  if (error) {
    console.warn("[BITE] fetchVisitsByIds:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fire-and-forget day-7 sweep. Runs on every notif-panel open. Cheap (three
 * predicate-bound UPDATEs) and idempotent — failures are logged, never thrown.
 * Kind-agnostic — the RPC sweeps both restaurant and cafe groups in one
 * transaction. The resolve-backstop pass also fans out
 * `group_visit_all_logged` notifications for any parents it resolves.
 */
export async function tickGroupVisitsExpiry(client) {
  try {
    const { error } = await client.rpc("tick_group_visits_expiry");
    if (error) console.warn("[BITE] tick_group_visits_expiry:", error.message);
  } catch (err) {
    console.warn("[BITE] tick_group_visits_expiry threw:", err);
  }
}

/**
 * After a fresh visit save, attach the new visit_id to any pending
 * group_visit_member rows for this user at the same place within ±30 days.
 *
 * This is the listening-window mechanism: when A tags B but B doesn't log
 * right away, the tag sits in `group_visit_members(status='pending')`. If B
 * eventually logs at the same place within the window, this attaches B's
 * new visit to the group_visit so the party-logged trigger can fire.
 *
 * Returns an array of group_visit_ids that got attached, or [] on
 * failure / no matches.
 */
export async function autoAttachVisitToGroupVisits(client, { userId, kind, placeId, visitedAt, visitId }) {
  if (!userId || !placeId || !visitId) return [];
  const k = normalizeKind(kind);
  try {
    const { data, error } = await client.rpc("auto_attach_visit_to_group_visits", {
      p_user_id: userId,
      p_kind: k,
      p_place_id: placeId,
      p_visited_at: visitedAt || new Date().toISOString(),
      p_visit_id: visitId,
    });
    if (error) {
      console.warn("[BITE] auto_attach_visit_to_group_visits:", error.message);
      return [];
    }
    return (data || []).map((r) => r.group_visit_id).filter(Boolean);
  } catch (err) {
    console.warn("[BITE] auto_attach_visit_to_group_visits threw:", err);
    return [];
  }
}

/**
 * Find expired group_visits the saver was a member of, at the same place
 * and within ±30 days of the new visit. Used to surface the retrospective
 * "Was this with @X on {date}?" prompt for saves that landed >7 days after
 * the original tag (which the day-7 sweep already marked expired/skipped).
 *
 * Returns one row per candidate with creator info fetched in a second
 * round-trip so the prompt can render "@{creatorUsername} on {date}".
 */
export async function findExpiredGroupVisitCandidates(client, { userId, kind, placeId, visitedAt }) {
  if (!userId || !placeId) return [];
  const k = normalizeKind(kind);
  try {
    const { data, error } = await client.rpc("find_expired_group_visit_candidates", {
      p_user_id: userId,
      p_kind: k,
      p_place_id: placeId,
      p_visited_at: visitedAt || new Date().toISOString(),
    });
    if (error) {
      console.warn("[BITE] find_expired_group_visit_candidates:", error.message);
      return [];
    }
    const rows = data || [];
    if (!rows.length) return [];
    const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
    let creatorMap = {};
    if (creatorIds.length) {
      const { data: profs } = await client
        .from("profiles")
        .select(PROFILE_FIELDS)
        .in("id", creatorIds);
      for (const p of profs || []) creatorMap[p.id] = p;
    }
    return rows.map((r) => ({
      groupVisitId: r.group_visit_id,
      createdBy: r.created_by,
      restaurantName: r.restaurant_name,
      visitedAt: r.visited_at,
      kind: r.kind,
      creatorProfile: creatorMap[r.created_by] || null,
    }));
  } catch (err) {
    console.warn("[BITE] find_expired_group_visit_candidates threw:", err);
    return [];
  }
}

// =============================================================================
// "Dined with" surface (Phase 2 of the dine_with_tags deprecation).
//
// These functions replace the legacy `dineWithApi.js` exports. They read
// from `group_visit_members` instead of `dine_with_tags`, but preserve the
// same return shapes so call sites can swap in incrementally.
//
// Backed by the v2 RPCs added in 20260526_consolidate_to_group_visit_members:
//   – fetch_co_diners_for_entries_v2 (batched)
//   – fetch_co_diners_v2             (single-entry, used by /add prefill)
//   – fetch_pending_tags_for_user    (/add banner data)
//   – count_pending_tags_for_user    (LogTab badge)
//
// Phase 5 drops the legacy `fetch_co_diners*` RPCs and the `_v2` suffix
// can be removed at that point if desired (purely cosmetic — the names are
// internal).
// =============================================================================

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Resolve "dined with" co-diner profiles for a batch of feed posts.
 *
 * Replaces the dine_with_tags-backed `fetchCoDinersForPosts` from feedApi.js.
 * The v2 RPC reads group_visit_members: for each entry_id, finds the
 * group_visit it's tied to (via the entry owner's member row) and returns
 * the OTHER members' profiles. Skipped members are excluded from the pill;
 * pending members are included so the pre-attach window keeps showing
 * tagged friends who haven't logged yet.
 *
 * `viewerId` is accepted for call-site symmetry but no longer forwarded —
 * we want viewers to appear in their own "dined with" pill when they were
 * tagged, so the RPC is invoked with no exclusion.
 *
 * Returns a Map keyed by `${kind}-${postId}` so the row component can do
 * an O(1) lookup against the same key it uses for React `key=`.
 *
 * Fails soft: returns an empty Map on any RPC error (the dined-with row
 * just won't render for affected posts).
 */
// eslint-disable-next-line no-unused-vars
export async function fetchCoDinersForPosts(client, posts, viewerId) {
  const out = new Map();
  if (!posts?.length) return out;
  const entryIds = posts.map((p) => p.id).filter(Boolean);
  if (!entryIds.length) return out;

  const { data, error } = await client.rpc("fetch_co_diners_for_entries_v2", {
    p_entry_ids: entryIds,
    p_exclude_id: NIL_UUID,
  });
  if (error) {
    console.warn("[BITE] fetchCoDinersForPosts (v2):", error.message);
    return out;
  }
  if (!data?.length) return out;

  // The RPC returns one row per (entry_id, tagged user). A single entry
  // could appear under multiple group_visits (in theory) so we dedupe on
  // (entry, user_id) into a Map<entry_id, Map<user_id, profile>>.
  const byEntry = new Map();
  for (const row of data) {
    if (!row?.entry_id || !row?.id) continue;
    if (!byEntry.has(row.entry_id)) byEntry.set(row.entry_id, new Map());
    byEntry.get(row.entry_id).set(row.id, {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    });
  }

  // Re-key by `${kind}-${postId}` for compatibility with the existing
  // FeedPostRow consumer.
  for (const post of posts) {
    if (!post?.id) continue;
    const profiles = byEntry.get(post.id);
    if (!profiles?.size) continue;
    const key = `${post.kind || "restaurant"}-${post.id}`;
    out.set(key, [...profiles.values()]);
  }
  return out;
}

/**
 * Build a Map<entryId, Profile[]> of co-diners for each of the user's visits.
 *
 * Replaces dineWithApi.fetchDinedWithByEntry. Single round-trip via the
 * batched v2 RPC over the user's own entry IDs (both restaurant + cafe).
 *
 * Loads the user's own restaurant_visits.id and cafe_visits.id, asks the
 * RPC for co-diners on each, and rolls them up. We pass the user's own id
 * as p_exclude_id so they don't appear in their own pill.
 */
export async function fetchDinedWithByEntry(client, userId) {
  if (!userId) return new Map();

  const [{ data: restRows, error: restErr }, { data: cafeRows, error: cafeErr }] = await Promise.all([
    client.from("restaurant_visits").select("id").eq("user_id", userId),
    client.from("cafe_visits").select("id").eq("user_id", userId),
  ]);
  if (restErr) console.warn("[BITE] fetchDinedWithByEntry rest ids:", restErr.message);
  if (cafeErr) console.warn("[BITE] fetchDinedWithByEntry cafe ids:", cafeErr.message);

  const entryIds = [
    ...((restRows || []).map((r) => r.id)),
    ...((cafeRows || []).map((r) => r.id)),
  ].filter(Boolean);
  if (!entryIds.length) return new Map();

  const { data, error } = await client.rpc("fetch_co_diners_for_entries_v2", {
    p_entry_ids: entryIds,
    p_exclude_id: userId,
  });
  if (error) {
    console.warn("[BITE] fetchDinedWithByEntry (v2):", error.message);
    return new Map();
  }

  const map = new Map();
  for (const row of data || []) {
    if (!row?.entry_id || !row?.id) continue;
    if (!map.has(row.entry_id)) map.set(row.entry_id, new Map());
    map.get(row.entry_id).set(row.id, {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    });
  }
  // Convert inner Maps to arrays for the consumer.
  const out = new Map();
  for (const [entryId, byId] of map) {
    if (byId.size) out.set(entryId, [...byId.values()]);
  }
  return out;
}

/**
 * Fetch profiles of everyone else dining with the entry owner on a given
 * entry. Used by /add prefill (applyDineTagPrefill in App.jsx) to seed the
 * dine-with picker with the rest of the party.
 *
 * Replaces dineWithApi.fetchCoDiners. The taggerId argument is ignored
 * (kept for call-site signature symmetry during Phase 2 → Phase 3
 * transition); the v2 RPC infers the canonical party from the
 * group_visit_members row tied to the entry.
 */
// eslint-disable-next-line no-unused-vars
export async function fetchCoDiners(client, { taggerId, entryId, excludeUserId }) {
  if (!entryId) return [];
  const { data, error } = await client.rpc("fetch_co_diners_v2", {
    p_entry_id: entryId,
    p_exclude_id: excludeUserId || null,
  });
  if (error) {
    console.warn("[BITE] fetchCoDiners (v2):", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch all pending tag prompts for a user. Powers the /add banner.
 *
 * Replaces dineWithApi.fetchUnloggedDineTags. Returns one row per pending
 * group_visit_members row the user has, hydrated with the tagger's profile
 * + the parent group_visit's display fields. Filters to status='pending'
 * on both the member row AND the parent (so expired/resolved groups don't
 * show up — they're handled by the retroactive prompt instead).
 *
 * Return shape mirrors the legacy fetchUnloggedDineTags shape so the
 * DineTagsBanner consumer doesn't need prop changes:
 *   { id (= member_id), entry_id (= null), entry_type, tagger_id,
 *     tagged_id, restaurant_name, city, cuisine, dismissed (= false),
 *     taggerProfile, visited_at }
 *
 * `cuisine` is no longer carried — group_visits doesn't store it. Banner
 * already handles missing cuisine gracefully (falls through to a places
 * lookup at prefill time via applyDineTagPrefill).
 */
export async function fetchUnloggedDineTags(client, userId) {
  if (!userId) return [];
  const { data, error } = await client.rpc("fetch_pending_tags_for_user", {
    p_user_id: userId,
  });
  if (error) {
    console.warn("[BITE] fetchUnloggedDineTags (v2):", error.message);
    return [];
  }
  return (data || []).map((row) => ({
    // `id` carries the member_id so dismissTag can target the right row.
    id: row.member_id,
    member_id: row.member_id,
    group_visit_id: row.group_visit_id,
    entry_id: null,
    entry_type: row.kind === "cafe" ? "cafe" : "restaurant",
    tagger_id: row.tagger_id,
    tagged_id: userId,
    restaurant_name: row.restaurant_name,
    city: row.city || "",
    cuisine: "",
    dismissed: false,
    visited_at: row.visited_at,
    taggerProfile: row.tagger_id
      ? {
          id: row.tagger_id,
          username: row.tagger_username,
          display_name: row.tagger_display_name,
          avatar_url: row.tagger_avatar_url,
        }
      : null,
  }));
}

/**
 * Count pending tag prompts for the LogTab badge.
 *
 * Replaces dineWithApi.countUnloggedDineTags.
 */
export async function countUnloggedDineTags(client, userId) {
  if (!userId) return 0;
  const { data, error } = await client.rpc("count_pending_tags_for_user", {
    p_user_id: userId,
  });
  if (error) {
    console.warn("[BITE] countUnloggedDineTags (v2):", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

/**
 * Dismiss a pending tag — flips the user's group_visit_members row to
 * status='skipped'. RLS already permits `auth.uid() = user_id` updates.
 *
 * Replaces dineWithApi.dismissDineTag. Banner consumers pass either the
 * member_id directly or the legacy `tag.id` (which we re-aliased to
 * member_id in fetchUnloggedDineTags above), so this works in both shapes.
 */
export async function dismissDineTag(client, memberId) {
  if (!memberId) return;
  const { error } = await client
    .from("group_visit_members")
    .update({ status: "skipped" })
    .eq("id", memberId);
  if (error) console.warn("[BITE] dismissDineTag (v2):", error.message);
}

/**
 * Hard-delete the recipient's `group_visit_tagged` notification for a
 * given group_visit. Companion to any code path that resolves a pending
 * member row (banner Dismiss/Tag-to-entry, notif inline "Tag to my entry
 * ✓", any explicit tag-back) so the bell badge decrements alongside the
 * banner.
 *
 * Auto-attach (server-side) cleans up notifs inline inside the
 * `auto_attach_visit_to_group_visits` SECURITY DEFINER RPC — see
 * 20260528 migration. This client helper is for the user-initiated paths.
 *
 * Requires the DELETE policy from 20260528 (recipient = auth.uid() = user_id).
 * No-op if either argument is missing.
 */
export async function resolveGroupVisitTaggedNotif(client, { userId, groupVisitId }) {
  if (!userId || !groupVisitId) return;
  const { error } = await client
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .eq("type", "group_visit_tagged")
    .eq("meta->>group_visit_id", groupVisitId);
  if (error) console.warn("[BITE] resolveGroupVisitTaggedNotif:", error.message);
}

/**
 * Edit-time sync of `group_visit_members` to match the new dine-with picker.
 *
 * Phase 4 of the dine_with_tags deprecation
 * (20260526_consolidate_to_group_visit_members). The save flow has always
 * propagated tag changes via createGroupVisit at create-time; this helper
 * is the equivalent for edits.
 *
 * Behavior (see plan: cafe-group-backfill-cleanup → deprecate-dine-with-tags):
 *
 *   1. Look up the group_visit via `<kind>_visit_id = entryId` joined to the
 *      editor's member row (the entry's owner). Three cases:
 *        a. No group exists AND addedUserIds non-empty → fall through to
 *           createGroupVisit (a fresh group, even if visitedAt is old).
 *        b. Group exists, status='pending' → continue to step 2.
 *        c. Group exists, status='expired' or 'resolved' AND editor is
 *           creator AND addedUserIds non-empty → un-expire (pending,
 *           resolved_at=null), then continue.
 *
 *   2. Visit-date propagation (any editor, regardless of creator):
 *      if entry's visited_at differs from parent's, UPDATE parent to match.
 *      Last writer wins. Decoupled from member ownership so non-creators
 *      can still keep the day-7 expiry clock honest by fixing the date.
 *
 *   3. Member-mutation guard: if editor is NOT gv.created_by, skip
 *      member adds/removes. Non-creator can still flip own status via
 *      dismissDineTag / joinExistingGroupVisit elsewhere.
 *
 *   4. For each removedUserIds (creator only):
 *        - DELETE group_visit_members WHERE group_visit_id, user_id, and
 *          tagged_by = editor (RLS gates by tagged_by; our app guard above
 *          is defense-in-depth).
 *        - DELETE notifications WHERE user_id = X, type='group_visit_tagged',
 *          meta.group_visit_id = gv.id (hard-delete the bell ping; UX call:
 *          stale notifs lead to silent no-op join taps).
 *      The AFTER DELETE trigger (Phase 1) handles auto-resolve fan-out.
 *
 *   5. For each addedUserIds (creator only):
 *        - findAlreadyLoggedMatch to pick variant (standard/auto_linked/pick_visit).
 *        - Upsert member row ON CONFLICT (group_visit_id, user_id) so re-adding
 *          someone previously removed/skipped works cleanly.
 *        - If variant=auto_linked, follow up with status='logged' + visit_id
 *          (the AFTER UPDATE trigger may fire group_visit_all_logged if this
 *          fills the last pending slot — same as create-time).
 *        - INSERT one group_visit_tagged notification.
 */
export async function syncGroupVisitMembersOnEdit(client, {
  kind,
  entryId,
  editorId,
  placeId,
  visitedAt,
  addedUserIds,
  removedUserIds,
}) {
  if (!entryId || !editorId) return;
  const k = normalizeKind(kind);
  const memberVisitCol = memberVisitColumnFor(k);
  const placeCol = placeColumnFor(k);
  const adds = (addedUserIds || []).filter(Boolean).filter((id) => id !== editorId);
  const removes = (removedUserIds || []).filter(Boolean).filter((id) => id !== editorId);

  try {
    // 1. Find the editor's member row tied to this entry, hydrate the parent.
    const { data: editorRows, error: editorErr } = await client
      .from("group_visit_members")
      .select(`group_visit_id, group_visits(${GROUP_VISIT_SELECT})`)
      .eq("user_id", editorId)
      .eq(memberVisitCol, entryId);
    if (editorErr) {
      console.warn("[BITE] syncGroupVisitMembersOnEdit lookup:", editorErr.message);
      return;
    }
    const editorRow = (editorRows || [])[0];
    const gv = editorRow?.group_visits || null;

    // 1a. No group exists yet — auto-create if there are adds to make.
    if (!gv) {
      if (!adds.length || !placeId) return;
      // findAlreadyLoggedMatch lets createGroupVisit pick variants per friend
      // exactly as it does at original-save time.
      const taggedMembers = await Promise.all(adds.map(async (userId) => {
        const matches = await findAlreadyLoggedMatch(client, {
          kind: k, userId, placeId, visitedAt,
        });
        let variant = "standard";
        let visitId;
        let candidateVisitIds;
        if (matches.length === 1) {
          variant = "auto_linked";
          visitId = matches[0].id;
        } else if (matches.length >= 2) {
          variant = "pick_visit";
          candidateVisitIds = matches.map((m) => m.id);
        }
        return {
          userId, variant,
          status: variant === "auto_linked" ? "logged" : "pending",
          ...(visitId ? { visitId } : {}),
          ...(candidateVisitIds ? { candidateVisitIds } : {}),
        };
      }));
      await createGroupVisit(client, {
        kind: k, creatorId: editorId, placeId,
        restaurantName: "",
        visitedAt: visitedAt || new Date().toISOString(),
        creatorVisitId: entryId,
        taggedMembers,
      });
      return;
    }

    // 2. Visit-date propagation. Any editor can keep the parent's clock
    //    aligned with their own entry's date. Last writer wins.
    if (visitedAt && gv.visited_at !== visitedAt) {
      const { error: dateErr } = await client
        .from("group_visits")
        .update({ visited_at: visitedAt })
        .eq("id", gv.id);
      if (dateErr) console.warn("[BITE] syncGroupVisitMembersOnEdit date:", dateErr.message);
    }

    // 3. Member-mutation guard. Only the original creator mutates the guest
    //    list. Non-creators can still flip their own status elsewhere.
    if (gv.created_by !== editorId) return;

    // 1c. Un-expire on creator-add against an expired/resolved parent.
    if ((gv.status === "expired" || gv.status === "resolved") && adds.length) {
      const { error: unexpErr } = await client
        .from("group_visits")
        .update({ status: "pending", resolved_at: null })
        .eq("id", gv.id);
      if (unexpErr) console.warn("[BITE] syncGroupVisitMembersOnEdit unexpire:", unexpErr.message);
    } else if (gv.status !== "pending" && !adds.length) {
      // Group is dormant and we have no adds to make — nothing to do.
      return;
    }

    // 4. Removes. RLS gates DELETE by tagged_by = auth.uid(); our app guard
    //    in step 3 already restricted us to creator-edits, so the canonical
    //    creator-tagged rows match. Anyone other-tagged stays put.
    if (removes.length) {
      await Promise.all(removes.map(async (userId) => {
        const { error: delMemErr } = await client
          .from("group_visit_members")
          .delete()
          .eq("group_visit_id", gv.id)
          .eq("user_id", userId)
          .eq("tagged_by", editorId);
        if (delMemErr) {
          console.warn("[BITE] syncGroupVisitMembersOnEdit delete member:", delMemErr.message);
        }
        // Hard-delete the bell ping at the same time. Stale group_visit_tagged
        // notifs lead to silent no-op joins (the join no-ops because there's
        // no member row left). meta->>group_visit_id is the precise filter.
        const { error: delNotErr } = await client
          .from("notifications")
          .delete()
          .eq("user_id", userId)
          .eq("type", "group_visit_tagged")
          .eq("meta->>group_visit_id", gv.id);
        if (delNotErr) {
          console.warn("[BITE] syncGroupVisitMembersOnEdit delete notif:", delNotErr.message);
        }
      }));
    }

    // 5. Adds.
    if (adds.length) {
      await Promise.all(adds.map(async (userId) => {
        // 5a. Variant detection mirrors createGroupVisit at create-time.
        const matches = await findAlreadyLoggedMatch(client, {
          kind: k, userId, placeId, visitedAt: visitedAt || gv.visited_at,
        });
        let variant = "standard";
        let matchedVisitId = null;
        let candidateVisitIds = null;
        if (matches.length === 1) {
          variant = "auto_linked";
          matchedVisitId = matches[0].id;
        } else if (matches.length >= 2) {
          variant = "pick_visit";
          candidateVisitIds = matches.map((m) => m.id);
        }

        // 5b. Upsert the member row. ON CONFLICT (group_visit_id, user_id)
        //     resets status='pending', tagged_by=editor, notified_at=now()
        //     so re-adding a previously-removed/skipped user works cleanly.
        const { error: upsertErr } = await client
          .from("group_visit_members")
          .upsert({
            group_visit_id: gv.id,
            user_id: userId,
            tagged_by: editorId,
            status: "pending",
            notified_at: new Date().toISOString(),
            // Don't pre-set visit_id here; the auto-link UPDATE below
            // handles that (and it's status='pending' until then anyway).
          }, { onConflict: "group_visit_id,user_id" });
        if (upsertErr) {
          console.warn("[BITE] syncGroupVisitMembersOnEdit upsert member:", upsertErr.message);
          return;
        }

        // 5c. Auto-link follow-up flips status to 'logged' + attaches the
        //     matched visit_id. The AFTER UPDATE trigger may fire
        //     group_visit_all_logged here if this fills the last pending slot.
        if (variant === "auto_linked" && matchedVisitId) {
          const { error: linkErr } = await client
            .from("group_visit_members")
            .update({ status: "logged", [memberVisitCol]: matchedVisitId })
            .eq("group_visit_id", gv.id)
            .eq("user_id", userId);
          if (linkErr) {
            console.warn("[BITE] syncGroupVisitMembersOnEdit auto-link:", linkErr.message);
          }
        }

        // 5d. One group_visit_tagged notif per added user. Meta shape
        //     mirrors createGroupVisit lines 291-308.
        const meta = {
          group_visit_id: gv.id,
          kind: gv.kind,
          place_id: gv[placeCol] || placeId,
          restaurant_name: gv.restaurant_name || "",
          visited_at: visitedAt || gv.visited_at,
          variant,
          ...(matchedVisitId ? { auto_linked_visit_id: matchedVisitId } : {}),
          ...(candidateVisitIds?.length ? { candidate_visit_ids: candidateVisitIds } : {}),
        };
        await insertNotification(client, {
          userId,
          fromUserId: editorId,
          type: "group_visit_tagged",
          meta,
        });
      }));
    }
  } catch (err) {
    console.warn("[BITE] syncGroupVisitMembersOnEdit threw:", err);
  }
}
