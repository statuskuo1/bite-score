import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  searchUsersByUsername,
  followUser,
  unfollowUser,
  listFollows,
} from "../../utils/followsApi.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import { pairCompatibility, aggregateFriendsTopPicks } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Pill } from "./Pill.jsx";
import { Avatar } from "./Avatar.jsx";
import { UserIdentity } from "./UserIdentity.jsx";

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

const SECTION_LABEL_STYLE = {
  fontSize: 11,
  color: "#F0997B",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
  marginBottom: 6,
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

/** Map followUser result codes onto user-visible reasons. */
function describeFollowError(code, t) {
  switch (code) {
    case "already_following": return t.alreadyFollowing || "Already following";
    case "self": return t.cannotFollowSelf || "You can't follow yourself";
    case "network":
    default:
      return t.followFailed || "Couldn't follow — try again.";
  }
}

/** Tier-colored pill that reads as "78% match". */
function MatchPill({ score, suffix }) {
  if (score == null) {
    return (
      <span style={{
        padding: "5px 12px", borderRadius: 999, fontSize: 11,
        background: "transparent", color: "#888780",
        border: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap",
      }}>—</span>
    );
  }
  const col = tasteColor(score / 10);
  return (
    <span style={{
      padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: `${col}22`,
      color: col,
      border: `1px solid ${col}66`,
      whiteSpace: "nowrap",
    }}>
      {score}%{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

function flagFor(cuisine, name) {
  return FLAGS[cuisine] || (cuisine?.[0] || name?.[0] || "?").toUpperCase();
}

/** Mode (most frequent) value of `field` across `rows`, ignoring blanks. */
function modeOf(rows, field) {
  const counts = new Map();
  for (const r of rows || []) {
    const v = (r?.[field] || "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return best;
}

/**
 * Follow action button. States:
 *   - "none"       → Follow button
 *   - "they_follow" → Follow back button (they follow you, you don't follow them)
 *   - "i_follow"   → Following (with unfollow)
 *   - "taste_buds" → Taste Buds label + Compare + Unfollow
 */
function FollowRowAction({ profile, relation, busy, onFollow, onUnfollow, onCompareWith, t }) {
  if (busy) return <span style={{ fontSize: 11, color: "#888780" }}>…</span>;

  switch (relation) {
    case "taste_buds":
      return (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
            background: "#1A2E0A", color: "#97C459",
            border: "1px solid rgba(151,196,89,0.4)",
          }}>
            {t.tasteBuds || "Taste Buds"}
          </span>
          {onCompareWith && (
            <Pill onClick={() => onCompareWith(profile)} tone="default">
              {t.compareSub}
            </Pill>
          )}
          <Pill onClick={() => onUnfollow(profile.id)} tone="danger">
            {t.unfollow || "Unfollow"}
          </Pill>
        </div>
      );
    case "i_follow":
      return (
        <Pill onClick={() => onUnfollow(profile.id)} tone="muted">
          {t.following || "Following"}
        </Pill>
      );
    case "they_follow":
      return (
        <Pill onClick={() => onFollow(profile.id)} tone="primary">
          {t.followBack || "Follow back"}
        </Pill>
      );
    default:
      return (
        <Pill onClick={() => onFollow(profile.id)} tone="primary">
          {t.follow || "Follow"}
        </Pill>
      );
  }
}

/** One always-visible Taste Bud card. Click → jump to Compare. */
function TasteBudRow({ entry, stats, onCompareWith }) {
  const { t } = useLang();
  const profile = entry.otherProfile;
  const subParts = [];
  if (stats?.ratings != null) {
    subParts.push(`${stats.ratings} ${t.ratingsLabel || "ratings"}`);
  }
  if (stats?.city) subParts.push(stats.city);
  const subLine = subParts.length ? subParts.join(" · ") : (profile?.username ? `@${profile.username}` : "");
  const name = profile?.display_name || profile?.username || "—";
  return (
    <button
      type="button"
      onClick={() => onCompareWith?.(profile)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", marginBottom: 8, width: "100%",
        background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 12, cursor: "pointer", textAlign: "left",
      }}
    >
      <Avatar profile={profile} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: "#F1EFE8",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{name}</div>
        <div style={{
          fontSize: 11, color: "#888780",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{subLine}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <MatchPill score={stats?.compatScore ?? null} suffix={t.matchSuffix} />
        <span style={{
          padding: "5px 12px", borderRadius: 14, fontSize: 12,
          background: "#3C1F13", color: "#F0997B",
          border: "1px solid rgba(240,153,123,0.4)", whiteSpace: "nowrap",
        }}>{t.compareSub}</span>
      </div>
    </button>
  );
}

/** One row in the aggregated "Taste Buds' top picks" section. */
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
        <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>
          {pick.friendCount} {t.tasteBudsCountSuffix || "taste buds"}
        </div>
      </div>
    </div>
  );
}

/** One row for a non-mutual follower (they follow me, I don't follow back). */
function FollowerRow({ entry, onFollow, busy, t }) {
  const profile = entry.otherProfile;
  const name = profile?.display_name || profile?.username || "—";
  return (
    <div style={ROW_STYLE}>
      <UserIdentity profile={profile} size={28} />
      {busy ? (
        <span style={{ fontSize: 11, color: "#888780" }}>…</span>
      ) : (
        <Pill onClick={() => onFollow(profile.id)} tone="primary">
          {t.followBack || "Follow back"}
        </Pill>
      )}
    </div>
  );
}

export function FriendsTab({ user, onCompareWith }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [tasteBuds, setTasteBuds] = useState([]);
  const [busyById, setBusyById] = useState({});
  const [myVisits, setMyVisits] = useState([]);
  const [budVisits, setBudVisits] = useState({});
  const [followError, setFollowError] = useState(null);
  const debounceRef = useRef(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const result = await listFollows(supabase, user.id);
    setFollowing(result.following);
    setFollowers(result.followers);
    setTasteBuds(result.tasteBuds);
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, user.id);
      if (!cancelled) setMyVisits(v);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /** Eagerly fetch each Taste Bud's restaurant visits for compatibility scores. */
  useEffect(() => {
    if (!tasteBuds.length) return;
    const missing = tasteBuds
      .map((f) => f.otherUserId)
      .filter((uid) => uid && !(uid in budVisits));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        missing.map(async (uid) => [uid, await fetchRestaurantVisitsForUser(supabase, uid)]),
      );
      if (cancelled) return;
      setBudVisits((prev) => {
        const next = { ...prev };
        for (const [uid, v] of pairs) next[uid] = v;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [tasteBuds, budVisits]);

  /** Debounced username prefix search. */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setResults([]); setSearchBusy(false); return; }
    setSearchBusy(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchUsersByUsername(supabase, q, user?.id);
      setResults(r);
      setSearchBusy(false);
    }, 220);
    return () => clearTimeout(debounceRef.current);
  }, [query, user?.id]);

  /** Map every other-user-id → their relation kind. */
  const relationByUserId = useMemo(() => {
    const m = new Map();
    // Taste buds first so they override the following/followers entries.
    for (const r of tasteBuds) m.set(r.otherUserId, "taste_buds");
    for (const r of following) {
      if (!m.has(r.otherUserId)) m.set(r.otherUserId, "i_follow");
    }
    for (const r of followers) {
      if (!m.has(r.otherUserId)) m.set(r.otherUserId, "they_follow");
    }
    return m;
  }, [following, followers, tasteBuds]);

  /** Per-Taste-Bud stats: compatibility %, ratings count, primary city. */
  const budStats = useMemo(() => {
    const out = {};
    for (const f of tasteBuds) {
      const v = budVisits[f.otherUserId];
      if (!v) {
        out[f.otherUserId] = { ratings: null, city: "", compatScore: null };
        continue;
      }
      const compat = pairCompatibility(myVisits, v);
      out[f.otherUserId] = {
        ratings: v.length,
        city: modeOf(v, "city"),
        compatScore: compat?.score ?? null,
      };
    }
    return out;
  }, [tasteBuds, budVisits, myVisits]);

  /** Aggregated Taste Buds' top picks. */
  const topPicks = useMemo(() => {
    const fvb = tasteBuds
      .map((f) => ({ userId: f.otherUserId, visits: budVisits[f.otherUserId] }))
      .filter((x) => Array.isArray(x.visits));
    if (!fvb.length) return [];
    return aggregateFriendsTopPicks(fvb).slice(0, 10);
  }, [tasteBuds, budVisits]);

  /** Non-mutual followers — people who follow me but I don't follow back. */
  const pendingFollowers = useMemo(
    () => followers.filter((f) => !f.isMutual),
    [followers],
  );

  function setBusy(id, on) {
    setBusyById((m) => ({ ...m, [id]: on }));
  }

  async function handleFollow(targetId) {
    if (!user?.id || !targetId) return;
    setFollowError(null);
    setBusy(targetId, true);
    try {
      const res = await followUser(supabase, user.id, targetId);
      if (!res?.ok) {
        setFollowError({ targetId, message: describeFollowError(res?.code, t) });
      }
      await reload();
    } catch (err) {
      console.warn("[BITE] handleFollow threw:", err);
      setFollowError({ targetId, message: describeFollowError("network", t) });
    } finally {
      setBusy(targetId, false);
    }
  }

  async function handleUnfollow(targetId) {
    if (!user?.id || !targetId) return;
    setBusy(targetId, true);
    try {
      await unfollowUser(supabase, user.id, targetId);
      await reload();
    } finally {
      setBusy(targetId, false);
    }
  }

  return (
    <div>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <input
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value.toLowerCase())}
          placeholder={t.searchByUsername}
          style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }}
        />
      </div>

      {query.trim() && (
        <div style={{ marginBottom: 16 }}>
          {searchBusy && (
            <p style={{ fontSize: 12, color: "#888780", margin: "0 0 6px" }}>…</p>
          )}
          {!searchBusy && !results.length && (
            <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noSearchResults}</p>
          )}
          {results.map((p) => {
            const rel = relationByUserId.get(p.id) || "none";
            const busy = !!busyById[p.id];
            const errForRow = followError?.targetId === p.id ? followError.message : null;
            return (
              <div key={p.id}>
                <div style={ROW_STYLE}>
                  <UserIdentity profile={p} size={28} />
                  <FollowRowAction
                    profile={p}
                    relation={rel}
                    busy={busy}
                    onFollow={handleFollow}
                    onUnfollow={handleUnfollow}
                    onCompareWith={onCompareWith}
                    t={t}
                  />
                </div>
                {errForRow && (
                  <p style={{
                    fontSize: 11, color: "#A32D2D",
                    margin: "-2px 0 8px 4px",
                  }}>
                    {errForRow}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending followers (they follow me, I don't follow back) */}
      {pendingFollowers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={SECTION_LABEL_STYLE}>
            {t.newFollowers || "New followers"}
          </div>
          {pendingFollowers.map((r) => (
            <FollowerRow
              key={r.id}
              entry={r}
              onFollow={handleFollow}
              busy={!!busyById[r.otherUserId]}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Taste Buds (mutual follows) */}
      <div style={{ ...SECTION_LABEL_STYLE, display: "flex", justifyContent: "space-between" }}>
        <span>{t.tasteBuds || "Taste Buds"}</span>
        {tasteBuds.length > 0 && (
          <span style={{ color: "#666663" }}>({tasteBuds.length})</span>
        )}
      </div>
      {!tasteBuds.length && (
        <p style={{ fontSize: 12, color: "#888780", margin: "0 0 16px" }}>
          {t.noTasteBudsYet || "No taste buds yet. Follow someone — if they follow you back, you become Taste Buds!"}
        </p>
      )}
      {tasteBuds.map((f) => (
        <TasteBudRow
          key={f.id}
          entry={f}
          stats={budStats[f.otherUserId]}
          onCompareWith={onCompareWith}
        />
      ))}

      {/* Taste Buds' top picks */}
      {topPicks.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={SECTION_LABEL_STYLE}>{t.tasteBudsTopPicks || "Taste Buds' top picks"}</div>
          {topPicks.map((p) => (
            <TopPickRow key={p.placeId} pick={p} />
          ))}
        </div>
      )}
    </div>
  );
}
