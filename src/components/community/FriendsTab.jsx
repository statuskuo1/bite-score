import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  searchUsersByUsername,
  followUser,
  unfollowUser,
  listFollows,
  NEW_FOLLOWERS_WINDOW_MS,
} from "../../utils/followsApi.js";
import { fetchRestaurantVisitsForUser, computeFoodStats } from "../../utils/visitPlacesApi.js";
import { pairCompatibility, aggregateFriendsTopPicks } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Pill } from "./Pill.jsx";
import { Avatar } from "./Avatar.jsx";
import { UserIdentity } from "./UserIdentity.jsx";
import { usePaginatedList } from "../usePaginatedList.js";
import { ShowMoreButton } from "../ShowMoreButton.jsx";
import { FoodStatsBlock } from "../FoodStatsBlock.jsx";

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

/** Alphabetical sort by display_name (fallback to username). Used by every
 *  people-list in this tab so ordering is predictable as the corpus grows. */
function byDisplayName(a, b) {
  const an = a.otherProfile?.display_name || a.otherProfile?.username || "";
  const bn = b.otherProfile?.display_name || b.otherProfile?.username || "";
  return an.localeCompare(bn);
}

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

/** Small inline badge span — purely informational, no interaction. */
function StatusBadge({ label, bg, color, border }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
      background: bg, color, border: `1px solid ${border}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

/**
 * Inline actions on search result rows.
 *
 * - none       → Follow button
 * - they_follow → Follow Back button
 * - i_follow   → tappable "Following" badge (opens unfollow confirm on click)
 * - taste_buds → non-tappable "Taste Buds" info tag + tappable "Following" badge
 *
 * All interactive elements stopPropagation so the row's own onClick (open sheet)
 * doesn't also fire.
 */
function SearchRowAction({ profile, relation, busy, onFollow, onUnfollowConfirm, t }) {
  if (busy) return <span style={{ fontSize: 11, color: "#888780" }}>…</span>;

  const followingBadge = (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onUnfollowConfirm(profile); }}
      style={{
        fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
        background: "rgba(155,169,213,0.1)", color: "#9BA9D5",
        border: "1px solid rgba(155,169,213,0.3)",
        whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer",
      }}
    >
      {t.following || "Following"}
    </button>
  );

  switch (relation) {
    case "taste_buds":
      return (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
          <StatusBadge
            label={t.tasteBuds || "Taste Buds"}
            bg="#1A2E0A" color="#97C459" border="rgba(151,196,89,0.4)"
          />
          {followingBadge}
        </div>
      );
    case "i_follow":
      return followingBadge;
    case "they_follow":
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <Pill onClick={() => onFollow(profile.id)} tone="primary">
            {t.followBack || "Follow back"}
          </Pill>
        </div>
      );
    default:
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <Pill onClick={() => onFollow(profile.id)} tone="primary">
            {t.follow || "Follow"}
          </Pill>
        </div>
      );
  }
}

/** Confirmation dialog rendered on top of MiniProfileSheet (or inline in search).
 *  `isTasteBuds` changes the message to warn about losing the mutual connection. */
function UnfollowConfirmDialog({ profile, isTasteBuds, busy, onConfirm, onCancel }) {
  const username = profile?.username ? `@${profile.username}` : profile?.display_name || "this person";
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 320,
          background: "#1E1E1C",
          borderRadius: 14,
          border: "0.5px solid rgba(255,255,255,0.15)",
          padding: "20px",
          boxSizing: "border-box",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ fontSize: 14, color: "#F1EFE8", fontWeight: 600, marginBottom: 8 }}>
          Unfollow {username}?
        </div>
        {isTasteBuds && (
          <div style={{ fontSize: 13, color: "#888780", marginBottom: 16, lineHeight: 1.5 }}>
            This will remove your Taste Buds connection.
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: isTasteBuds ? 0 : 16 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 10,
              background: "transparent", border: "0.5px solid rgba(255,255,255,0.2)",
              color: "#C4C2BA", fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 10,
              background: "transparent", border: "1px solid rgba(163,45,45,0.5)",
              color: busy ? "#888780" : "#A32D2D",
              fontSize: 14, fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "…" : "Unfollow"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One Taste Bud row. Same compact layout as FollowingRow; MatchPill on the right. */
function TasteBudRow({ entry, stats, onOpen }) {
  const { t } = useLang();
  const profile = entry.otherProfile;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(profile, "taste_buds")}
      style={{ ...ROW_STYLE, width: "100%", cursor: "pointer", textAlign: "left" }}
    >
      <UserIdentity profile={profile} size={28} />
      <MatchPill score={stats?.compatScore ?? null} suffix={t.matchSuffix} />
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


/**
 * Bottom-sheet overlay shown when tapping a Taste Bud or Following row.
 * Owns its own stats fetch so callers stay simple — they just hand us a
 * profile and a relation kind.
 *
 * View Log closes the sheet and hands the profile back to the caller, which
 * swaps in the read-only `UserLogView` for that user.
 */
function MiniProfileSheet({ profile, relation, busy, cachedVisits, onClose, onCompareWith, onUnfollow, onViewLog, t }) {
  const [stats, setStats] = useState(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);

  useEffect(() => {
    if (!profile?.id) { setStats(null); return; }
    if (cachedVisits) { setStats(computeFoodStats(cachedVisits)); return; }
    let cancelled = false;
    setStats(null);
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, profile.id);
      if (!cancelled) setStats(computeFoodStats(v));
    })();
    return () => { cancelled = true; };
  }, [profile?.id, cachedVisits]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!profile) return null;

  const name = profile.display_name || profile.username || "—";
  const canCompare = relation === "taste_buds" || relation === "i_follow";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.78)",
          zIndex: 320,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 360,
            background: "#1E1E1C",
            borderRadius: 16,
            border: "0.5px solid rgba(255,255,255,0.15)",
            padding: "1.35rem",
            boxSizing: "border-box",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ fontSize: 22, color: "#888780", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}
            >×</button>
          </div>

          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <Avatar profile={profile} size={56} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8", lineHeight: 1.2 }}>
              {name}
            </div>
            <div style={{ fontSize: 13, color: "#C4C2BA", marginTop: 3 }}>
              @{profile.username || "–"}
            </div>
            {(relation === "taste_buds" || relation === "i_follow") && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                {relation === "taste_buds" && (
                  <StatusBadge
                    label={t.tasteBuds || "Taste Buds"}
                    bg="#1A2E0A" color="#97C459" border="rgba(151,196,89,0.4)"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setConfirmUnfollow(true)}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                    background: "rgba(155,169,213,0.1)", color: "#9BA9D5",
                    border: "1px solid rgba(155,169,213,0.3)",
                    cursor: "pointer",
                  }}
                >
                  {t.following || "Following"}
                </button>
              </div>
            )}
            {relation === "they_follow" && (
              <div style={{ marginTop: 8 }}>
                <StatusBadge label="Follows you" bg="#252523" color="#888780" border="rgba(255,255,255,0.15)" />
              </div>
            )}
          </div>

          <FoodStatsBlock stats={stats} style={{ marginBottom: 14 }} />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => { onViewLog?.(profile); onClose?.(); }}
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 10,
                background: "#3C1F13", border: "1px solid rgba(240,153,123,0.4)",
                color: "#F0997B", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {t.viewLog || "View log"}
            </button>
            {canCompare && (
              <button
                type="button"
                onClick={() => { onCompareWith?.(profile); onClose?.(); }}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 10,
                  background: "transparent", border: "0.5px solid rgba(255,255,255,0.2)",
                  color: "#C4C2BA", fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                {t.compareSub || "Compare"}
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmUnfollow && (
        <UnfollowConfirmDialog
          profile={profile}
          isTasteBuds={relation === "taste_buds"}
          busy={busy}
          onConfirm={() => { onUnfollow?.(profile.id); setConfirmUnfollow(false); }}
          onCancel={() => setConfirmUnfollow(false)}
        />
      )}
    </>
  );
}

export function FriendsTab({ user, onCompareWith, onMarkFollowersSeen, onFollowChange, onViewLog }) {
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
  const [searchUnfollowTarget, setSearchUnfollowTarget] = useState(null);
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
    return followers
      .filter((f) => {
        if (f.isMutual) return false;
        const ts = f.createdAt ? new Date(f.createdAt).getTime() : 0;
        return Number.isFinite(ts) && ts >= cutoff;
      })
      .sort(byDisplayName);
  }, [followers]);

  /** Alphabetical Taste Buds. Plain `.sort` mutates, so spread first. */
  const tasteBudsSorted = useMemo(
    () => [...tasteBuds].sort(byDisplayName),
    [tasteBuds],
  );

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
    () => following.filter((f) => !f.isMutual).sort(byDisplayName),
    [following],
  );

  /** Paginated tails for the three people-lists. No sort/filter UI on this
   *  tab so the only natural reset is when the source array's size changes. */
  const tasteBudsPage = usePaginatedList(tasteBudsSorted, String(tasteBudsSorted.length));
  const followingPage = usePaginatedList(nonMutualFollowing, String(nonMutualFollowing.length));
  const pendingFollowersPage = usePaginatedList(pendingFollowers, String(pendingFollowers.length));

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
                <button
                  type="button"
                  onClick={() => openProfileSheet(p, rel)}
                  style={{ ...ROW_STYLE, width: "100%", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <UserIdentity profile={p} size={28} />
                  </div>
                  <SearchRowAction
                    profile={p}
                    relation={rel}
                    busy={busy}
                    onFollow={handleFollow}
                    onUnfollowConfirm={(profile) => setSearchUnfollowTarget(profile)}
                    t={t}
                  />
                </button>
                {errForRow && (
                  <p style={{ fontSize: 11, color: "#A32D2D", margin: "-2px 0 8px 4px" }}>
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
              {pendingFollowersPage.visible.map((r) => (
                <FollowerRow
                  key={r.id}
                  entry={r}
                  onFollow={handleFollow}
                  busy={!!busyById[r.otherUserId]}
                  t={t}
                />
              ))}
              <ShowMoreButton
                remaining={pendingFollowersPage.remaining}
                pageSize={pendingFollowersPage.pageSize}
                onClick={pendingFollowersPage.showMore}
              />
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
      {tasteBudsPage.visible.map((f) => (
        <TasteBudRow
          key={f.id}
          entry={f}
          stats={budStats[f.otherUserId]}
          onOpen={openProfileSheet}
        />
      ))}
      <ShowMoreButton
        remaining={tasteBudsPage.remaining}
        pageSize={tasteBudsPage.pageSize}
        onClick={tasteBudsPage.showMore}
      />

      {/* Following (I follow them, they haven't followed back) */}
      {nonMutualFollowing.length > 0 && (
        <div style={{ marginTop: 18, marginBottom: 16 }}>
          <div style={SECTION_LABEL_STYLE}>
            {t.following || "Following"}
          </div>
          {followingPage.visible.map((r) => (
            <FollowingRow
              key={r.id}
              entry={r}
              onOpen={openProfileSheet}
            />
          ))}
          <ShowMoreButton
            remaining={followingPage.remaining}
            pageSize={followingPage.pageSize}
            onClick={followingPage.showMore}
          />
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
          cachedVisits={budVisits[openProfile.id]}
          onClose={closeProfileSheet}
          onCompareWith={onCompareWith}
          onUnfollow={handleSheetUnfollow}
          onViewLog={onViewLog}
          t={t}
        />
      )}

      {searchUnfollowTarget && (
        <UnfollowConfirmDialog
          profile={searchUnfollowTarget}
          isTasteBuds={relationByUserId.get(searchUnfollowTarget.id) === "taste_buds"}
          busy={!!busyById[searchUnfollowTarget.id]}
          onConfirm={async () => {
            await handleUnfollow(searchUnfollowTarget.id);
            setSearchUnfollowTarget(null);
          }}
          onCancel={() => setSearchUnfollowTarget(null)}
        />
      )}
    </div>
  );
}
