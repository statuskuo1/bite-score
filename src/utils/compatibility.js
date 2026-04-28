/**
 * Taste-by-cuisine compatibility math.
 *
 * Design note: BITE bakes in personal cost / wait / repeatability weights. Two
 * users with the same raw taste for Korean food should match — even if their
 * BITE diverges because one is more price-sensitive. So everything in here
 * works on raw `visit.taste` (0-10), never on BITE.
 *
 * The `getCuisine` extractor is pluggable so we can add cafés later (returning
 * e.g. `category` instead of cuisine string) without touching the math.
 */

export const MIN_SHARED_CUISINES = 2;
export const MIN_VISITS_PER_CUISINE = 1;

/** Default extractor for restaurant_visits joined with restaurant_places. Returns
 *  primary cuisine plus an optional second when `is_fusion` is set, so a fusion
 *  visit lifts the user's average for both cuisines. */
export function getRestaurantCuisines(visit) {
  if (!visit) return [];
  const out = [];
  const c1 = (visit.cuisine ?? "").trim();
  if (c1) out.push(c1);
  if (visit.isFusion) {
    const c2 = (visit.cuisine2 ?? "").trim();
    if (c2 && c2.toLowerCase() !== c1.toLowerCase()) out.push(c2);
  }
  return out;
}

/** Group visits by cuisine and return `{cuisine: {avg, count}}`. */
export function avgTasteByCuisine(visits, getCuisine = getRestaurantCuisines) {
  const buckets = new Map();
  for (const v of visits || []) {
    if (v == null || !Number.isFinite(+v.taste)) continue;
    const cuisines = getCuisine(v) || [];
    for (const raw of cuisines) {
      const key = String(raw).trim();
      if (!key) continue;
      const norm = key.toLowerCase();
      const existing = buckets.get(norm) || { display: key, sum: 0, count: 0 };
      existing.sum += +v.taste;
      existing.count += 1;
      buckets.set(norm, existing);
    }
  }
  const out = {};
  for (const [norm, { display, sum, count }] of buckets) {
    if (count < MIN_VISITS_PER_CUISINE) continue;
    out[norm] = { cuisine: display, avg: sum / count, count };
  }
  return out;
}

/**
 * Pair compatibility between two users' visits.
 *
 * Returns:
 *   {
 *     score:           0..100 (percent), null if insufficient overlap
 *     sharedCuisines:  count of cuisines both rated
 *     agreements: [
 *       { cuisine, mine, theirs, delta }   // sorted ascending by delta
 *     ]
 *     onlyMine:   [{cuisine, avg}]   // I rated, they didn't (signal "they should try")
 *     onlyTheirs: [{cuisine, avg}]   // they rated, I didn't ("you should try")
 *     notEnoughData: bool
 *   }
 */
export function pairCompatibility(myVisits, theirVisits, getCuisine = getRestaurantCuisines, opts = {}) {
  const minShared = opts.minShared ?? MIN_SHARED_CUISINES;
  const mine = avgTasteByCuisine(myVisits, getCuisine);
  const theirs = avgTasteByCuisine(theirVisits, getCuisine);
  const myKeys = new Set(Object.keys(mine));
  const theirKeys = new Set(Object.keys(theirs));

  const shared = [...myKeys].filter((k) => theirKeys.has(k));
  const agreements = shared
    .map((k) => ({
      cuisine: mine[k].cuisine || theirs[k].cuisine,
      mine: mine[k].avg,
      theirs: theirs[k].avg,
      delta: Math.abs(mine[k].avg - theirs[k].avg),
    }))
    .sort((a, b) => a.delta - b.delta);

  const onlyMine = [...myKeys]
    .filter((k) => !theirKeys.has(k))
    .map((k) => ({ cuisine: mine[k].cuisine, avg: mine[k].avg, count: mine[k].count }))
    .sort((a, b) => b.avg - a.avg);

  const onlyTheirs = [...theirKeys]
    .filter((k) => !myKeys.has(k))
    .map((k) => ({ cuisine: theirs[k].cuisine, avg: theirs[k].avg, count: theirs[k].count }))
    .sort((a, b) => b.avg - a.avg);

  if (agreements.length < minShared) {
    return { score: null, sharedCuisines: agreements.length, agreements, onlyMine, onlyTheirs, notEnoughData: true };
  }

  const meanDelta = agreements.reduce((acc, a) => acc + a.delta, 0) / agreements.length;
  // Taste range is 0-10, so a 10-point gap = 0% match, 0 gap = 100% match.
  const score = Math.max(0, Math.min(100, Math.round((1 - meanDelta / 10) * 100)));
  return { score, sharedCuisines: agreements.length, agreements, onlyMine, onlyTheirs, notEnoughData: false };
}

/**
 * Rank cuisines for a group, optimising for the floor.
 *
 * Input: `memberVisitsByUser = [{ userId, visits: [...] }, ...]`.
 * Output: array sorted descending by floor score:
 *   [{ cuisine, floor, perMember: [{userId, avg, count}], coverage }]
 *
 * `coverage` is the number of members who rated that cuisine. By default we
 * require *all* members to have rated it (coverage === total). Caller can pass
 * `opts.minCoverage = 'all' | <int>` to relax (e.g. allow N-1 of N).
 */
/**
 * Aggregate a single user's visits by `placeId`, averaging taste across repeat
 * visits to the same restaurant. Visits without a `placeId` (legacy / orphan
 * rows) and visits with a non-finite taste are dropped.
 *
 * Returns `{ [placeId]: { placeId, name, cuisine, city, taste, visits } }`.
 * `taste` is the per-place mean — using the latest visit would be more
 * volatile when a user re-rates the same place.
 */
export function visitsByPlace(visits) {
  const buckets = new Map();
  for (const v of visits || []) {
    if (!v?.placeId) continue;
    if (!Number.isFinite(+v.taste)) continue;
    const existing = buckets.get(v.placeId) || {
      placeId: v.placeId,
      name: v.name || "",
      cuisine: v.cuisine || "",
      city: v.city || "",
      sum: 0,
      visits: 0,
    };
    existing.sum += +v.taste;
    existing.visits += 1;
    if (!existing.name && v.name) existing.name = v.name;
    if (!existing.cuisine && v.cuisine) existing.cuisine = v.cuisine;
    if (!existing.city && v.city) existing.city = v.city;
    buckets.set(v.placeId, existing);
  }
  const out = {};
  for (const [pid, b] of buckets) {
    out[pid] = {
      placeId: b.placeId,
      name: b.name,
      cuisine: b.cuisine,
      city: b.city,
      taste: b.sum / b.visits,
      visits: b.visits,
    };
  }
  return out;
}

/**
 * Restaurant-level set diff between two users, keyed by `placeId`. Powers the
 * Compare tab's three sections — "Both visited" (intersection), "They tried"
 * (their-only), "You tried" (mine-only).
 *
 * Each user's per-place taste is the mean of their visits to that place
 * (see `visitsByPlace`). Place metadata (name/cuisine/city) prefers whichever
 * side has it populated, so an older orphan-row on one side doesn't blank a
 * row that the other side has full data for.
 *
 * Returns:
 *   {
 *     both:       [{ placeId, name, cuisine, city, mine, theirs, avg }] // sorted desc by avg
 *     onlyTheirs: [{ placeId, name, cuisine, city, theirs }]            // sorted desc by theirs
 *     onlyMine:   [{ placeId, name, cuisine, city, mine }]              // sorted desc by mine
 *   }
 */
export function restaurantOverlap(myVisits, theirVisits) {
  const mine = visitsByPlace(myVisits);
  const theirs = visitsByPlace(theirVisits);

  const both = [];
  const onlyMine = [];
  const onlyTheirs = [];

  for (const [pid, mp] of Object.entries(mine)) {
    const tp = theirs[pid];
    if (tp) {
      both.push({
        placeId: pid,
        name: mp.name || tp.name,
        cuisine: mp.cuisine || tp.cuisine,
        city: mp.city || tp.city,
        mine: mp.taste,
        theirs: tp.taste,
        avg: (mp.taste + tp.taste) / 2,
      });
    } else {
      onlyMine.push({
        placeId: pid,
        name: mp.name,
        cuisine: mp.cuisine,
        city: mp.city,
        mine: mp.taste,
      });
    }
  }
  for (const [pid, tp] of Object.entries(theirs)) {
    if (mine[pid]) continue;
    onlyTheirs.push({
      placeId: pid,
      name: tp.name,
      cuisine: tp.cuisine,
      city: tp.city,
      theirs: tp.taste,
    });
  }

  both.sort((a, b) => b.avg - a.avg);
  onlyTheirs.sort((a, b) => b.theirs - a.theirs);
  onlyMine.sort((a, b) => b.mine - a.mine);
  return { both, onlyTheirs, onlyMine };
}

/**
 * Aggregate restaurant visits across many users (friends) keyed by `placeId`.
 * For each place, returns the mean taste across **per-user means** (so a
 * friend who visited a place 5 times doesn't get 5x the weight of a friend
 * who visited once) and the count of distinct users who rated it.
 *
 * `friendVisitsByUser`: `[{ userId, visits: [...] }, ...]`. Visits without
 * `placeId` or non-finite taste are dropped.
 *
 * Returns rows sorted by `avg` desc:
 *   [{ placeId, name, cuisine, city, avg, friendCount }]
 */
export function aggregateFriendsTopPicks(friendVisitsByUser) {
  const places = new Map();
  for (const { visits } of friendVisitsByUser || []) {
    const perPlace = visitsByPlace(visits);
    for (const entry of Object.values(perPlace)) {
      const existing = places.get(entry.placeId) || {
        placeId: entry.placeId,
        name: entry.name,
        cuisine: entry.cuisine,
        city: entry.city,
        sum: 0,
        friendCount: 0,
      };
      existing.sum += entry.taste;
      existing.friendCount += 1;
      if (!existing.name && entry.name) existing.name = entry.name;
      if (!existing.cuisine && entry.cuisine) existing.cuisine = entry.cuisine;
      if (!existing.city && entry.city) existing.city = entry.city;
      places.set(entry.placeId, existing);
    }
  }
  const rows = [];
  for (const p of places.values()) {
    rows.push({
      placeId: p.placeId,
      name: p.name,
      cuisine: p.cuisine,
      city: p.city,
      avg: p.sum / p.friendCount,
      friendCount: p.friendCount,
    });
  }
  rows.sort((a, b) => {
    if (b.avg !== a.avg) return b.avg - a.avg;
    return b.friendCount - a.friendCount;
  });
  return rows;
}

export function rankGroupCuisines(memberVisitsByUser, getCuisine = getRestaurantCuisines, opts = {}) {
  const total = memberVisitsByUser.length;
  if (total === 0) return [];
  const minCoverage =
    opts.minCoverage === "all" || opts.minCoverage == null
      ? total
      : Math.max(1, Math.min(total, opts.minCoverage));

  const perUserBuckets = memberVisitsByUser.map(({ userId, visits }) => ({
    userId,
    buckets: avgTasteByCuisine(visits, getCuisine),
  }));

  const cuisineKeys = new Set();
  for (const { buckets } of perUserBuckets) {
    for (const k of Object.keys(buckets)) cuisineKeys.add(k);
  }

  const ranked = [];
  for (const k of cuisineKeys) {
    let display = k;
    const perMember = [];
    for (const { userId, buckets } of perUserBuckets) {
      const cell = buckets[k];
      if (cell) {
        display = cell.cuisine || display;
        perMember.push({ userId, avg: cell.avg, count: cell.count, rated: true });
      } else {
        perMember.push({ userId, avg: null, count: 0, rated: false });
      }
    }
    const ratedAvgs = perMember.filter((m) => m.rated).map((m) => m.avg);
    const coverage = ratedAvgs.length;
    if (coverage < minCoverage) continue;
    const floor = Math.min(...ratedAvgs);
    ranked.push({ cuisine: display, floor, perMember, coverage });
  }

  ranked.sort((a, b) => {
    if (b.floor !== a.floor) return b.floor - a.floor;
    return b.coverage - a.coverage;
  });
  return ranked;
}
