/**
 * Chronological feed of mutual-follow ("Taste Buds") activity.
 *
 * Pulls the most recent restaurant + cafe visits from everyone the viewer
 * mutually follows, merges them into a single time-ordered stream, and
 * paginates by `visited_at` cursor. The viewer's own visits are not
 * included — Feed is "what your buds are eating"; the viewer's own log
 * lives under My Log.
 *
 * The merge runs client-side over two parallel reads (one per visit table)
 * because PostgREST can't UNION across tables in a single embed. Each side
 * is capped at `limit`, then the combined list is re-sorted and trimmed
 * back to `limit` so a burst on either side can't crowd out the other
 * within a page.
 */

import {
  RESTAURANT_VISIT_SELECT,
  CAFE_VISIT_SELECT,
  mapRestaurantVisitRow,
  mapCafeVisitRow,
  attachAuthorProfiles,
} from "./visitPlacesApi.js";
import { listTasteBuds } from "./followsApi.js";

const DEFAULT_PAGE_SIZE = 30;

/**
 * Fetch the next page of taste-bud feed posts.
 *
 * @param {object} client - Supabase client
 * @param {string} viewerId
 * @param {object} [opts]
 * @param {string|null} [opts.before] - ISO timestamp; only return visits with `visited_at < before`.
 * @param {number}      [opts.limit]  - max merged posts (default 30).
 * @returns {Promise<{ posts: Array, nextCursor: string|null }>}
 *   Each post is the standard mapped visit shape (see `mapRestaurantVisitRow` /
 *   `mapCafeVisitRow`) plus a `kind: "rest" | "cafe"` discriminator so the row
 *   component can pick the right scoring function and label set.
 */
export async function fetchTasteBudsFeed(client, viewerId, opts = {}) {
  const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
  const before = opts.before ?? null;

  if (!viewerId) return { posts: [], nextCursor: null };

  const buds = await listTasteBuds(client, viewerId);
  const budIds = buds.map((b) => b.otherUserId).filter(Boolean);
  if (!budIds.length) return { posts: [], nextCursor: null };

  let restQ = client
    .from("restaurant_visits")
    .select(RESTAURANT_VISIT_SELECT)
    .in("user_id", budIds)
    .order("visited_at", { ascending: false })
    .limit(limit);
  let cafeQ = client
    .from("cafe_visits")
    .select(CAFE_VISIT_SELECT)
    .in("user_id", budIds)
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (before) {
    restQ = restQ.lt("visited_at", before);
    cafeQ = cafeQ.lt("visited_at", before);
  }

  const [restRes, cafeRes] = await Promise.all([restQ, cafeQ]);
  if (restRes.error) {
    console.warn("[BITE] feed restaurant_visits:", restRes.error.message);
  }
  if (cafeRes.error) {
    console.warn("[BITE] feed cafe_visits:", cafeRes.error.message);
  }

  const restRows = restRes.data || [];
  const cafeRows = cafeRes.data || [];
  if (!restRows.length && !cafeRows.length) {
    return { posts: [], nextCursor: null };
  }

  /** Hydrate authors in one batched profiles read across both kinds. The
   *  return preserves order, so we can split it back by the original
   *  restaurant-row count. */
  const allRows = [...restRows, ...cafeRows];
  const withAuthors = await attachAuthorProfiles(client, allRows);
  const restWithAuthors = withAuthors.slice(0, restRows.length);
  const cafeWithAuthors = withAuthors.slice(restRows.length);

  const restPosts = restWithAuthors.map((r) => ({
    ...mapRestaurantVisitRow(r),
    kind: "rest",
  }));
  const cafePosts = cafeWithAuthors.map((r) => ({
    ...mapCafeVisitRow(r),
    kind: "cafe",
  }));

  const merged = [...restPosts, ...cafePosts]
    .filter((p) => p.visitedAt)
    .sort((a, b) => {
      if (a.visitedAt === b.visitedAt) return 0;
      return a.visitedAt < b.visitedAt ? 1 : -1;
    })
    .slice(0, limit);

  /** A full page implies more rows could exist on either side — expose a
   *  cursor and let the next call return [] if it's actually empty. We
   *  can't probe both tails without an extra round-trip, and the false-
   *  positive only costs one wasted "Show more" tap. */
  const nextCursor =
    merged.length === limit ? merged[merged.length - 1].visitedAt : null;

  return { posts: merged, nextCursor };
}

/**
 * Fetch a single visit (restaurant or cafe) by id and produce the same
 * post shape `FeedPostRow` consumes. Used by `FeedPostSheet` when a
 * heart-reaction notification is tapped — meta carries `(post_id,
 * post_type)`, and we want to render that one card without going through
 * the bud-aggregate feed query.
 *
 * Fails soft: returns `null` for any error (missing row, RLS hide,
 * network blip). The sheet renders a "couldn't load" state on null.
 */
export async function fetchVisitByIdAndType(client, postId, postType) {
  if (!postId || !postType) return null;
  const isCafe = postType === "cafe";
  const table = isCafe ? "cafe_visits" : "restaurant_visits";
  const select = isCafe ? CAFE_VISIT_SELECT : RESTAURANT_VISIT_SELECT;

  const { data, error } = await client
    .from(table)
    .select(select)
    .eq("id", postId)
    .maybeSingle();
  if (error) {
    console.warn("[BITE] fetchVisitByIdAndType:", error.message);
    return null;
  }
  if (!data) return null;

  const [withAuthor] = await attachAuthorProfiles(client, [data]);
  return {
    ...(isCafe ? mapCafeVisitRow(withAuthor) : mapRestaurantVisitRow(withAuthor)),
    kind: isCafe ? "cafe" : "rest",
  };
}

/**
 * Resolve "dined with" co-diner profiles for a batch of feed posts.
 *
 * Calls the SECURITY DEFINER `fetch_co_diners_for_entries` RPC (added in
 * 20260514) so the viewer can see co-diners on someone else's post even
 * though `dine_with_tags` per-row RLS would otherwise hide those tags.
 *
 * Returns a Map keyed by `${kind}-${postId}` so the row component can do
 * an O(1) lookup against the same key it uses for React `key=`.
 *
 * Fails soft: returns an empty Map on any RPC error (the dined-with row
 * just won't render for affected posts).
 */
export async function fetchCoDinersForPosts(client, posts, viewerId) {
  const out = new Map();
  if (!posts?.length) return out;
  const entryIds = posts.map((p) => p.id).filter(Boolean);
  if (!entryIds.length) return out;

  const { data, error } = await client.rpc("fetch_co_diners_for_entries", {
    p_entry_ids: entryIds,
    p_exclude_id: viewerId || null,
  });
  if (error) {
    console.warn("[BITE] fetchCoDinersForPosts:", error.message);
    return out;
  }
  if (!data?.length) return out;

  /** The RPC returns one row per (entry_id, tagged user). Group locally
   *  into a Map<entry_id, Map<profile_id, profile>> so duplicate
   *  (entry, tagged) rows from a hosted DB that hasn't run the 20260516
   *  cleanup migration yet still collapse to one entry per profile. Mirrors
   *  the dedupe pattern in fetchDinedWithByEntry. */
  const byEntry = new Map();
  for (const row of data) {
    if (!byEntry.has(row.entry_id)) byEntry.set(row.entry_id, new Map());
    byEntry.get(row.entry_id).set(row.id, {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    });
  }
  for (const post of posts) {
    const m = byEntry.get(post.id);
    if (m?.size) out.set(`${post.kind}-${post.id}`, [...m.values()]);
  }
  return out;
}
