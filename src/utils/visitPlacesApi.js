/**
 * Supabase helpers: restaurant_places + restaurant_visits, cafe_places + cafe_visits.
 * UI keeps a flattened row per visit (join place + author profile).
 */

import { REGION_MAP } from "../constants/cuisineConstants.js";

const PROFILE_FIELDS = "id, username, display_name, avatar_url";

/** Gated debug log — silent in production builds (Vite drops the call site). */
const isDev = typeof import.meta !== "undefined" && !!import.meta.env?.DEV;
function devLog(...args) {
  if (isDev) console.log(...args);
}

function mapAuthor(row) {
  const a = row.author || row.profiles || {};
  return {
    authorUsername: a.username ?? "",
    authorDisplayName: a.display_name ?? "",
    authorAvatarUrl: a.avatar_url ?? "",
  };
}

/** Flatten `restaurant_places` embed, then map to UI entry shape. */
export function mapRestaurantVisitRow(row) {
  const { restaurant_places, ...rest } = row;
  const rp = Array.isArray(restaurant_places) ? restaurant_places[0] : restaurant_places;
  const flat = { ...rest, ...(rp || {}) };
  return {
    id: flat.id,
    placeId: flat.place_id,
    name: flat.name ?? "",
    cuisine: flat.cuisine ?? "",
    cuisine2: flat.cuisine2 ?? "",
    isFusion: !!flat.is_fusion,
    city: flat.city ?? "",
    taste: +flat.taste,
    cost: +flat.cost,
    currency_code: flat.currency_code || "USD",
    portions: +flat.portions,
    wait: +flat.wait,
    repeatability: +flat.repeatability,
    useR: flat.use_r !== false,
    notes: flat.notes ?? "",
    letter: (flat.cuisine?.[0] || "").toUpperCase(),
    ownerId: flat.user_id ?? null,
    visitedAt: flat.visited_at ?? null,
    ...mapAuthor(row),
  };
}

/** Flatten `cafe_places` embed, then map to UI entry shape. */
export function mapCafeVisitRow(row) {
  const { cafe_places, ...rest } = row;
  const cp = Array.isArray(cafe_places) ? cafe_places[0] : cafe_places;
  const flat = { ...rest, ...(cp || {}) };
  return {
    id: flat.id,
    placeId: flat.place_id,
    name: flat.name ?? "",
    city: flat.city ?? "",
    category: flat.category || "Coffee",
    order: flat.order_item || "",
    taste: +flat.taste,
    cost: +flat.cost,
    currency_code: flat.currency_code || "USD",
    portions: +flat.portions,
    wait: +(flat.wait || 0),
    beanRegion: flat.bean_region ? flat.bean_region.split(",").filter(Boolean) : [],
    milkLevel: flat.milk_level || "",
    roast: flat.roast || "",
    acidity: flat.acidity != null ? +flat.acidity : null,
    body: flat.body != null ? +flat.body : null,
    sweetness: flat.sweetness != null ? +flat.sweetness : null,
    flavorNotes: Array.isArray(flat.flavor_notes) ? flat.flavor_notes : [],
    repeatability: +flat.repeatability,
    useR: flat.use_r !== false,
    notes: flat.notes ?? "",
    ownerId: flat.user_id ?? null,
    visitedAt: flat.visited_at ?? null,
    ...mapAuthor(row),
  };
}

async function attachAuthorProfiles(client, rows) {
  if (!rows?.length) return rows;
  const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  if (!uids.length) return rows;
  const { data: profs, error } = await client.from("profiles").select(PROFILE_FIELDS).in("id", uids);
  if (error) {
    console.warn("[BITE] attachAuthorProfiles:", error.message);
    return rows;
  }
  const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    author: pmap[r.user_id] || {},
  }));
}

/**
 * PostgREST embedded resource (not raw SQL). Parent rows are `restaurant_visits` / `cafe_visits`;
 * always order by **`visited_at`** on those tables — they have no `created_at`.
 */
export const RESTAURANT_VISIT_SELECT =
  "*, restaurant_places(name, cuisine, cuisine2, is_fusion, city)";

export const CAFE_VISIT_SELECT = "*, cafe_places(name, city)";

/** FK embed may be an object or a single-element array depending on PostgREST. */
export function normalizeRestaurantVisitEmbed(row) {
  const rp = row.restaurant_places;
  const placeObj = Array.isArray(rp) ? rp[0] : rp;
  return { ...row, place: placeObj ?? {}, restaurant_places: placeObj };
}

export function normalizeCafeVisitEmbed(row) {
  const cp = row.cafe_places;
  const placeObj = Array.isArray(cp) ? cp[0] : cp;
  return { ...row, place: placeObj ?? {}, cafe_places: placeObj };
}

/** Load visits with place + author; never throws — logs and returns []. */
export async function fetchRestaurantVisitsJoined(client, userId) {
  devLog("[BITE] fetching with userId:", userId);
  if (userId == null || userId === "") {
    console.warn("[BITE] fetchRestaurantVisitsJoined: userId argument is null or empty");
    return [];
  }

  const { data, error } = await client
    .from("restaurant_visits")
    .select(RESTAURANT_VISIT_SELECT)
    .eq("user_id", userId)
    .order("visited_at", { ascending: false });

  devLog("[BITE] restaurant_visits { data, error }", { data, error });
  if (error) {
    console.error("[BITE] restaurant_visits query error:", error.message, error.details ?? "");
    return [];
  }
  if (!data?.length) return [];

  const withAuthors = await attachAuthorProfiles(client, data);
  return withAuthors.map(mapRestaurantVisitRow);
}

export async function fetchCafeVisitsJoined(client, userId) {
  devLog("[BITE] fetching with userId:", userId);
  if (userId == null || userId === "") {
    console.warn("[BITE] fetchCafeVisitsJoined: userId argument is null or empty");
    return [];
  }

  const { data, error } = await client
    .from("cafe_visits")
    .select(CAFE_VISIT_SELECT)
    .eq("user_id", userId)
    .order("visited_at", { ascending: false });

  devLog("[BITE] cafe_visits { data, error }", { data, error });
  if (error) {
    console.error("[BITE] cafe_visits query error:", error.message, error.details ?? "");
    return [];
  }
  if (!data?.length) return [];

  const withAuthors = await attachAuthorProfiles(client, data);
  return withAuthors.map(mapCafeVisitRow);
}

/**
 * Find place by case-insensitive name match; if missing, insert. When the
 * caller already knows the canonical `placeId` (e.g. picked from PlacePicker),
 * short-circuit and skip the lookup/insert entirely so we don't risk creating
 * a near-duplicate row when the typed name drifts.
 */
export async function ensureRestaurantPlace(client, { placeId, name, cuisine, cuisine2, isFusion, city }) {
  if (placeId) return placeId;
  const n = (name || "").trim();
  if (!n) throw new Error("Restaurant name required");
  const { data: found, error: selErr } = await client
    .from("restaurant_places")
    .select("id")
    .ilike("name", n)
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (found?.id) return found.id;
  const { data: ins, error: insErr } = await client
    .from("restaurant_places")
    .insert({
      name: n,
      cuisine: cuisine || "",
      cuisine2: cuisine2 || "",
      is_fusion: !!isFusion,
      city: city || "",
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return ins.id;
}

export async function ensureCafePlace(client, { placeId, name, city }) {
  if (placeId) return placeId;
  const n = (name || "").trim();
  if (!n) throw new Error("Café name required");
  const { data: found, error: selErr } = await client
    .from("cafe_places")
    .select("id")
    .ilike("name", n)
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (found?.id) return found.id;
  const { data: ins, error: insErr } = await client
    .from("cafe_places")
    .insert({ name: n, city: city || "" })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return ins.id;
}

/**
 * Shared catalog read used by PlacePicker. RLS allows any authenticated user
 * to SELECT all rows in `*_places`, so this is just a flat list — no joins,
 * no auth filter. Returns `[]` on any error so the picker stays usable.
 *
 * `verified_*` fields (populated by the Google Places `places-resolve` Edge
 * Function) are surfaced alongside the user-typed columns. PlacePicker and
 * the form autopopulate prefer `verified*` when present so canonical Google
 * data wins over the first-write-from-a-user fallback. See
 * docs/decisions/2026-04-28-google-places-verified-fields.md.
 */
export async function fetchAllRestaurantPlaces(client) {
  const { data, error } = await client
    .from("restaurant_places")
    .select(
      "id, name, cuisine, cuisine2, is_fusion, city, verified_name, verified_cuisine, verified_city, lat, lng, verified_at",
    );
  if (error) {
    console.warn("[BITE] fetchAllRestaurantPlaces:", error.message);
    return [];
  }
  return (data || []).map((p) => ({
    id: p.id,
    name: p.name || "",
    city: p.city || "",
    cuisine: p.cuisine || "",
    cuisine2: p.cuisine2 || "",
    isFusion: !!p.is_fusion,
    googlePlaceId: "",
    verifiedName: p.verified_name || "",
    verifiedCuisine: p.verified_cuisine || "",
    verifiedCity: p.verified_city || "",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    verifiedAt: p.verified_at || null,
  }));
}

export async function fetchAllCafePlaces(client) {
  const { data, error } = await client
    .from("cafe_places")
    .select(
      "id, name, city, verified_name, verified_city, lat, lng, verified_at",
    );
  if (error) {
    console.warn("[BITE] fetchAllCafePlaces:", error.message);
    return [];
  }
  return (data || []).map((p) => ({
    id: p.id,
    name: p.name || "",
    city: p.city || "",
    googlePlaceId: "",
    verifiedName: p.verified_name || "",
    verifiedCity: p.verified_city || "",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    verifiedAt: p.verified_at || null,
  }));
}

export function restaurantVisitInsertPayload(placeId, userId, e) {
  return {
    place_id: placeId,
    user_id: userId,
    taste: e.taste,
    cost: e.cost,
    currency_code: e.currency_code || "USD",
    portions: e.portions,
    wait: e.wait,
    repeatability: e.repeatability,
    use_r: e.useR !== false,
    notes: e.notes || "",
  };
}

export function restaurantVisitUpdatePayload(placeId, e) {
  return {
    place_id: placeId,
    taste: e.taste,
    cost: e.cost,
    currency_code: e.currency_code || "USD",
    portions: e.portions,
    wait: e.wait,
    repeatability: e.repeatability,
    use_r: e.useR !== false,
    notes: e.notes || "",
  };
}

export function cafeVisitInsertPayload(placeId, userId, e) {
  return {
    place_id: placeId,
    user_id: userId,
    category: e.category || "Coffee",
    order_item: e.order || "",
    taste: e.taste,
    cost: e.cost,
    currency_code: e.currency_code || "USD",
    portions: e.portions,
    wait: e.wait || 0,
    bean_region: Array.isArray(e.beanRegion) ? e.beanRegion.join(",") : (e.beanRegion || ""),
    roast: e.roast || "",
    acidity: e.acidity != null ? e.acidity : null,
    body: e.body != null ? e.body : null,
    sweetness: e.sweetness != null ? e.sweetness : null,
    flavor_notes: Array.isArray(e.flavorNotes) ? e.flavorNotes : [],
    repeatability: e.repeatability,
    use_r: e.useR !== false,
    notes: e.notes || "",
  };
}

export function cafeVisitUpdatePayload(placeId, e) {
  return {
    place_id: placeId,
    category: e.category || "Coffee",
    order_item: e.order || "",
    taste: e.taste,
    cost: e.cost,
    currency_code: e.currency_code || "USD",
    portions: e.portions,
    wait: e.wait || 0,
    bean_region: Array.isArray(e.beanRegion) ? e.beanRegion.join(",") : (e.beanRegion || ""),
    roast: e.roast || "",
    acidity: e.acidity != null ? e.acidity : null,
    body: e.body != null ? e.body : null,
    sweetness: e.sweetness != null ? e.sweetness : null,
    flavor_notes: Array.isArray(e.flavorNotes) ? e.flavorNotes : [],
    repeatability: e.repeatability,
    use_r: e.useR !== false,
    notes: e.notes || "",
  };
}

/**
 * Per-user visits joined with place — used by Compare / Groups to compute
 * taste-by-cuisine compatibility against another user. Reads succeed because
 * `*_visits` SELECT is open to authenticated (`20260501_*`).
 */
export async function fetchRestaurantVisitsForUser(client, userId) {
  if (!userId) return [];
  const { data, error } = await client
    .from("restaurant_visits")
    .select(RESTAURANT_VISIT_SELECT)
    .eq("user_id", userId)
    .order("visited_at", { ascending: false });
  if (error) {
    console.warn("[BITE] fetchRestaurantVisitsForUser:", error.message);
    return [];
  }
  return (data || []).map(mapRestaurantVisitRow);
}

/**
 * Roll a list of restaurant visit rows (as produced by `mapRestaurantVisitRow`)
 * into the four "food stats" surfaced in the Friends-tab mini profile sheet.
 *
 * Counts mirror how cuisines/regions are tallied elsewhere (palette donut,
 * quests): primary `cuisine` only, blanks ignored. `regions` excludes the
 * implicit "Other" bucket — only cuisines mapped via `REGION_MAP` count, so
 * the value is always 0..Object.keys(CUISINE_REGIONS).length.
 */
export function computeFoodStats(visits) {
  const rows = Array.isArray(visits) ? visits : [];
  const cuisines = new Set();
  const cities = new Set();
  const regions = new Set();
  for (const v of rows) {
    if (v.cuisine) cuisines.add(v.cuisine);
    if (v.city) cities.add(v.city);
    const r = REGION_MAP[v.cuisine];
    if (r) regions.add(r);
  }
  return {
    restaurants: rows.length,
    cuisines: cuisines.size,
    cities: cities.size,
    regions: regions.size,
  };
}

export async function fetchCafeVisitsForUser(client, userId) {
  if (!userId) return [];
  const { data, error } = await client
    .from("cafe_visits")
    .select(CAFE_VISIT_SELECT)
    .eq("user_id", userId)
    .order("visited_at", { ascending: false });
  if (error) {
    console.warn("[BITE] fetchCafeVisitsForUser:", error.message);
    return [];
  }
  return (data || []).map(mapCafeVisitRow);
}

/**
 * Aggregate community taste/BITE inputs by place. One row per `*_places`,
 * with averages of every BITE input (taste, cost, portions, wait, repeat)
 * plus a useR-majority flag, so consumers can do "mean-then-BITE" with the
 * viewer's own weights.
 *
 * `visitCount` is the total number of visits seen (for display). `validCount`
 * is the subset with finite BITE inputs and `portions > 0` — only these
 * contribute to the averages. Places where `validCount === 0` still appear
 * (they had visits) but their averages are null.
 *
 * Aggregation runs client-side over an unbounded SELECT, which is fine for v1
 * (RLS allows authenticated read of all visits + all profiles). If the corpus
 * grows, swap to a SECURITY DEFINER RPC similar to `popular_orders_for_place`.
 */
function aggregatePlaces(rows, getPlaceKey, makePlaceMeta, topReviewersLimit) {
  const byKey = new Map();
  for (const r of rows) {
    const key = getPlaceKey(r);
    if (!key) continue;
    const t = +r.taste;
    if (!Number.isFinite(t)) continue;
    const bucket = byKey.get(key) || {
      place: makePlaceMeta(r),
      sumTaste: 0,
      sumCost: 0,
      sumPortions: 0,
      sumWait: 0,
      sumRepeat: 0,
      useRTrue: 0,
      validCount: 0,
      visitCount: 0,
      reviewers: [],
    };
    bucket.sumTaste += t;
    bucket.visitCount += 1;
    bucket.reviewers.push({
      userId: r.ownerId,
      username: r.authorUsername,
      displayName: r.authorDisplayName,
      avatarUrl: r.authorAvatarUrl,
      taste: t,
    });

    /** A visit only counts toward BITE averages if it has the inputs BITE
     *  needs. `portions = 0` would make `cost / portions` blow up, and
     *  non-finite numbers are rejected upstream. */
    const cost = +r.cost;
    const portions = +r.portions;
    const wait = +r.wait;
    const repeat = +r.repeatability;
    if (
      Number.isFinite(cost) &&
      Number.isFinite(portions) && portions > 0 &&
      Number.isFinite(wait) &&
      Number.isFinite(repeat)
    ) {
      bucket.sumCost += cost;
      bucket.sumPortions += portions;
      bucket.sumWait += wait;
      bucket.sumRepeat += repeat;
      if (r.useR !== false) bucket.useRTrue += 1;
      bucket.validCount += 1;
    }

    byKey.set(key, bucket);
  }
  const out = [];
  for (const bucket of byKey.values()) {
    const avgTaste = bucket.sumTaste / bucket.visitCount;
    const topReviewers = [...bucket.reviewers]
      .sort((a, b) => b.taste - a.taste)
      .slice(0, topReviewersLimit);
    const v = bucket.validCount;
    const hasValid = v > 0;
    const avgCost = hasValid ? bucket.sumCost / v : null;
    const avgPortions = hasValid ? bucket.sumPortions / v : null;
    const avgWait = hasValid ? bucket.sumWait / v : null;
    const avgRepeat = hasValid ? bucket.sumRepeat / v : null;
    /** Majority rule: if at least half of the valid visits had `useR = true`,
     *  treat the aggregate as repeatability-on. Ties (e.g. 1/2) resolve to true
     *  because turning repeatability off is the deliberate opt-out. */
    const useRMajority = hasValid ? bucket.useRTrue * 2 >= v : true;
    out.push({
      ...bucket.place,
      avgTaste,
      avgCost,
      avgPortions,
      avgWait,
      avgRepeat,
      useRMajority,
      visitCount: bucket.visitCount,
      validCount: bucket.validCount,
      topReviewers,
    });
  }
  out.sort((a, b) => {
    if (b.avgTaste !== a.avgTaste) return b.avgTaste - a.avgTaste;
    return b.visitCount - a.visitCount;
  });
  return out;
}

export async function fetchAggregatedRestaurantPlaces(client, opts = {}) {
  const minVisits = opts.minVisits ?? 1;
  const topReviewersLimit = opts.topReviewersLimit ?? 3;
  const { data, error } = await client
    .from("restaurant_visits")
    .select(RESTAURANT_VISIT_SELECT)
    .order("visited_at", { ascending: false });
  if (error) {
    console.warn("[BITE] fetchAggregatedRestaurantPlaces:", error.message);
    return [];
  }
  if (!data?.length) return [];
  const withAuthors = await attachAuthorProfiles(client, data);
  const rows = withAuthors.map(mapRestaurantVisitRow);
  const aggregated = aggregatePlaces(
    rows,
    (r) => r.placeId,
    (r) => ({
      placeId: r.placeId,
      name: r.name,
      cuisine: r.cuisine,
      cuisine2: r.cuisine2,
      isFusion: r.isFusion,
      city: r.city,
    }),
    topReviewersLimit
  );
  return aggregated.filter((p) => p.visitCount >= minVisits);
}

export async function fetchAggregatedCafePlaces(client, opts = {}) {
  const minVisits = opts.minVisits ?? 1;
  const topReviewersLimit = opts.topReviewersLimit ?? 3;
  /** "drinks" = Coffee/Tea/Other; "sweets" = Sweets. Omit to aggregate everything. */
  const categoryFilter = opts.categoryFilter ?? null;
  let query = client
    .from("cafe_visits")
    .select(CAFE_VISIT_SELECT)
    .order("visited_at", { ascending: false });
  if (categoryFilter === "drinks") {
    query = query.in("category", ["Coffee", "Tea", "Other"]);
  } else if (categoryFilter === "sweets") {
    query = query.eq("category", "Sweets");
  }
  const { data, error } = await query;
  if (error) {
    console.warn("[BITE] fetchAggregatedCafePlaces:", error.message);
    return [];
  }
  if (!data?.length) return [];
  const withAuthors = await attachAuthorProfiles(client, data);
  const rows = withAuthors.map(mapCafeVisitRow);
  const aggregated = aggregatePlaces(
    rows,
    /** Group by place + category — same place can appear under Drinks AND Sweets. */
    (r) => `${r.placeId}::${r.category}`,
    (r) => ({
      placeId: r.placeId,
      name: r.name,
      city: r.city,
      category: r.category,
    }),
    topReviewersLimit
  );
  return aggregated.filter((p) => p.visitCount >= minVisits);
}

/**
 * Cross-user popular orders at a cafe place. Calls a SECURITY DEFINER RPC
 * that aggregates over `cafe_visits` (bypassing per-user RLS for counts only)
 * and applies a >=2 distinct user privacy floor. Silently returns [] on any
 * failure - this feature is additive and must never block the form.
 */
export async function fetchPopularOrdersForPlace(client, placeId, category) {
  if (!placeId) return [];
  const { data, error } = await client.rpc("popular_orders_for_place", {
    p_place_id: placeId,
    p_category: category || null,
  });
  if (error) {
    devLog("popular_orders_for_place failed", error);
    return [];
  }
  return (data || []).map((r) => r.order_item).filter(Boolean);
}
