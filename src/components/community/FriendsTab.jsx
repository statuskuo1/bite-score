import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  searchUsersByUsername,
  followUser,
  unfollowUser,
  listFollows,
  fetchUserProfileStats,
  NEW_FOLLOWERS_WINDOW_MS,
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

/** One always-visible Taste Bud card. Tap → opens the mini profile sheet
 *  (Compare lives in there now alongside View Log + Unfollow). */
function TasteBudRow({ entry, stats, onOpen }) {
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
      onClick={() => onOpen?.(profile, "taste_buds")}
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
      </div>
    </button>
  );
}

/** Compact tap-to-open row used by the Following section (no inline action —
 *  Unfollow lives inside the mini profile sheet). */
function FollowingRow({ entry, onOpen }) {
  const profile = entry.otherProfile;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(profile, "i_follow")}
      style={{
        ...ROW_STYLE,
        width: "100%",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <UserIdentity profile={profile} size={28} />
      <span style={{ fontSize: 16, color: "#666663", flexShrink: 0 }}>›</span>
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

/** Single stat tile inside the mini profile sheet. `null` = still loading. */
function StatCell({ value, label }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "0 4px" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#F1EFE8", lineHeight: 1.1 }}>
        {value == null ? "—" : value}
      </div>
      <div style={{ fontSize: 10, color: "#888780", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
    </div>
  );
}

/**
 * Bottom-sheet overlay shown when tapping a Taste Bud or Following row.
 * Owns its own stats fetch so callers stay simple — they just hand us a
 * profile and a relation kind.
 *
 * View Log is a stub for the upcoming read-only leaderboard view; clicking
 * it surfaces an inline "Coming soon" hint instead of navigating.
 */
function MiniProfileSheet({ profile, relation, busy, onClose, onCompareWith, onUnfollow, t }) {
  const [stats, setStats] = useState(null);
  const [logHint, setLogHint] = useState(false);

  useEffect(() => {
    if (!profile?.id) { setStats(null); return; }
    let cancelled = false;
    setStats(null);
    setLogHint(false);
    (async () => {
      const s = await fetchUserProfileStats(supabase, profile.id);
      if (!cancelled) setStats(s);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  if (!profile) return null;

  const name = profile.display_name || profile.username || "—";
  const isTasteBuds = relation === "taste_buds";
  const badgeTone = isTasteBuds
    ? { bg: "#1A2E0A", color: "#97C459", border: "rgba(151,196,89,0.4)", label: t.tasteBuds || "Taste Buds" }
    : { bg: "#1F1A2E", color: "#9BA9D5", border: "rgba(155,169,213,0.4)", label: t.following || "Following" };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 320,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 640,
          background: "#1E1E1C",
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: "0.5px solid rgba(255,255,255,0.15)",
          padding: "12px 18px max(20px, env(safe-area-inset-bottom)) 18px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.2)",
          margin: "0 auto 14px",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <Avatar profile={profile} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 18, fontWeight: 600, color: "#F1EFE8",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {name}
            </div>
            <div style={{
              fontSize: 12, color: "#888780", marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              @{profile.username || "—"}
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                background: badgeTone.bg, color: badgeTone.color,
                border: `1px solid ${badgeTone.border}`,
              }}>
                {badgeTone.label}
              </span>
            </div>
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "stretch",
          background: "#141413", border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "12px 4px", marginBottom: 16,
        }}>
          <StatCell value={stats?.ratings} label={t.ratingsLabel || "ratings"} />
          <StatCell value={stats?.followers} label={t.followers || "followers"} />
          <StatCell value={stats?.following} label={t.following || "following"} />
          <StatCell value={stats?.tasteBuds} label={t.tasteBuds || "taste buds"} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={() => setLogHint(true)}
            style={{
              padding: "12px 14px", borderRadius: 10,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#F1EFE8", fontSize: 14, fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t.viewLog || "View log"}
          </button>
          {logHint && (
            <div style={{ fontSize: 11, color: "#888780", marginTop: -4, textAlign: "center" }}>
              {t.comingSoon || "Coming soon"}
            </div>
          )}

          <button
            type="button"
            onClick={() => { onCompareWith?.(profile); onClose?.(); }}
            style={{
              padding: "12px 14px", borderRadius: 10,
              background: "#3C1F13",
              border: "1px solid rgba(240,153,123,0.4)",
              color: "#F0997B", fontSize: 14, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.compareSub || "Compare"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onUnfollow?.(profile.id)}
            style={{
              padding: "12px 14px", borderRadius: 10,
              background: "transparent",
              border: "1px solid rgba(163,45,45,0.5)",
              color: "#A32D2D", fontSize: 14, fontWeight: 500,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "…" : (t.unfollow || "Unfollow")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FriendsTab({ user, onCompareWith, onMarkFollowersSeen, onFollowChange }) {
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
  const [openProfile, setOpenProfile] = useState(null);
  const [openRelation, setOpenRelation] = useState(null);
  /** New Followers section is collapsible. Default state derives from the
   *  current count (expanded if there are unseen followers, collapsed if 0).
   *  Tracked here so the user can manually collapse a non-empty list. */
  const [newFollowersExpanded, setNewFollowersExpanded] = useState(true);
  const debounceRef = useRef(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const result = await listFollows(supabase, user.id);
    setFollowing(result.following);
    setFollowers(result.followers);
    setTasteBuds(result.tasteBuds);
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);

  /** Opening this sub-tab clears the unseen-followers badge in the bottom nav.
   *  Runs on every mount of FriendsTab (CommunityTab unmounts inactive subs). */
  useEffect(() => {
    onMarkFollowersSeen?.();
  }, [onMarkFollowersSeen]);

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

  /** New followers — non-mutual follow rows from the last 7 days. After the
   *  window expires the row drops off this list (the person is still a
   *  follower, just not "new" anymore). Mirrors `countUnseenFollowers`. */
  const pendingFollowers = useMemo(() => {
    const cutoff = Date.now() - NEW_FOLLOWERS_WINDOW_MS;
    return followers.filter((f) => {
      if (f.isMutual) return false;
      const ts = f.createdAt ? new Date(f.createdAt).getTime() : 0;
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }, [followers]);

  /** Auto-collapse when the count flips to 0 / auto-expand when it returns.
   *  Manual toggles still win for the rest of the session. */
  const lastNonZeroPendingRef = useRef(pendingFollowers.length > 0);
  useEffect(() => {
    const hasAny = pendingFollowers.length > 0;
    if (hasAny !== lastNonZeroPendingRef.current) {
      lastNonZeroPendingRef.current = hasAny;
      setNewFollowersExpanded(hasAny);
    }
  }, [pendingFollowers.length]);

  /** Non-mutual following — people I follow who haven't followed me back. */
  const nonMutualFollowing = useMemo(
    () => following.filter((f) => !f.isMutual),
    [following],
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
      onFollowChange?.();
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
      onFollowChange?.();
    } finally {
      setBusy(targetId, false);
    }
  }

  function openProfileSheet(profile, relation) {
    if (!profile) return;
    setOpenProfile(profile);
    setOpenRelation(relation);
  }

  function closeProfileSheet() {
    setOpenProfile(null);
    setOpenRelation(null);
  }

  /** Wraps `handleUnfollow` so the sheet closes after the row disappears. */
  async function handleSheetUnfollow(targetId) {
    await handleUnfollow(targetId);
    closeProfileSheet();
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

      {/* New followers (collapsible bar; auto-expires after 7 days) */}
      {pendingFollowers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setNewFollowersExpanded((v) => !v)}
            aria-expanded={newFollowersExpanded}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 12px",
              background: "#1E1E1C",
              border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: 12, cursor: "pointer", color: "#F1EFE8",
              textAlign: "left",
            }}
          >
            <span style={{
              minWidth: 22, height: 22, padding: "0 6px",
              borderRadius: 11, background: "#E85A5A",
              color: "#FFF", fontSize: 11, fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, boxSizing: "border-box",
            }}>
              {pendingFollowers.length > 99 ? "99+" : pendingFollowers.length}
            </span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F1EFE8" }}>
              {t.newFollowers || "New followers"}
            </span>
            <span style={{
              fontSize: 14, color: "#888780",
              transform: newFollowersExpanded ? "rotate(90deg)" : "none",
              transition: "transform 0.15s",
              display: "inline-block", lineHeight: 1,
            }}>
              ›
            </span>
          </button>
          {newFollowersExpanded && (
            <div style={{ marginTop: 8 }}>
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
          onOpen={openProfileSheet}
        />
      ))}

      {/* Following (I follow them, they haven't followed back) */}
      {nonMutualFollowing.length > 0 && (
        <div style={{ marginTop: 18, marginBottom: 16 }}>
          <div style={SECTION_LABEL_STYLE}>
            {t.following || "Following"}
          </div>
          {nonMutualFollowing.map((r) => (
            <FollowingRow
              key={r.id}
              entry={r}
              onOpen={openProfileSheet}
            />
          ))}
        </div>
      )}

      {/* Taste Buds' top picks */}
      {topPicks.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={SECTION_LABEL_STYLE}>{t.tasteBudsTopPicks || "Taste Buds' top picks"}</div>
          {topPicks.map((p) => (
            <TopPickRow key={p.placeId} pick={p} />
          ))}
        </div>
      )}

      {openProfile && (
        <MiniProfileSheet
          profile={openProfile}
          relation={openRelation}
          busy={!!busyById[openProfile.id]}
          onClose={closeProfileSheet}
          onCompareWith={onCompareWith}
          onUnfollow={handleSheetUnfollow}
          t={t}
        />
      )}
    </div>
  );
}
