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
