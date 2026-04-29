/**
 * Notifications API over `public.notifications`.
 *
 * Notification types:
 *   "follow"     — someone followed you
 *   "taste_buds" — you and someone became mutual follows
 *
 * Each row is hydrated with `fromProfile` (id, username, display_name, avatar_url)
 * from the profiles table.
 */

/**
 * Fetch the 20 most recent notifications for `userId`, newest first.
 * Returns rows augmented with `fromProfile`.
 */
export async function fetchUnreadNotifications(client, userId, limit = 20) {
  if (!userId) return [];
  const { data: rows, error } = await client
    .from("notifications")
    .select("id, user_id, from_user_id, type, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[BITE] fetchUnreadNotifications:", error.message);
    return [];
  }
  if (!rows?.length) return [];

  // Hydrate from_user profiles in one query.
  const fromIds = [...new Set(rows.map((r) => r.from_user_id))];
  const { data: profiles } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", fromIds);

  const pm = {};
  for (const p of profiles || []) pm[p.id] = p;

  return rows.map((r) => ({ ...r, fromProfile: pm[r.from_user_id] || null }));
}

/**
 * Mark all unread notifications for `userId` as read.
 */
export async function markNotificationsRead(client, userId) {
  if (!userId) return;
  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) console.warn("[BITE] markNotificationsRead:", error.message);
}

/**
 * Return the count of unread notifications for `userId`.
 * Returns 0 on any failure so the badge never shows a phantom count.
 */
export async function countUnreadNotifications(client, userId) {
  if (!userId) return 0;
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) {
    console.warn("[BITE] countUnreadNotifications:", error.message);
    return 0;
  }
  return count || 0;
}
