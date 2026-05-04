import {
  upsertWantToGoRow,
  removeWantToGoRow,
} from "./sessionCache.js";

const UPSERT_OPTS = { onConflict: "user_id,place_id,kind", ignoreDuplicates: true };

/** Optimistic add: flip the UI right away, then let the network call confirm. */
export function optimisticAddWantToGo(userId, { placeId, kind, name, cuisine, city, category }) {
  if (!userId || !placeId || !kind) return;
  upsertWantToGoRow({
    place_id: placeId,
    kind,
    name: name || "",
    cuisine: cuisine || null,
    city: city || null,
    category: category || null,
    created_at: new Date().toISOString(),
  });
}

/** Optimistic remove: flip the UI right away. Used for both user-initiated
 *  un-saves and (indirectly) the post-log auto-removal. */
export function optimisticRemoveWantToGo({ placeId, kind }) {
  if (!placeId || !kind) return;
  removeWantToGoRow(placeId, kind);
}

export async function addWantToGo(client, userId, { placeId, kind, name, cuisine, city, category }) {
  if (!userId || !placeId) return { ok: false };
  const payload = {
    user_id: userId,
    place_id: placeId,
    kind,
    name,
    cuisine: cuisine || null,
    city: city || null,
    category: category || null,
  };

  let { error } = await client.from("want_to_go").upsert(payload, UPSERT_OPTS);

  // Graceful fallback: older deployments haven't applied the migration that
  // adds `category`. Retry without the new column so saves still work instead
  // of hard-failing with a 400. The category-aware bucketing in the Want to
  // Go tab will fall back to looking up the cafe_places catalog for these rows.
  if (error && /category/i.test(error.message || "")) {
    const { category: _omit, ...legacy } = payload;
    const retry = await client.from("want_to_go").upsert(legacy, UPSERT_OPTS);
    error = retry.error || null;
  }

  if (error) {
    console.warn("[BITE] addWantToGo:", error.message);
    return { ok: false };
  }

  upsertWantToGoRow({
    place_id: placeId,
    kind,
    name: name || "",
    cuisine: cuisine || null,
    city: city || null,
    category: category || null,
    created_at: new Date().toISOString(),
  });
  return { ok: true };
}

export async function removeWantToGo(client, userId, { placeId, kind }) {
  if (!userId || !placeId) return { ok: false };
  const { error } = await client.from("want_to_go")
    .delete()
    .eq("user_id", userId)
    .eq("place_id", placeId)
    .eq("kind", kind);
  if (error) {
    console.warn("[BITE] removeWantToGo:", error.message);
    return { ok: false };
  }
  removeWantToGoRow(placeId, kind);
  return { ok: true };
}

/** List every place the viewer has saved. Sorted most-recent first. */
export async function listWantToGo(client, userId) {
  if (!userId) return [];
  const { data, error } = await client.from("want_to_go")
    .select("place_id, kind, name, cuisine, city, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[BITE] listWantToGo:", error.message);
    return [];
  }
  return data || [];
}
