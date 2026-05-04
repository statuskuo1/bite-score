/**
 * Group visits API over `public.group_visits` and `public.group_visit_members`.
 *
 * Group visits coordinate the "we all ate dinner together — log it" flow:
 *   1. User A saves a visit with tagged friends → createGroupVisit(...) inserts
 *      one parent row + one member row per tagger/tagged user + one
 *      `group_visit_tagged` notification per tagged friend (variant chosen
 *      per-friend based on whether they already have a matching visit).
 *   2. A tagged friend B taps the notification → applyGroupVisitPrefill() in
 *      App.jsx loads the group + members and prefills the Add form. On save,
 *      App.jsx detects an active addGroupVisitId and calls
 *      joinExistingGroupVisit(...) instead of createGroupVisit(...).
 *   3. Auto-resolve: when every member transitions to logged/skipped, a
 *      Postgres trigger flips the parent to status='resolved'.
 *   4. Day-7 expiry: tick_group_visits_expiry() runs on every notif-panel
 *      open and skips/expires stale rows.
 *
 * Group visits LAYER ON TOP of `dine_with_tags`; they do not replace co-diner
 * tags. The save flow continues to call `insertDineTag(...)` for each tagged
 * friend so feed cards keep rendering "dined with …" via the existing
 * `fetch_co_diners_for_entries` RPC.
 *
 * Phase 2 (`20260523_group_visits_cafes.sql`) extends this to cafes (drinks +
 * sweets). Each function takes a `kind: 'restaurant' | 'cafe'` parameter that
 * picks the right place table (`restaurant_places` / `cafe_places`) and the
 * right visit table (`restaurant_visits` / `cafe_visits`). On the parent
 * `group_visits` row, kind is stored explicitly and the FK is split into
 * `restaurant_place_id` / `cafe_place_id`; the same split applies to
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
  if (error) console.warn(`[BITE] insertNotification(${type}):`, error.message);
}

/**
 * Create a new group visit with the creator + tagged members. Caller is
 * expected to have already decided per-member variant + status (see App.jsx
 * save flow): `taggedMembers` is a list of
 *   { userId, variant, status, visitId?, candidateVisitIds? }
 *
 * `variant` is one of 'standard' | 'auto_linked' | 'pick_visit'. Notifications
 * fire one per tagged member; the creator does not get a notification on
 * create (only on member-logged events later).
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

    const memberRows = [
      // Creator — already logged at the moment of save.
      {
        group_visit_id: gv.id,
        user_id: creatorId,
        [memberVisitCol]: creatorVisitId || null,
        tagged_by: creatorId,
        status: "logged",
      },
      ...(taggedMembers || []).map((m) => ({
        group_visit_id: gv.id,
        user_id: m.userId,
        [memberVisitCol]: m.visitId || null,
        tagged_by: creatorId,
        status: m.status === "logged" ? "logged" : "pending",
        notified_at: new Date().toISOString(),
      })),
    ];

    const { error: memErr } = await client
      .from("group_visit_members")
      .insert(memberRows);
    if (memErr) {
      console.warn("[BITE] createGroupVisit members:", memErr.message);
      return null;
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

    // For auto-linked members, also notify the creator that B "logged" their
    // visit (which is exactly what auto-link is — no further action required).
    await Promise.all((taggedMembers || [])
      .filter((m) => m.status === "logged" && m.visitId)
      .map((m) => insertNotification(client, {
        userId: creatorId,
        fromUserId: m.userId,
        type: "group_visit_logged",
        meta: {
          group_visit_id: gv.id,
          kind: k,
          place_id: placeId,
          restaurant_name: restaurantName || "",
          entry_id: m.visitId,
          entry_type: k,
        },
      })));

    return { id: gv.id, members: memberRows };
  } catch (err) {
    console.warn("[BITE] createGroupVisit threw:", err);
    return null;
  }
}

/**
 * Tagged user logged their own visit and is joining an existing group_visit.
 * Updates their member row to status='logged' with the new visit_id (written
 * to the kind-appropriate column) and notifies the creator. Idempotent —
 * repeat calls just re-write the same status and skip the notification if no
 * row was actually flipped.
 *
 * `kind` is loaded from the group_visits row, not passed in — so the caller
 * doesn't need to know it ahead of time.
 */
export async function joinExistingGroupVisit(client, { groupVisitId, userId, visitId }) {
  if (!groupVisitId || !userId) return false;
  try {
    // Load the parent so we know which visit column to write into, plus the
    // member row so we know whether this is a real transition (we only want
    // to fire group_visit_logged the first time).
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
    const wasPending = existing.status === "pending";
    const placeId = gv.restaurant_place_id || gv.cafe_place_id;

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

    if (wasPending) {
      // Notify the creator.
      if (gv.created_by) {
        await insertNotification(client, {
          userId: gv.created_by,
          fromUserId: userId,
          type: "group_visit_logged",
          meta: {
            group_visit_id: groupVisitId,
            kind: k,
            place_id: placeId,
            restaurant_name: gv.restaurant_name || "",
            entry_id: visitId || null,
            entry_type: k,
          },
        });
      }
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
 * transaction.
 */
export async function tickGroupVisitsExpiry(client) {
  try {
    const { error } = await client.rpc("tick_group_visits_expiry");
    if (error) console.warn("[BITE] tick_group_visits_expiry:", error.message);
  } catch (err) {
    console.warn("[BITE] tick_group_visits_expiry threw:", err);
  }
}
