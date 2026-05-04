/**
 * Module-level in-memory caches that survive React component unmount/remount.
 * All caches are keyed or guarded by userId so they auto-invalidate on
 * sign-in / sign-out / account switch.
 *
 * No persistence — cleared on full page reload, which is desirable so stale
 * data never outlives a session.
 */

export const GLOBAL_TTL_MS  = 5 * 60 * 1000;  // 5 min
export const FOLLOWS_TTL_MS = 3 * 60 * 1000;  // 3 min

// ── Global leaderboard ────────────────────────────────────────────────────────
export const globalCache = {
  restaurants: [], drinks: [], sweets: [],
  fetchedAt: 0,
  userId: undefined, // undefined = never fetched
};

// ── Taste-Buds-scoped Top Picks ───────────────────────────────────────────────
// Parallel to globalCache but populated from a userIds-filtered aggregate so
// Explore › Top Picks can't accidentally share rows with Explore › Global.
// `budsKey` (sorted bud-id join) flips when the viewer follows / unfollows a
// bud, invalidating the cache before the TTL would otherwise hide the change.
export const tasteBudsPicksCache = {
  restaurants: [], drinks: [], sweets: [],
  fetchedAt: 0,
  userId: undefined,
  budsKey: "",
};

// ── Want-to-Go (saved places) ─────────────────────────────────────────────────
// Shared source of truth for both the Explore › Want to Go sub-tab and the
// "+ Want to go" / "✓ saved" buttons on feed posts and the place stats sheet.
// Mutated in-place by addWantToGo / removeWantToGo (plus optimistic helpers
// for instant UI feedback), with a subscriber list driving useSyncExternalStore
// so every mounted consumer re-renders without polling.
export const wantToGoCache = {
  rows: [],
  fetchedAt: 0,
  userId: undefined,
  version: 0,
};

const wantToGoSubscribers = new Set();

export function subscribeWantToGo(fn) {
  wantToGoSubscribers.add(fn);
  return () => wantToGoSubscribers.delete(fn);
}

/** Increment version + wake every subscribed hook. Call after any mutation. */
export function bumpWantToGoCache() {
  wantToGoCache.version += 1;
  // We deliberately do NOT zero fetchedAt here: once the cache is authoritative
  // (seeded from boot or a successful list fetch), every subsequent mutation
  // is applied in-place via upsertWantToGoRow / removeWantToGoRow, so a TTL
  // refetch would just echo what we already have. The Want-to-Go tab's own
  // effect re-fetches when user changes, which is enough.
  for (const fn of wantToGoSubscribers) {
    try { fn(); } catch (err) { console.warn("[BITE] wantToGo subscriber:", err); }
  }
}

/** Merge a row into the cache (dedup on place_id + kind) and notify. */
export function upsertWantToGoRow(row) {
  if (!row || !row.place_id || !row.kind) return;
  const idx = wantToGoCache.rows.findIndex(
    (r) => r.place_id === row.place_id && r.kind === row.kind,
  );
  if (idx === -1) {
    wantToGoCache.rows = [row, ...wantToGoCache.rows];
  } else {
    const next = wantToGoCache.rows.slice();
    next[idx] = { ...next[idx], ...row };
    wantToGoCache.rows = next;
  }
  bumpWantToGoCache();
}

/** Drop a row from the cache by (place_id, kind) and notify. */
export function removeWantToGoRow(placeId, kind) {
  if (!placeId || !kind) return;
  const before = wantToGoCache.rows.length;
  wantToGoCache.rows = wantToGoCache.rows.filter(
    (r) => !(r.place_id === placeId && r.kind === kind),
  );
  if (wantToGoCache.rows.length !== before) bumpWantToGoCache();
}

/** Wholesale replace, used by boot load + the Want-to-Go tab's fetch. */
export function setWantToGoRows(userId, rows) {
  wantToGoCache.rows = rows || [];
  wantToGoCache.userId = userId;
  wantToGoCache.fetchedAt = Date.now();
  bumpWantToGoCache();
}

/** Snapshot helper for useSyncExternalStore `getSnapshot` — returns a
 *  primitive so hook equality works naturally. */
export function wantToGoHas(placeId, kind) {
  if (!placeId || !kind) return false;
  return wantToGoCache.rows.some(
    (r) => r.place_id === placeId && r.kind === kind,
  );
}

// ── Follows (friends list) ────────────────────────────────────────────────────
export const followsCache = {
  following: [], followers: [], tasteBuds: [],
  fetchedAt: 0,
  userId: null,
};

// ── Current user's own restaurant visits ─────────────────────────────────────
// Shared between FriendsTab (compatibility scores) and CompareTab.
export const myRestVisitsCache = { data: [], userId: null };

// ── Per-user restaurant visits (buds / compare targets) ──────────────────────
// Map: userId → visits[]. Cleared when the viewing user changes, since the
// set of reachable profiles may differ between accounts.
const _uvCache = new Map();
let _uvCacheOwner = null;

export function getUserVisitsCache(currentUserId) {
  if (_uvCacheOwner !== currentUserId) {
    _uvCache.clear();
    _uvCacheOwner = currentUserId;
  }
  return _uvCache;
}

// ── MiniProfileSheet food stats ───────────────────────────────────────────────
// Map: profileId → computedStats object. Session-scoped, no TTL.
export const profileStatsCache = new Map();
