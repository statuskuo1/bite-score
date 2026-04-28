/**
 * Friends graph CRUD over `public.friendships`.
 *
 * RLS (see `20260428_social_friends_groups.sql`):
 *   - SELECT  : either party
 *   - INSERT  : `requester_id = auth.uid()`
 *   - UPDATE  : `addressee_id = auth.uid()` (accept)
 *   - DELETE  : either party (decline / cancel / unfriend)
 *
 * The unique pair index on `least(req,addr), greatest(req,addr)` means we
 * never need to worry about reciprocal-duplicate rows; a 23505 from a fresh
 * insert means a row already exists in either direction.
 */

const PROFILE_FIELDS = "id, username, display_name, avatar_url";

/** Username search by case-insensitive prefix. Returns up to `limit` profiles,
 *  excluding the caller. Empty string returns []. */
export async function searchUsersByUsername(client, query, callerId, limit = 8) {
  const q = String(query ?? "").trim().toLowerCase();
  if (q.length < 1) return [];
  let req = client
    .from("profiles")
    .select(PROFILE_FIELDS)
    .ilike("username", `${q}%`)
    .order("username", { ascending: true })
    .limit(limit);
  if (callerId) req = req.neq("id", callerId);
  const { data, error } = await req;
  if (error) {
    console.warn("[BITE] searchUsersByUsername:", error.message);
    return [];
  }
  return data || [];
}

/** Find an existing friendship row in either direction between two users. */
export async function findFriendshipBetween(client, a, b) {
  if (!a || !b) return null;
  const { data, error } = await client
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`
    )
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[BITE] findFriendshipBetween:", error.message);
    return null;
  }
  return data;
}

export async function sendFriendRequest(client, requesterId, addresseeId) {
  if (!requesterId || !addresseeId) return { ok: false, code: "invalid", data: null };
  if (requesterId === addresseeId) return { ok: false, code: "self", data: null };

  const existing = await findFriendshipBetween(client, requesterId, addresseeId);
  if (existing) {
    if (existing.status === "accepted") return { ok: false, code: "already_friends", data: existing };
    return { ok: false, code: "already_pending", data: existing };
  }

  const { data, error } = await client
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: "pending" })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, code: "already_pending", data: null };
    console.warn("[BITE] sendFriendRequest:", error.message);
    return { ok: false, code: "network", data: null };
  }
  return { ok: true, code: null, data };
}

export async function acceptFriendRequest(client, friendshipId) {
  const { data, error } = await client
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[BITE] acceptFriendRequest:", error.message);
    return { ok: false, code: "network", data: null };
  }
  return { ok: true, code: null, data };
}

/** Decline incoming OR cancel outgoing OR unfriend — DELETE policy permits both. */
export async function deleteFriendship(client, friendshipId) {
  const { error } = await client.from("friendships").delete().eq("id", friendshipId);
  if (error) {
    console.warn("[BITE] deleteFriendship:", error.message);
    return { ok: false, code: "network" };
  }
  return { ok: true, code: null };
}

/** Hydrate a friendships row with the *other party's* profile, given which side `me` is on. */
function attachOtherParty(rows, profilesById, me) {
  return (rows || []).map((row) => {
    const otherId = row.requester_id === me ? row.addressee_id : row.requester_id;
    return {
      ...row,
      direction: row.requester_id === me ? "outgoing" : "incoming",
      otherUserId: otherId,
      otherProfile: profilesById[otherId] || null,
    };
  });
}

async function loadProfilesByIds(client, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await client.from("profiles").select(PROFILE_FIELDS).in("id", unique);
  if (error) {
    console.warn("[BITE] loadProfilesByIds:", error.message);
    return {};
  }
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

/**
 * Returns `{ friends, incoming, outgoing }` — all hydrated with the other
 * party's profile in `otherProfile` for direct rendering.
 */
export async function listFriendships(client, userId) {
  if (!userId) return { friends: [], incoming: [], outgoing: [] };
  const { data, error } = await client
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[BITE] listFriendships:", error.message);
    return { friends: [], incoming: [], outgoing: [] };
  }
  const rows = data || [];
  const otherIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  const profilesById = await loadProfilesByIds(client, otherIds);
  const hydrated = attachOtherParty(rows, profilesById, userId);
  return {
    friends: hydrated.filter((r) => r.status === "accepted"),
    incoming: hydrated.filter((r) => r.status === "pending" && r.direction === "incoming"),
    outgoing: hydrated.filter((r) => r.status === "pending" && r.direction === "outgoing"),
  };
}
