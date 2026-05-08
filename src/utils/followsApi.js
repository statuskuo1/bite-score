import posthog from "../config/posthog.js";

/**
 * Follows + Taste Buds API over `public.follows`.
 *
 * Model:
 *   - Follow is one-way: A follows B → one row (follower_id=A, following_id=B).
 *   - Taste Buds = mutual follows (both rows exist).
 *   - No pending state, no acceptance step.
 *
 * RLS (see migration):
 *   - SELECT  : either party
 *   - INSERT  : follower_id = auth.uid()
 *   - DELETE  : follower_id = auth.uid() (you can only unfollow)
 */

// ── Search (unchanged from friendsApi) ────────────────────────────────────────

/**
 * Case-insensitive prefix match on `profiles.username`, excludes caller.
 * @returns {Array<{id, username, display_name, avatar_url}>}
 */
export async function searchUsersByUsername(client, query, callerId, limit = 8) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return [];
  // Escape LIKE special chars in user input before interpolating into .or()
  const esc = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.${esc}%,display_name.ilike.${esc}%`)
    .neq("id", callerId)
    .limit(limit);
  if (error) {
    console.warn("[BITE] searchUsersByUsername error:", error);
    return [];
  }
  return data || [];
}

// ── Follow / Unfollow ─────────────────────────────────────────────────────────

/**
 * Follow a user. Returns `{ ok, code, data }`.
 * Codes: `self` | `already_following` | `network` | `ok`
 */
export async function followUser(client, followerId, followingId) {
  if (followerId === followingId) return { ok: false, code: "self" };

  // Check if already following.
  const { data: existing } = await client
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (existing) return { ok: false, code: "already_following" };

  const { data, error } = await client
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId })
    .select()
    .single();

  if (error) {
    // 23505 = unique violation → already following (race condition).
    if (error.code === "23505") return { ok: false, code: "already_following" };
    console.warn("[BITE] followUser error:", error);
    return { ok: false, code: "network" };
  }

  // Notifications are handled by the on_follow_created DB trigger (SECURITY DEFINER).
  // We only query for the reverse follow here to return isMutual for the UI.
  const { data: reverse } = await client
    .from("follows")
    .select("id")
    .eq("follower_id", followingId)
    .eq("following_id", followerId)
    .maybeSingle();

  posthog.capture("user followed", { is_mutual: !!reverse });
  return { ok: true, code: "ok", data, isMutual: !!reverse };
}

/**
 * Unfollow a user. Deletes the follow row where I am the follower.
 * If we were Taste Buds, this breaks the mutual — they still follow me,
 * but we're no longer Taste Buds.
 */
export async function unfollowUser(client, followerId, followingId) {
  const { error } = await client
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  if (error) {
    console.warn("[BITE] unfollowUser error:", error);
    return { ok: false };
  }
  posthog.capture("user unfollowed");
  return { ok: true };
}

// ── Relationship queries ──────────────────────────────────────────────────────

/**
 * Check the relationship between two users.
 * @returns {"none" | "i_follow" | "they_follow" | "taste_buds"}
 */
export async function getRelation(client, myId, theirId) {
  if (myId === theirId) return "self";

  const { data: rows } = await client
    .from("follows")
    .select("follower_id, following_id")
    .or(
      `and(follower_id.eq.${myId},following_id.eq.${theirId}),and(follower_id.eq.${theirId},following_id.eq.${myId})`
    );

  const iFollow = (rows || []).some((r) => r.follower_id === myId && r.following_id === theirId);
  const theyFollow = (rows || []).some((r) => r.follower_id === theirId && r.following_id === myId);

  if (iFollow && theyFollow) return "taste_buds";
  if (iFollow) return "i_follow";
  if (theyFollow) return "they_follow";
  return "none";
}

// ── Helpers: load profiles by IDs ─────────────────────────────────────────────

async function loadProfilesByIds(client, ids) {
  if (!ids.length) return {};
  const { data } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url, pref_weight_taste, pref_weight_bpb, pref_weight_wait")
    .in("id", ids);
  const map = {};
  for (const p of data || []) map[p.id] = p;
  return map;
}

// ── List follows ──────────────────────────────────────────────────────────────

/**
 * Returns `{ following, followers, tasteBuds }` — each entry hydrated with
 * the other user's profile.
 *
 * Shape of each item:
 *   { id, oderId, otherProfile, createdAt, isMutual }
 */
export async function listFollows(client, userId) {
  const empty = { following: [], followers: [], tasteBuds: [] };
  if (!userId) return empty;

  // Fetch all follow edges involving this user.
  const { data: rows, error } = await client
    .from("follows")
    .select("id, follower_id, following_id, created_at")
    .or(`follower_id.eq.${userId},following_id.eq.${userId}`);

  if (error) {
    console.warn("[BITE] listFollows error:", error);
    return empty;
  }
  if (!rows?.length) return empty;

  // Collect all other-user IDs for profile hydration.
  const otherIds = new Set();
  for (const r of rows) {
    if (r.follower_id === userId) otherIds.add(r.following_id);
    if (r.following_id === userId) otherIds.add(r.follower_id);
  }
  const profiles = await loadProfilesByIds(client, [...otherIds]);

  // Build sets for mutual detection.
  const iFollowSet = new Set();
  const theyFollowSet = new Set();
  for (const r of rows) {
    if (r.follower_id === userId) iFollowSet.add(r.following_id);
    if (r.following_id === userId) theyFollowSet.add(r.follower_id);
  }

  const following = [];
  const followers = [];
  const tasteBuds = [];

  // People I follow.
  for (const r of rows) {
    if (r.follower_id !== userId) continue;
    const otherId = r.following_id;
    const isMutual = theyFollowSet.has(otherId);
    const entry = {
      id: r.id,
      otherUserId: otherId,
      otherProfile: profiles[otherId] || null,
      createdAt: r.created_at,
      isMutual,
    };
    following.push(entry);
    if (isMutual) tasteBuds.push(entry);
  }

  // People who follow me (but I don't follow back).
  for (const r of rows) {
    if (r.following_id !== userId) continue;
    const otherId = r.follower_id;
    const isMutual = iFollowSet.has(otherId);
    followers.push({
      id: r.id,
      otherUserId: otherId,
      otherProfile: profiles[otherId] || null,
      createdAt: r.created_at,
      isMutual,
    });
  }

  return { following, followers, tasteBuds };
}

/**
 * Convenience: just the Taste Buds (mutual follows), hydrated.
 */
export async function listTasteBuds(client, userId) {
  const { tasteBuds } = await listFollows(client, userId);
  return tasteBuds;
}

/**
 * Returns a Set of user IDs that are currently following `userId`.
 * Lightweight — selects only `follower_id`, no profile hydration.
 */
export async function fetchFollowerIds(client, userId) {
  if (!userId) return new Set();
  const { data, error } = await client
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId);
  if (error) {
    console.warn("[BITE] fetchFollowerIds error:", error);
    return new Set();
  }
  return new Set((data || []).map((r) => r.follower_id));
}

/**
 * Returns a Set of user IDs that `userId` is currently following.
 * Lightweight — selects only `following_id`, no profile hydration.
 */
export async function fetchFollowingIds(client, userId) {
  if (!userId) return new Set();
  const { data, error } = await client
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (error) {
    console.warn("[BITE] fetchFollowingIds error:", error);
    return new Set();
  }
  return new Set((data || []).map((r) => r.following_id));
}

// ── Unseen-followers badge ───────────────────────────────────────────────────

/** New Followers expiry window (also used by the FriendsTab list filter so the
 *  badge count and visible rows always agree). */
export const NEW_FOLLOWERS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Count follows arriving AFTER `profiles.followers_last_seen_at`, ignoring
 * anything older than the New Followers window so the badge can't stay sticky
 * on dormant accounts. Returns 0 on any failure so a transient network blip
 * never produces a phantom badge.
 */
export async function countUnseenFollowers(client, userId) {
  if (!userId) return 0;

  const { data: profile, error: profileErr } = await client
    .from("profiles")
    .select("followers_last_seen_at")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) {
    console.warn("[BITE] countUnseenFollowers profile error:", profileErr);
    return 0;
  }
  const seenAt = profile?.followers_last_seen_at;
  const sevenDaysAgo = new Date(Date.now() - NEW_FOLLOWERS_WINDOW_MS).toISOString();

  let q = client
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", userId)
    .gt("created_at", sevenDaysAgo);
  // Without a recorded timestamp (shouldn't happen post-migration, but defend
  // anyway) fall back to "every follow inside the window is unseen" rather
  // than swallowing rows.
  if (seenAt) q = q.gt("created_at", seenAt);

  const { count, error } = await q;
  if (error) {
    console.warn("[BITE] countUnseenFollowers error:", error);
    return 0;
  }
  return count || 0;
}

/**
 * Stamp `followers_last_seen_at = now()` for the caller. Called when the
 * Friends sub-tab opens; clears the badge.
 */
export async function markFollowersSeen(client, userId) {
  if (!userId) return { ok: false };
  const { error } = await client
    .from("profiles")
    .update({ followers_last_seen_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    console.warn("[BITE] markFollowersSeen error:", error);
    return { ok: false };
  }
  return { ok: true };
}
