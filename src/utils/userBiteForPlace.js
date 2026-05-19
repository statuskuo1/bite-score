/**
 * Compute each user's own mean BITE for a given place, using their own
 * inputs and their own weights — no viewer adjustment.
 *
 * Used by the "+N others" expanded modal in the feed (OthersListSheet) to
 * show, per row, what the underlying person actually scored this place.
 * Users without a log entry at the place resolve to `null` (rendered as
 * "—" in the UI).
 *
 * Cafe scoring reuses the same `pref_weight_*` triple FeedPostRow already
 * shortcuts on for cafes (see FeedPostRow.computeScore — poster weights
 * fan out to drink + sweet weights).
 */

import {
  normalizeWeights,
  meanRestaurantBiteOutOf10,
  calcCafeOutOf10,
} from "./scoring.js";

/**
 * Mean café BITE (0–10) over a user's visits at one place — mirrors
 * `meanRestaurantBiteOutOf10` but routes through `calcCafeOutOf10`.
 */
function meanCafeBiteOutOf10(entries, wts) {
  let sum = 0;
  let n = 0;
  for (const e of entries) {
    const v = calcCafeOutOf10(
      +e.taste, +e.cost, +e.portions, +(e.wait || 0),
      e.useR !== false, +e.repeatability,
      wts, e.currency_code || "USD",
    );
    if (v != null && !Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

/**
 * Returns Map<userId, number|null> — each user's mean BITE at `post.placeId`
 * computed with their own stored weights, or `null` if they have no visits
 * there.
 *
 * Fails soft on any DB error: returns an empty Map (callers render every
 * row as "—").
 *
 * @param {object} client    Supabase client
 * @param {string[]} userIds The user ids to score (deduped internally)
 * @param {{ placeId: string, kind: "rest"|"cafe" }} post
 */
export async function fetchUsersBiteAtPlace(client, userIds, post) {
  const out = new Map();
  if (!post?.placeId || !post?.kind) return out;
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return out;

  const isCafe = post.kind === "cafe";
  const table = isCafe ? "cafe_visits" : "restaurant_visits";

  const visitsP = client
    .from(table)
    .select("user_id, taste, cost, portions, wait, repeatability, use_r, currency_code")
    .eq("place_id", post.placeId)
    .in("user_id", ids);

  const profilesP = client
    .from("profiles")
    .select("id, pref_weight_taste, pref_weight_bpb, pref_weight_wait, pref_weight_drink_taste, pref_weight_drink_bpb, pref_weight_drink_wait")
    .in("id", ids);

  const [visitsRes, profilesRes] = await Promise.all([visitsP, profilesP]);
  if (visitsRes.error) {
    console.warn("[BITE] fetchUsersBiteAtPlace visits:", visitsRes.error.message);
    return out;
  }
  if (profilesRes.error) {
    console.warn("[BITE] fetchUsersBiteAtPlace profiles:", profilesRes.error.message);
  }

  /** Group visits by user. */
  const visitsByUser = new Map();
  for (const row of visitsRes.data || []) {
    if (!row.user_id) continue;
    if (!visitsByUser.has(row.user_id)) visitsByUser.set(row.user_id, []);
    visitsByUser.get(row.user_id).push(row);
  }

  /** Index weights by user; missing rows fall back to defaults via normalizeWeights. */
  const weightsByUser = new Map();
  for (const p of profilesRes.data || []) {
    const wts = isCafe
      ? normalizeWeights({ taste: p.pref_weight_drink_taste, bpb: p.pref_weight_drink_bpb, wait: p.pref_weight_drink_wait })
      : normalizeWeights({ taste: p.pref_weight_taste, bpb: p.pref_weight_bpb, wait: p.pref_weight_wait });
    weightsByUser.set(p.id, wts);
  }

  for (const uid of ids) {
    const visits = visitsByUser.get(uid);
    if (!visits?.length) {
      out.set(uid, null);
      continue;
    }
    const wts = weightsByUser.get(uid) || normalizeWeights(null);
    /** meanRestaurantBiteOutOf10 reads e.useR / e.repeatability — map snake_case once. */
    const mapped = visits.map((v) => ({
      taste: +v.taste,
      cost: +v.cost,
      portions: +v.portions,
      wait: +(v.wait || 0),
      useR: v.use_r !== false,
      repeatability: +v.repeatability,
      currency_code: v.currency_code || "USD",
    }));
    const score = isCafe
      ? meanCafeBiteOutOf10(mapped, wts)
      : meanRestaurantBiteOutOf10(mapped, wts);
    out.set(uid, score);
  }

  return out;
}
