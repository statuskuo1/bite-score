import posthog from "../config/posthog.js";

/**
 * Feed reactions: hearts only (for now).
 *
 * Backed by `public.feed_reactions` (see 20260514 migration). One row per
 * (user, post_id, post_type, reaction). The `post_type` discriminator
 * disambiguates a restaurant_visit from a cafe_visit when both happen to
 * share an id (uuids won't, but the type is part of the natural key in the
 * client too — `${kind}-${id}` is the post key everywhere in the feed UI).
 *
 * All helpers fail soft and return empty results on error so a missing
 * migration or a transient network blip just renders zero hearts instead
 * of breaking the feed.
 */

const DB_TYPE_BY_KIND = { rest: "restaurant", cafe: "cafe" };

function postKey(kind, id) {
  return `${kind}-${id}`;
}

/**
 * Fetch heart counts + reactor profile lists for a batch of feed posts.
 *
 * @returns {Promise<Map<string, { count: number, mine: boolean, reactors: Array<Profile> }>>}
 *   Map keyed by `${kind}-${postId}` with at most a handful of reactor
 *   profiles per post (capped at REACTOR_AVATAR_LIMIT) plus the total count.
 */
const REACTOR_AVATAR_LIMIT = 4;

export async function fetchReactionsForPosts(client, posts, viewerId) {
  const out = new Map();
  if (!posts?.length) return out;

  /** Reactions are queried by post_type + post_id, but the column is a
   *  scalar uuid. We build two batches keyed by post_type and union them. */
  const byType = { restaurant: [], cafe: [] };
  for (const p of posts) {
    const dbType = DB_TYPE_BY_KIND[p.kind];
    if (!dbType || !p.id) continue;
    byType[dbType].push(p.id);
  }

  const queries = [];
  if (byType.restaurant.length) {
    queries.push(
      client
        .from("feed_reactions")
        .select("post_id, post_type, user_id, created_at")
        .eq("post_type", "restaurant")
        .in("post_id", byType.restaurant),
    );
  }
  if (byType.cafe.length) {
    queries.push(
      client
        .from("feed_reactions")
        .select("post_id, post_type, user_id, created_at")
        .eq("post_type", "cafe")
        .in("post_id", byType.cafe),
    );
  }
  if (!queries.length) return out;

  const results = await Promise.all(queries);
  const allRows = [];
  for (const res of results) {
    if (res.error) {
      console.warn("[BITE] fetchReactionsForPosts:", res.error.message);
      continue;
    }
    if (res.data) allRows.push(...res.data);
  }
  if (!allRows.length) return out;

  /** Hydrate reactor profiles in one shot. */
  const userIds = [...new Set(allRows.map((r) => r.user_id))];
  let profiles = {};
  if (userIds.length) {
    const { data: profs, error: pErr } = await client
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);
    if (pErr) {
      console.warn("[BITE] fetchReactionsForPosts profiles:", pErr.message);
    } else {
      for (const p of profs || []) profiles[p.id] = p;
    }
  }

  /** Group by post; keep most-recent reactors first so the avatar stack
   *  shows fresh activity. `created_at` desc sort happens client-side. */
  const grouped = new Map();
  for (const row of allRows) {
    const kind = row.post_type === "restaurant" ? "rest" : "cafe";
    const key = postKey(kind, row.post_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  for (const [key, rows] of grouped) {
    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    const reactors = rows
      .slice(0, REACTOR_AVATAR_LIMIT)
      .map((r) => profiles[r.user_id])
      .filter(Boolean);
    const mine = !!viewerId && rows.some((r) => r.user_id === viewerId);
    out.set(key, { count: rows.length, mine, reactors });
  }
  return out;
}

/**
 * Fetch the full reactor profile list for a single post — no slice.
 *
 * The batch helper above caps at REACTOR_AVATAR_LIMIT for the avatar stack,
 * but the "+N others" expanded modal needs every reactor. Returns an array
 * of profiles ordered by `created_at desc` so newest hearts surface first
 * (matches the avatar-stack ordering).
 *
 * Fails soft: returns [] on any DB error so the modal renders an empty
 * list instead of crashing the feed.
 */
export async function fetchAllReactorsForPost(client, post) {
  if (!post?.id) return [];
  const dbType = DB_TYPE_BY_KIND[post.kind];
  if (!dbType) return [];

  const { data: rows, error } = await client
    .from("feed_reactions")
    .select("user_id, created_at")
    .eq("post_type", dbType)
    .eq("post_id", post.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[BITE] fetchAllReactorsForPost:", error.message);
    return [];
  }
  if (!rows?.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  if (!userIds.length) return [];

  const { data: profs, error: pErr } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);
  if (pErr) {
    console.warn("[BITE] fetchAllReactorsForPost profiles:", pErr.message);
    return [];
  }
  const byId = new Map((profs || []).map((p) => [p.id, p]));

  /** Preserve the created_at desc order from the reactions query, dedupe
   *  on user_id (a unique constraint should already prevent duplicates
   *  but the dedupe is cheap insurance). */
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r.user_id || seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    const p = byId.get(r.user_id);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Toggle a heart on a single post. Returns the new state for that post.
 *
 * Optimistic callers should compute the next state locally (count ± 1, mine
 * flip) and reconcile with the returned value when the request resolves.
 *
 * Side effect: when adding a heart on someone else's post, also inserts a
 * 'heart_reaction' notification so the post owner sees it in the bell.
 * Removing a heart leaves prior notifications untouched (matches IG /
 * Strava convention — once seen, a like notification is permanent).
 *
 * Failures log the full error object (not just `.message`) so missing
 * migrations surface their PostgREST error code (e.g. `42P01` for "relation
 * does not exist") in the browser console.
 */
export async function toggleHeart(client, viewerId, post, currentlyMine) {
  if (!viewerId || !post?.id) return null;
  const dbType = DB_TYPE_BY_KIND[post.kind];
  if (!dbType) return null;

  if (currentlyMine) {
    const { error } = await client
      .from("feed_reactions")
      .delete()
      .eq("user_id", viewerId)
      .eq("post_id", post.id)
      .eq("post_type", dbType)
      .eq("reaction", "heart");
    if (error) {
      console.warn("[BITE] toggleHeart delete:", error);
      return null;
    }
    return { mine: false };
  }

  const { error } = await client
    .from("feed_reactions")
    .insert({
      user_id: viewerId,
      post_id: post.id,
      post_type: dbType,
      reaction: "heart",
    });
  if (error) {
    /** 23505 = unique violation — already hearted (race). Treat as success
     *  and skip the notification (the recipient already got one when the
     *  original heart landed). */
    if (error.code === "23505") return { mine: true };
    console.warn("[BITE] toggleHeart insert:", error);
    return null;
  }

  /** Notify the post owner. Skip self-hearts and skip silently on any
   *  notification failure — the heart itself succeeded, so we don't want
   *  to surface a false rollback to the optimistic UI. */
  posthog.capture("feed post hearted", { post_type: dbType, place_name: post.name || "" });

  if (post.ownerId && post.ownerId !== viewerId) {
    const { error: nErr } = await client.from("notifications").insert({
      user_id: post.ownerId,
      from_user_id: viewerId,
      type: "heart_reaction",
      meta: {
        post_id: post.id,
        post_type: dbType,
        place_name: post.name || "",
        city: post.city || "",
      },
    });
    if (nErr) console.warn("[BITE] toggleHeart notification:", nErr);
  }

  return { mine: true };
}
