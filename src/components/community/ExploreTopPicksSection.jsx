import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { listFollows } from "../../utils/followsApi.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import {
  followsCache, getUserVisitsCache, FOLLOWS_TTL_MS,
} from "../../utils/sessionCache.js";
import { aggregateFriendsTopPicks } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";

const ROW_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  marginBottom: 6,
  background: "#1E1E1C",
  border: "0.5px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
};

const FLAG_BOX_STYLE = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: "#252523",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  flexShrink: 0,
};

function flagFor(cuisine, name) {
  return FLAGS[cuisine] || (cuisine?.[0] || name?.[0] || "?").toUpperCase();
}

/** One row in the aggregated "Taste Buds' top picks" leaderboard. */
function TopPickRow({ pick }) {
  const { t } = useLang();
  const col = tasteColor(pick.avg);
  return (
    <div style={ROW_STYLE}>
      <div style={FLAG_BOX_STYLE}>{flagFor(pick.cuisine, pick.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: "#F1EFE8",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{pick.name}</div>
        <div style={{ fontSize: 11, color: "#888780", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[pick.cuisine || null, `avg ${pick.avg.toFixed(2)}`].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: col, lineHeight: 1.1 }}>
          {pick.avg.toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>
          {pick.friendCount} {t.tasteBudsCountSuffix || "taste buds"}
        </div>
      </div>
    </div>
  );
}

/**
 * Explore > Top Picks sub-section.
 *
 * Aggregates the top restaurants across the viewer's Taste Buds (mutual
 * follows). Lifted unchanged from the old FriendsTab bottom block — same
 * `aggregateFriendsTopPicks` helper, same cap of 10 rows, same data
 * dependencies (taste buds list + each bud's restaurant visits). Math
 * redesign (e.g. compatibility-weighted picks across all-following) is
 * deferred to a future plan.
 *
 * Data fetching is self-contained but reuses the shared session caches
 * (`followsCache`, `getUserVisitsCache`) so opening this section after
 * People > Taste Buds reuses already-loaded data.
 */
export function ExploreTopPicksSection({ user }) {
  const { t } = useLang();
  const [tasteBuds, setTasteBuds] = useState([]);
  const [budVisits, setBudVisits] = useState(() =>
    Object.fromEntries(getUserVisitsCache(user?.id)),
  );

  // Hydrate the Taste Buds list — from cache if fresh, otherwise refetch.
  useEffect(() => {
    if (!user?.id) { setTasteBuds([]); return; }
    if (
      followsCache.userId === user?.id &&
      Date.now() - followsCache.fetchedAt < FOLLOWS_TTL_MS
    ) {
      setTasteBuds(followsCache.tasteBuds);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await listFollows(supabase, user.id);
      if (cancelled) return;
      setTasteBuds(result.tasteBuds);
      followsCache.following = result.following;
      followsCache.followers = result.followers;
      followsCache.tasteBuds = result.tasteBuds;
      followsCache.fetchedAt = Date.now();
      followsCache.userId = user?.id;
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Fetch each Taste Bud's restaurant visits, hitting the per-user cache first.
  useEffect(() => {
    if (!tasteBuds.length) return;
    const uvCache = getUserVisitsCache(user?.id);
    const cached = tasteBuds
      .map((f) => f.otherUserId)
      .filter((uid) => uid && !(uid in budVisits) && uvCache.has(uid));
    if (cached.length > 0) {
      setBudVisits((prev) => {
        const next = { ...prev };
        for (const uid of cached) next[uid] = uvCache.get(uid);
        return next;
      });
    }
    const missing = tasteBuds
      .map((f) => f.otherUserId)
      .filter((uid) => uid && !(uid in budVisits) && !uvCache.has(uid));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        missing.map(async (uid) => [uid, await fetchRestaurantVisitsForUser(supabase, uid)]),
      );
      if (cancelled) return;
      setBudVisits((prev) => {
        const next = { ...prev };
        for (const [uid, v] of pairs) {
          next[uid] = v;
          uvCache.set(uid, v);
        }
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [tasteBuds, budVisits]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Aggregated Taste Buds' top picks (capped at 10). */
  const topPicks = useMemo(() => {
    const fvb = tasteBuds
      .map((f) => ({ userId: f.otherUserId, visits: budVisits[f.otherUserId] }))
      .filter((x) => Array.isArray(x.visits));
    if (!fvb.length) return [];
    return aggregateFriendsTopPicks(fvb).slice(0, 10);
  }, [tasteBuds, budVisits]);

  if (!tasteBuds.length) {
    return (
      <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
        {t.topPicksEmptyNoBuds || "Follow some Taste Buds to see what they all love."}
      </p>
    );
  }

  if (!topPicks.length) {
    return (
      <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
        {t.topPicksEmptyLoading || "Loading your Taste Buds' picks…"}
      </p>
    );
  }

  return (
    <div>
      {topPicks.map((p) => (
        <TopPickRow key={p.placeId} pick={p} />
      ))}
    </div>
  );
}
