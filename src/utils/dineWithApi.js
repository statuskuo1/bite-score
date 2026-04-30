/**
 * Dine-with tagging API over `public.dine_with_tags` and `public.notifications`.
 *
 * Flow:
 *   1. User A saves a visit → inserts dine_with_tags rows for each tagged friend
 *      and inserts a 'dine_tag' notification for each tagged friend.
 *   2. Tagged friend sees a banner on /add and a notification in the bell.
 *   3. Tagged friend can log their own visit (entry_id stays null until then)
 *      or dismiss the tag.
 */

/**
 * Insert one dine_with_tag row and a 'dine_tag' notification for the tagged user.
 * @param {object} client - Supabase client
 * @param {object} tag
 * @param {string} tag.taggerId
 * @param {string} tag.taggedId
 * @param {string} tag.entryId - the tagger's visit id
 * @param {string} tag.entryType - 'restaurant' | 'cafe'
 * @param {string} tag.restaurantName
 * @param {string} [tag.city]
 * @param {string} [tag.cuisine]
 */
export async function insertDineTag(client, { taggerId, taggedId, entryId, entryType, restaurantName, city = "", cuisine = "", notify = true }) {
  try {
    const { data, error } = await client
      .from("dine_with_tags")
      .insert({
        tagger_id: taggerId,
        tagged_id: taggedId,
        entry_id: entryId || null,
        entry_type: entryType,
        restaurant_name: restaurantName,
        city,
        cuisine,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[BITE] insertDineTag:", error.message);
      return null;
    }

    if (notify) {
      // If the tagged user already has an outgoing tag back to us, this is a mutual
      // confirmation — use dine_tag_back so they don't see "all bark no bite" again.
      const { data: reverseRow } = await client
        .from("dine_with_tags")
        .select("id")
        .eq("tagger_id", taggedId)
        .eq("tagged_id", taggerId)
        .ilike("restaurant_name", restaurantName)
        .maybeSingle();

      const { error: nErr } = await client.from("notifications").insert({
        user_id: taggedId,
        from_user_id: taggerId,
        type: reverseRow ? "dine_tag_mutual" : "dine_tag",
        meta: { restaurant_name: restaurantName, entry_type: entryType, city, cuisine, entry_id: entryId || null },
      });
      if (nErr) console.warn("[BITE] insertDineTag notification:", nErr.message);
    }

    return data?.id ?? null;
  } catch (err) {
    console.warn("[BITE] insertDineTag threw:", err);
    return null;
  }
}

/**
 * Return profiles of everyone else the tagger tagged on the same entry.
 * Uses a SECURITY DEFINER RPC to bypass the RLS restriction that prevents
 * a tagged user from reading other tagged users' rows.
 * Returns [] when entry_id is null or the RPC fails.
 */
export async function fetchCoDiners(client, { taggerId, entryId, excludeUserId }) {
  if (!taggerId || !entryId) return [];
  const { data, error } = await client.rpc("fetch_co_diners", {
    p_tagger_id: taggerId,
    p_entry_id: entryId,
    p_exclude_id: excludeUserId,
  });
  if (error) { console.warn("[BITE] fetchCoDiners:", error.message); return []; }
  return data || [];
}

/**
 * Fetch all non-dismissed dine_with_tags where the given user is tagged,
 * hydrated with the tagger's profile.
 */
export async function fetchUnloggedDineTags(client, userId) {
  if (!userId) return [];

  const { data: rows, error } = await client
    .from("dine_with_tags")
    .select("id, created_at, entry_id, entry_type, tagger_id, tagged_id, restaurant_name, city, cuisine, dismissed")
    .eq("tagged_id", userId)
    .eq("dismissed", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[BITE] fetchUnloggedDineTags:", error.message);
    return [];
  }
  if (!rows?.length) return [];

  const taggerIds = [...new Set(rows.map((r) => r.tagger_id))];
  const { data: profiles } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", taggerIds);

  const pm = {};
  for (const p of profiles || []) pm[p.id] = p;

  return rows.map((r) => ({ ...r, taggerProfile: pm[r.tagger_id] || null }));
}

/**
 * Count non-dismissed dine_with_tags for a user. Returns 0 on failure.
 */
export async function countUnloggedDineTags(client, userId) {
  if (!userId) return 0;
  const { count, error } = await client
    .from("dine_with_tags")
    .select("id", { count: "exact", head: true })
    .eq("tagged_id", userId)
    .eq("dismissed", false);

  if (error) {
    console.warn("[BITE] countUnloggedDineTags:", error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Build a Map<entryId, Profile[]> of everyone the user tagged on each of
 * their own visits. Used to display "Dined with" on expanded entry cards.
 */
export async function fetchDinedWithByEntry(client, userId) {
  if (!userId) return new Map();
  const { data, error } = await client
    .from("dine_with_tags")
    .select("entry_id, tagged_id")
    .eq("tagger_id", userId)
    .not("entry_id", "is", null);
  if (error || !data?.length) return new Map();
  const allIds = [...new Set(data.map((r) => r.tagged_id))];
  const { data: profiles } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", allIds);
  const profMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const map = new Map();
  for (const { entry_id, tagged_id } of data) {
    const profile = profMap[tagged_id];
    if (!profile) continue;
    if (!map.has(entry_id)) map.set(entry_id, []);
    if (!map.get(entry_id).some((p) => p.id === profile.id)) {
      map.get(entry_id).push(profile);
    }
  }
  return map;
}

/**
 * Dismiss a dine_with_tag (tagged user only).
 */
export async function dismissDineTag(client, tagId) {
  const { error } = await client
    .from("dine_with_tags")
    .update({ dismissed: true })
    .eq("id", tagId);
  if (error) console.warn("[BITE] dismissDineTag:", error.message);
}
