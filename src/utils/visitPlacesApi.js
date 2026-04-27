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
    portions: +flat.portions,
    wait: +(flat.wait || 0),
    beanRegion: flat.bean_region || "",
    milkLevel: flat.milk_level || "",
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

/** Prefer JWT `sub` over any React-cached id so `.eq('user_id', …)` matches DB rows (`profiles.id` / old `auth.users`). */
async function resolveCanonicalUserId(client, fallbackUserId) {
  const { data: authData, error } = await client.auth.getUser();
  if (error) {
    console.warn("[BITE] auth.getUser:", error.message);
  }
  const canonicalUserId = authData?.user?.id ?? fallbackUserId ?? null;
  if (
    canonicalUserId &&
    fallbackUserId &&
    authData?.user?.id &&
    authData.user.id !== fallbackUserId
  ) {
    console.warn("[BITE] Using JWT user id for visit fetch (caller id differed)", {
      callerId: fallbackUserId,
      jwtSub: authData.user.id,
    });
  }
  return {
    canonicalUserId,
    email: authData?.user?.email ?? null,
  };
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
  if (userId == null || userId === "") {
    console.warn("[BITE] fetchRestaurantVisitsJoined: userId argument is null or empty");
  }

  const { canonicalUserId, email } = await resolveCanonicalUserId(client, userId);
  if (!canonicalUserId) {
    console.warn("[BITE] fetchRestaurantVisitsJoined: missing user id after auth.getUser()");
    return [];
  }

  if (import.meta.env.DEV) {
    console.log("[BITE] My Log auth context", {
      authUserId: canonicalUserId,
      email,
      callerUserId: userId,
      idsMatch: userId === canonicalUserId,
    });
  }

  if (import.meta.env.DEV) {
    const host =
      typeof import.meta.env.VITE_SUPABASE_URL === "string"
        ? (() => {
            try {
              return new URL(import.meta.env.VITE_SUPABASE_URL).host;
            } catch {
              return "(invalid URL)";
            }
          })()
        : "(unset)";
    console.log("[BITE] My Log Supabase host (from .env)", host);
  }

  // Filter by JWT-resolved uuid (never null here); aligns with visit.user_id → profiles.id
  const { data, error } = await client
    .from("restaurant_visits")
    .select(RESTAURANT_VISIT_SELECT)
    .eq("user_id", canonicalUserId)
    .order("visited_at", { ascending: false });

  console.log("[BITE] restaurant_visits { data, error }", { data, error });
  if (error) {
    console.error("[BITE] restaurant_visits query error:", error.message, error.details ?? "");
    return [];
  }
  if (!data?.length) return [];

  const withAuthors = await attachAuthorProfiles(client, data);
  const entries = withAuthors.map(mapRestaurantVisitRow);

  if (import.meta.env.DEV) {
    console.log("[BITE] My Log mapped entries", { count: entries.length, first: entries[0] });
  }

  return entries;
}

export async function fetchCafeVisitsJoined(client, userId) {
  if (userId == null || userId === "") {
    console.warn("[BITE] fetchCafeVisitsJoined: userId argument is null or empty");
  }

  const { canonicalUserId } = await resolveCanonicalUserId(client, userId);
  if (!canonicalUserId) {
    console.warn("[BITE] fetchCafeVisitsJoined: missing user id after auth.getUser()");
    return [];
  }

  const { data, error } = await client
    .from("cafe_visits")
    .select(CAFE_VISIT_SELECT)
    .eq("user_id", canonicalUserId)
    .order("visited_at", { ascending: false });

  console.log("[BITE] cafe_visits { data, error }", { data, error });
  if (error) {
    console.error("[BITE] cafe_visits query error:", error.message, error.details ?? "");
    return [];
  }
  if (!data?.length) return [];

  const withAuthors = await attachAuthorProfiles(client, data);
  return withAuthors.map(mapCafeVisitRow);
}

/** Community leaderboard: all restaurant visits (authenticated), newest first. */
export async function fetchCommunityRestaurantVisits(client, limit = 120) {
  const { data, error } = await client
    .from("restaurant_visits")
    .select(RESTAURANT_VISIT_SELECT)
    .order("visited_at", { ascending: false })
    .limit(limit);

  console.log("[BITE] community restaurant_visits { data, error }", { data, error });
  if (error) {
    console.error("[BITE] community restaurant_visits:", error.message, error.details ?? "");
    return [];
  }
  if (!data?.length) return [];

  const withAuthors = await attachAuthorProfiles(client, data);
  return withAuthors.map(mapRestaurantVisitRow);
}

/** Community leaderboard: all café visits (authenticated), newest first. */
export async function fetchCommunityCafeVisits(client, limit = 120) {
  const { data, error } = await client
    .from("cafe_visits")
    .select(CAFE_VISIT_SELECT)
    .order("visited_at", { ascending: false })
    .limit(limit);

  console.log("[BITE] community cafe_visits { data, error }", { data, error });
  if (error) {
    console.error("[BITE] community cafe_visits:", error.message, error.details ?? "");
    return [];
  }
  if (!data?.length) return [];

  const withAuthors = await attachAuthorProfiles(client, data);
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
