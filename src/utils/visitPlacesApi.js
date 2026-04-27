/**
 * Supabase helpers: restaurant_places + restaurant_visits, cafe_places + cafe_visits.
 * UI keeps a flattened row per visit (join place + author profile).
 */

const PROFILE_FIELDS = "id, username, display_name, avatar_url";

function mapAuthor(row) {
  const a = row.author || row.profiles || {};
  return {
    authorUsername: a.username ?? "",
    authorDisplayName: a.display_name ?? "",
    authorAvatarUrl: a.avatar_url ?? "",
  };
}

/** Map joined restaurant_visits row → UI entry shape. */
export function mapRestaurantVisitRow(row) {
  const p = row.place || row.restaurant_places || {};
  return {
    id: row.id,
    placeId: row.place_id,
    name: p.name ?? "",
    cuisine: p.cuisine ?? "",
    cuisine2: p.cuisine2 ?? "",
    isFusion: !!p.is_fusion,
    city: p.city ?? "",
    taste: +row.taste,
    cost: +row.cost,
    portions: +row.portions,
    wait: +row.wait,
    repeatability: +row.repeatability,
    useR: row.use_r !== false,
    notes: row.notes ?? "",
    letter: (p.cuisine?.[0] || "").toUpperCase(),
    ownerId: row.user_id ?? null,
    visitedAt: row.visited_at ?? null,
    ...mapAuthor(row),
  };
}

/** Map joined cafe_visits row → UI entry shape. */
export function mapCafeVisitRow(row) {
  const p = row.place || row.cafe_places || {};
  return {
    id: row.id,
    placeId: row.place_id,
    name: p.name ?? "",
    city: p.city ?? "",
    category: row.category || "Coffee",
    order: row.order_item || "",
    taste: +row.taste,
    cost: +row.cost,
    portions: +row.portions,
    wait: +(row.wait || 0),
    beanRegion: row.bean_region || "",
    milkLevel: row.milk_level || "",
    repeatability: +row.repeatability,
    useR: row.use_r !== false,
    notes: row.notes ?? "",
    ownerId: row.user_id ?? null,
    visitedAt: row.visited_at ?? null,
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

/** PostgREST select shape for inserts/updates that return a full row to the client. */
export const RESTAURANT_VISIT_SELECT = `*, place:restaurant_places (*), author:profiles!restaurant_visits_user_id_fkey (${PROFILE_FIELDS})`;
export const CAFE_VISIT_SELECT = `*, place:cafe_places (*), author:profiles!cafe_visits_user_id_fkey (${PROFILE_FIELDS})`;

const REST_EMBED = RESTAURANT_VISIT_SELECT;
const CAFE_EMBED = CAFE_VISIT_SELECT;

/** Load visits with place + author; never throws — logs and returns []. */
export async function fetchRestaurantVisitsJoined(client, userId) {
  const joined = await client
    .from("restaurant_visits")
    .select(REST_EMBED)
    .eq("user_id", userId)
    .order("visited_at", { ascending: true });
  if (!joined.error && joined.data) {
    return joined.data.map(mapRestaurantVisitRow);
  }
  if (joined.error) {
    console.warn("[BITE] restaurant_visits joined select:", joined.error.message);
  }

  const { data: visits, error: vErr } = await client
    .from("restaurant_visits")
    .select("*")
    .eq("user_id", userId)
    .order("visited_at", { ascending: true });
  if (vErr) {
    console.error("[BITE] restaurant_visits:", vErr.message);
    return [];
  }
  if (!visits?.length) return [];

  const ids = [...new Set(visits.map((v) => v.place_id).filter(Boolean))];
  const { data: places, error: pErr } = await client.from("restaurant_places").select("*").in("id", ids);
  if (pErr) console.error("[BITE] restaurant_places:", pErr.message);
  const pmap = Object.fromEntries((places || []).map((p) => [p.id, p]));
  const withPlaces = visits.map((row) => ({ ...row, place: pmap[row.place_id] || {} }));
  const withAuthors = await attachAuthorProfiles(client, withPlaces);
  return withAuthors.map(mapRestaurantVisitRow);
}

export async function fetchCafeVisitsJoined(client, userId) {
  const joined = await client
    .from("cafe_visits")
    .select(CAFE_EMBED)
    .eq("user_id", userId)
    .order("visited_at", { ascending: true });
  if (!joined.error && joined.data) {
    return joined.data.map(mapCafeVisitRow);
  }
  if (joined.error) {
    console.warn("[BITE] cafe_visits joined select:", joined.error.message);
  }

  const { data: visits, error: vErr } = await client
    .from("cafe_visits")
    .select("*")
    .eq("user_id", userId)
    .order("visited_at", { ascending: true });
  if (vErr) {
    console.error("[BITE] cafe_visits:", vErr.message);
    return [];
  }
  if (!visits?.length) return [];

  const ids = [...new Set(visits.map((v) => v.place_id).filter(Boolean))];
  const { data: places, error: pErr } = await client.from("cafe_places").select("*").in("id", ids);
  if (pErr) console.error("[BITE] cafe_places:", pErr.message);
  const pmap = Object.fromEntries((places || []).map((p) => [p.id, p]));
  const withPlaces = visits.map((row) => ({ ...row, place: pmap[row.place_id] || {} }));
  const withAuthors = await attachAuthorProfiles(client, withPlaces);
  return withAuthors.map(mapCafeVisitRow);
}

/** Community leaderboard: all restaurant visits (authenticated), newest first. */
export async function fetchCommunityRestaurantVisits(client, limit = 120) {
  const joined = await client
    .from("restaurant_visits")
    .select(REST_EMBED)
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (!joined.error && joined.data) {
    return joined.data.map(mapRestaurantVisitRow);
  }
  if (joined.error) console.warn("[BITE] community restaurant_visits:", joined.error.message);

  const { data: visits, error: vErr } = await client
    .from("restaurant_visits")
    .select("*")
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (vErr || !visits?.length) return [];

  const pids = [...new Set(visits.map((v) => v.place_id).filter(Boolean))];
  const { data: places } = await client.from("restaurant_places").select("*").in("id", pids);
  const plmap = Object.fromEntries((places || []).map((p) => [p.id, p]));
  const withPlaces = visits.map((row) => ({ ...row, place: plmap[row.place_id] || {} }));
  const withAuthors = await attachAuthorProfiles(client, withPlaces);
  return withAuthors.map(mapRestaurantVisitRow);
}

/** Community leaderboard: all café visits (authenticated), newest first. */
export async function fetchCommunityCafeVisits(client, limit = 120) {
  const joined = await client
    .from("cafe_visits")
    .select(CAFE_EMBED)
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (!joined.error && joined.data) {
    return joined.data.map(mapCafeVisitRow);
  }
  if (joined.error) console.warn("[BITE] community cafe_visits:", joined.error.message);

  const { data: visits, error: vErr } = await client
    .from("cafe_visits")
    .select("*")
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (vErr || !visits?.length) return [];

  const pids = [...new Set(visits.map((v) => v.place_id).filter(Boolean))];
  const { data: places } = await client.from("cafe_places").select("*").in("id", pids);
  const plmap = Object.fromEntries((places || []).map((p) => [p.id, p]));
  const withPlaces = visits.map((row) => ({ ...row, place: plmap[row.place_id] || {} }));
  const withAuthors = await attachAuthorProfiles(client, withPlaces);
  return withAuthors.map(mapCafeVisitRow);
}

/**
 * Find place by case-insensitive name match; if missing, insert.
 */
export async function ensureRestaurantPlace(client, { name, cuisine, cuisine2, isFusion, city }) {
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

export async function ensureCafePlace(client, { name, city }) {
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

export function restaurantVisitInsertPayload(placeId, userId, e) {
  return {
    place_id: placeId,
    user_id: userId,
    taste: e.taste,
    cost: e.cost,
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
    portions: e.portions,
    wait: e.wait || 0,
    milk_level: e.milkLevel || "",
    bean_region: e.beanRegion || "",
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
    portions: e.portions,
    wait: e.wait || 0,
    milk_level: e.milkLevel || "",
    bean_region: e.beanRegion || "",
    repeatability: e.repeatability,
    use_r: e.useR !== false,
    notes: e.notes || "",
  };
}
