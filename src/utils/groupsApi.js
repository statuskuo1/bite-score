/**
 * Groups CRUD over `public.groups` + `public.group_members`.
 *
 * RLS (see `20260428_social_friends_groups.sql`):
 *   - groups SELECT     : owner OR group member (via security-definer helper)
 *   - groups INSERT     : `owner_id = auth.uid()`
 *   - members INSERT    : group owner inviting self OR an accepted friend
 *   - members DELETE    : self (leave) OR group owner removing
 */

const PROFILE_FIELDS = "id, username, display_name, avatar_url";
const GROUP_SOFT_CAP = 20;

export const SOFT_CAP = GROUP_SOFT_CAP;

/**
 * Create a group and seed `group_members` with the owner. Both writes are
 * gated by RLS (groups_insert_owner_self + group_members_insert_owner_invites_friend
 * which permits self-add).
 */
export async function createGroup(client, ownerId, name) {
  if (!ownerId) return { ok: false, code: "auth", data: null };
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, code: "name_required", data: null };

  const { data: group, error: insErr } = await client
    .from("groups")
    .insert({ owner_id: ownerId, name: trimmed.slice(0, 80) })
    .select("*")
    .single();
  if (insErr) {
    console.warn("[BITE] createGroup:", insErr.message);
    return { ok: false, code: "network", data: null };
  }

  const { error: memErr } = await client
    .from("group_members")
    .insert({ group_id: group.id, user_id: ownerId });
  if (memErr) {
    console.warn("[BITE] createGroup self-add:", memErr.message);
  }
  return { ok: true, code: null, data: group };
}

export async function renameGroup(client, groupId, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, code: "name_required" };
  const { error } = await client
    .from("groups")
    .update({ name: trimmed.slice(0, 80) })
    .eq("id", groupId);
  if (error) {
    console.warn("[BITE] renameGroup:", error.message);
    return { ok: false, code: "network" };
  }
  return { ok: true, code: null };
}

export async function deleteGroup(client, groupId) {
  const { error } = await client.from("groups").delete().eq("id", groupId);
  if (error) {
    console.warn("[BITE] deleteGroup:", error.message);
    return { ok: false, code: "network" };
  }
  return { ok: true, code: null };
}

/** Groups visible to the caller (owner or member, enforced by RLS). */
export async function listMyGroups(client, userId) {
  if (!userId) return [];
  const { data, error } = await client
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[BITE] listMyGroups:", error.message);
    return [];
  }
  return data || [];
}

/** Single group + its members hydrated with profiles. Returns null when not visible. */
export async function getGroupWithMembers(client, groupId) {
  if (!groupId) return null;
  const { data: group, error: gErr } = await client
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (gErr || !group) {
    if (gErr) console.warn("[BITE] getGroup:", gErr.message);
    return null;
  }
  const { data: memberRows, error: mErr } = await client
    .from("group_members")
    .select("*")
    .eq("group_id", groupId);
  if (mErr) {
    console.warn("[BITE] getGroupMembers:", mErr.message);
    return { group, members: [] };
  }
  const ids = (memberRows || []).map((m) => m.user_id);
  let profilesById = {};
  if (ids.length) {
    const { data: profs, error: pErr } = await client
      .from("profiles")
      .select(PROFILE_FIELDS)
      .in("id", ids);
    if (pErr) console.warn("[BITE] getGroupMembers profiles:", pErr.message);
    profilesById = Object.fromEntries((profs || []).map((p) => [p.id, p]));
  }
  const members = (memberRows || []).map((m) => ({
    ...m,
    profile: profilesById[m.user_id] || null,
  }));
  return { group, members };
}

/**
 * Owner-only: invite an accepted friend by user id. RLS enforces both checks
 * (caller is owner, target is friend) so we treat any failure as a generic
 * error rather than trying to differentiate client-side.
 */
export async function inviteMember(client, groupId, userId) {
  if (!groupId || !userId) return { ok: false, code: "invalid" };
  const { error } = await client
    .from("group_members")
    .insert({ group_id: groupId, user_id: userId });
  if (error) {
    if (error.code === "23505") return { ok: false, code: "already_member" };
    console.warn("[BITE] inviteMember:", error.message);
    return { ok: false, code: "network" };
  }
  return { ok: true, code: null };
}

export async function removeMember(client, groupId, userId) {
  const { error } = await client
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) {
    console.warn("[BITE] removeMember:", error.message);
    return { ok: false, code: "network" };
  }
  return { ok: true, code: null };
}

export async function leaveGroup(client, groupId, userId) {
  return removeMember(client, groupId, userId);
}
