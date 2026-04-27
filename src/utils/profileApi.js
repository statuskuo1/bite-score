/**
 * public.profiles helpers — sync from Supabase Auth user metadata (OAuth / magic link).
 */

/** Build profile fields from auth.user (user_metadata + email). */
export function profilePayloadFromUser(user) {
  if (!user?.id) return null;
  const meta = user.user_metadata || {};
  const email = user.email || "";
  const prefix = email.includes("@") ? email.split("@")[0] : (email || "user");
  const displayName =
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    prefix;
  const username =
    meta.preferred_username ||
    meta.user_name ||
    meta.username ||
    prefix;
  const avatarUrl = meta.avatar_url || meta.picture || null;
  return {
    username: String(username).slice(0, 80),
    display_name: String(displayName).slice(0, 120),
    avatar_url: avatarUrl ? String(avatarUrl).slice(0, 2048) : null,
  };
}

export async function fetchProfileById(client, userId) {
  if (!userId) return null;
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.warn("[BITE] fetchProfileById:", error.message);
    return null;
  }
  return data;
}

/**
 * After sign-in: ensure a profile row exists and backfill display fields from OAuth when empty.
 */
export async function ensureProfile(client, user) {
  if (!user?.id) return null;
  const payload = profilePayloadFromUser(user);
  if (!payload) return null;

  const existing = await fetchProfileById(client, user.id);
  if (existing) {
    const needsFill =
      (!existing.display_name || String(existing.display_name).trim() === "") ||
      (!existing.username || String(existing.username).trim() === "") ||
      (!existing.avatar_url && payload.avatar_url);

    if (needsFill) {
      const { error } = await client
        .from("profiles")
        .update({
          username: existing.username?.trim() ? existing.username : payload.username,
          display_name: existing.display_name?.trim() ? existing.display_name : payload.display_name,
          avatar_url: existing.avatar_url?.trim() ? existing.avatar_url : payload.avatar_url,
        })
        .eq("id", user.id);
      if (error) console.warn("[BITE] profile update:", error.message);
      return fetchProfileById(client, user.id);
    }
    return existing;
  }

  const { error } = await client.from("profiles").insert({
    id: user.id,
    ...payload,
  });
  if (error) {
    if (error.code === "23505") {
      return fetchProfileById(client, user.id);
    }
    console.warn("[BITE] profile insert:", error.message);
    return fetchProfileById(client, user.id);
  }
  return fetchProfileById(client, user.id);
}
