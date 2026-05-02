import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  searchUsersByUsername,
  followUser,
  unfollowUser,
  listFollows,
} from "../../utils/followsApi.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import {
  followsCache, myRestVisitsCache, getUserVisitsCache, FOLLOWS_TTL_MS,
} from "../../utils/sessionCache.js";
import { pairCompatibility } from "../../utils/compatibility.js";
import { tasteColor, weightsToPercents } from "../../utils/scoring.js";
import { Pill } from "./Pill.jsx";
import { UserIdentity } from "./UserIdentity.jsx";
import { usePaginatedList } from "../usePaginatedList.js";
import { ShowMoreButton } from "../ShowMoreButton.jsx";
import { StatusBadge, UnfollowConfirmDialog, MiniProfileSheet } from "./MiniProfileSheet.jsx";
import { PeopleGroupsSection } from "./PeopleGroupsSection.jsx";

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

const SECTIONS = [
  { key: "taste-buds", labelKey: "peopleSectionTasteBuds", icon: "🤝" },
  { key: "following",  labelKey: "peopleSectionFollowing",  icon: "👤" },
  { key: "discover",   labelKey: "peopleSectionDiscover",   icon: "🔍" },
  { key: "groups",     labelKey: "peopleSectionGroups",     icon: "🎉" },
];

const DEFAULT_SECTION = "taste-buds";

/** Alphabetical sort by display_name (fallback to username). Used by every
 *  people-list in this tab so ordering is predictable as the corpus grows. */
function byDisplayName(a, b) {
  const an = a.otherProfile?.display_name || a.otherProfile?.username || "";
  const bn = b.otherProfile?.display_name || b.otherProfile?.username || "";
  return an.localeCompare(bn);
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

/** Tier-colored pill that reads as "78% match". Tappable when onCompare is provided. */
function MatchPill({ score, suffix, onCompare }) {
  const baseStyle = {
    padding: "5px 12px", borderRadius: 999, fontSize: 11,
    whiteSpace: "nowrap", cursor: onCompare ? "pointer" : "default",
  };
  if (score == null) {
    return (
      <span
        onClick={onCompare}
        style={{ ...baseStyle, background: "transparent", color: "#888780", border: "1px solid rgba(255,255,255,0.1)" }}
      >—%</span>
    );
  }
  const col = tasteColor(score / 10);
  return (
    <span
      onClick={onCompare}
      style={{ ...baseStyle, fontSize: 12, fontWeight: 600, background: `${col}22`, color: col, border: `1px solid ${col}66` }}
    >
      {score}%{suffix ? ` ${suffix}` : ""}
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
        fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
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

/** Unified row for someone you follow (mutual or one-way). Mutual rows show
 *  green Taste Buds badge + Following pill + match%. Non-mutual rows show
 *  only the Following pill. `hideTasteBudsBadge` drops the redundant badge
 *  when rendering inside the Taste Buds sub-tab (the tab itself is the
 *  status indicator). */
function FollowRow({ entry, stats, onOpen, onUnfollowConfirm, onCompare, t, hideTasteBudsBadge = false }) {
  const profile = entry.otherProfile;
  const { isMutual } = entry;
  return (
    <div style={{ ...ROW_STYLE }}>
      <button
        type="button"
        onClick={() => onOpen?.(profile, isMutual ? "taste_buds" : "i_follow")}
        style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
      >
        <UserIdentity profile={profile} size={28} />
      </button>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {isMutual && !hideTasteBudsBadge && (
          <StatusBadge
            label={t.tasteBuds || "Taste Buds"}
            bg="#1A2E0A" color="#97C459" border="rgba(151,196,89,0.4)"
          />
        )}
        <button
          type="button"
          onClick={() => onUnfollowConfirm?.(profile, isMutual)}
          style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
            background: "rgba(155,169,213,0.1)", color: "#9BA9D5",
            border: "1px solid rgba(155,169,213,0.3)",
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {t.following || "Following"}
        </button>
        {isMutual && (
          <MatchPill score={stats?.compatScore ?? null} suffix={t.matchSuffix} onCompare={onCompare} />
        )}
      </div>
    </div>
  );
}

/** One row for a non-mutual follower (they follow me, I don't follow back). */
function FollowerRow({ entry, onFollow, onOpen, busy, t }) {
  const profile = entry.otherProfile;
  return (
    <div style={ROW_STYLE}>
      <button
        type="button"
        onClick={() => onOpen?.(profile, "they_follow")}
        style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
      >
        <UserIdentity profile={profile} size={28} />
      </button>
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
 * People tab container.
 *
 * Hosts four URL-routed sub-sections at `/community/people/:section`:
 *   - taste-buds : mutual-follow list with match %
 *   - following  : one-way follows (people you follow who don't follow back)
 *   - discover   : username search + new-followers banner
 *   - groups     : lifted from the former standalone GroupsTab
 *
 * All follow/follower fetching, debounced search, modals, and unfollow
 * confirms are owned at this level so state is shared across sections (the
 * follows cache + busy map don't need to re-mount when you switch tabs).
 *
 * `compareTarget` hand-off: tapping a user opens MiniProfileSheet whose
 * Compare action calls `onCompareWith(profile)` upward — CommunityTab then
 * navigates to /community/compare with the target pre-selected, same as
 * before. Compare is no longer a top-strip sub-tab but the route stays
 * addressable.
 */
export function PeopleTab({ user, myWeights, onCompareWith, onMarkFollowersSeen, onFollowChange, onViewLog }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = pathname.split("/")[3] || DEFAULT_SECTION;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [tasteBuds, setTasteBuds] = useState([]);
  const [busyById, setBusyById] = useState({});
  const [seenPendingCount, setSeenPendingCount] = useState(null);
  const [myVisits, setMyVisits] = useState(() =>
    myRestVisitsCache.userId === user?.id ? myRestVisitsCache.data : [],
  );
  const [budVisits, setBudVisits] = useState(() =>
    Object.fromEntries(getUserVisitsCache(user?.id)),
  );
  const [followError, setFollowError] = useState(null);
  const [openProfile, setOpenProfile] = useState(null);
  const [openRelation, setOpenRelation] = useState(null);
  const [searchUnfollowTarget, setSearchUnfollowTarget] = useState(null);
  const [inlineUnfollowTarget, setInlineUnfollowTarget] = useState(null);
  /** New Followers section is collapsible. Default state derives from the
   *  current count (expanded if there are unseen followers, collapsed if 0).
   *  Tracked here so the user can manually collapse a non-empty list. */
  const [newFollowersExpanded, setNewFollowersExpanded] = useState(true);
  const debounceRef = useRef(null);

  // Normalize unknown sub-paths back to the default.
  useEffect(() => {
    const parts = pathname.split("/");
    if (parts[2] !== "people") return;
    if (parts.length < 4 || parts[3] === "") return;
    if (!SECTIONS.find((s) => s.key === parts[3])) {
      navigate("/community/people/" + DEFAULT_SECTION, { replace: true });
    }
  }, [pathname, navigate]);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const result = await listFollows(supabase, user.id);
    setFollowing(result.following);
    setFollowers(result.followers);
    setTasteBuds(result.tasteBuds);
    followsCache.following = result.following;
    followsCache.followers = result.followers;
    followsCache.tasteBuds = result.tasteBuds;
    followsCache.fetchedAt = Date.now();
    followsCache.userId = user?.id;
  }, [user?.id]);

  // On mount, use cached follows if fresh; otherwise fetch.
  useEffect(() => {
    if (!user?.id) return;
    if (
      followsCache.userId === user?.id &&
      Date.now() - followsCache.fetchedAt < FOLLOWS_TTL_MS
    ) {
      setFollowing(followsCache.following);
      setFollowers(followsCache.followers);
      setTasteBuds(followsCache.tasteBuds);
      return;
    }
    reload();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Opening this tab clears the unseen-followers badge in the bottom nav.
   *  Runs on every mount of PeopleTab (CommunityTab unmounts inactive subs). */
  useEffect(() => {
    onMarkFollowersSeen?.();
  }, [onMarkFollowersSeen]);

  useEffect(() => {
    if (!user?.id) return;
    if (myRestVisitsCache.userId === user?.id) return; // already hydrated from initializer
    let cancelled = false;
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, user.id);
      if (!cancelled) {
        setMyVisits(v);
        myRestVisitsCache.data = v;
        myRestVisitsCache.userId = user?.id;
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /** Eagerly fetch each Taste Bud's restaurant visits for compatibility scores. */
  useEffect(() => {
    if (!tasteBuds.length) return;
    const uvCache = getUserVisitsCache(user?.id);
    const missing = tasteBuds
      .map((f) => f.otherUserId)
      .filter((uid) => uid && !(uid in budVisits) && !uvCache.has(uid));
    // Hydrate from module-level cache for buds we already have stored.
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
      const p = f.otherProfile;
      const theirWeights = p?.pref_weight_taste != null
        ? weightsToPercents({ taste: p.pref_weight_taste, bpb: p.pref_weight_bpb, wait: p.pref_weight_wait })
        : null;
      const myWeightsPct = myWeights ? weightsToPercents(myWeights) : null;
      const compat = pairCompatibility(myVisits, v, myWeightsPct, theirWeights);
      out[f.otherUserId] = {
        ratings: v.length,
        city: modeOf(v, "city"),
        compatScore: compat?.score ?? null,
      };
    }
    return out;
  }, [tasteBuds, budVisits, myVisits, myWeights]);

  /** All non-mutual followers — everyone who follows you that you haven't followed back. */
  const pendingFollowers = useMemo(
    () => followers.filter((f) => !f.isMutual).sort(byDisplayName),
    [followers],
  );

  useEffect(() => {
    if (section === "discover") setSeenPendingCount(pendingFollowers.length);
  }, [section, pendingFollowers.length]);

  /** Taste Buds (mutual) sorted alphabetically. */
  const tasteBudsSorted = useMemo(
    () => [...tasteBuds].sort(byDisplayName),
    [tasteBuds],
  );

  /** Everyone I follow, sorted alphabetically (one-way + taste buds combined). */
  const followingOnly = useMemo(
    () => [...following].sort(byDisplayName),
    [following],
  );

/** Substring match against display_name + username (lowercased). Returns
   *  true when query is empty so an unfiltered view still renders everything. */
  function matchesQuery(profile, q) {
    if (!q) return true;
    const name = (profile?.display_name || "").toLowerCase();
    const handle = (profile?.username || "").toLowerCase();
    return name.includes(q) || handle.includes(q);
  }

  /** Client-side filtered Taste Buds for the search input on the Taste Buds tab. */
  const tasteBudsFiltered = useMemo(() => {
    const q = query.trim();
    if (!q) return tasteBudsSorted;
    return tasteBudsSorted.filter((f) => matchesQuery(f.otherProfile, q));
  }, [tasteBudsSorted, query]);

  /** Client-side filtered Following for the search input on the Following tab. */
  const followingFiltered = useMemo(() => {
    const q = query.trim();
    if (!q) return followingOnly;
    return followingOnly.filter((f) => matchesQuery(f.otherProfile, q));
  }, [followingOnly, query]);

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

  const tasteBudsPage = usePaginatedList(tasteBudsFiltered, `${tasteBudsFiltered.length}|${query}`);
  const followingPage = usePaginatedList(followingFiltered, `${followingFiltered.length}|${query}`);
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

  // Search input placeholder varies per sub-section. Groups handles its
  // own search, so the shared input above the body is hidden when groups
  // is active.
  const searchPlaceholder = section === "taste-buds"
    ? (t.searchTasteBuds || "Search Taste Buds")
    : section === "following"
      ? (t.searchFollowing || "Search Following")
      : (t.searchByUsername || "Search by @username");

  return (
    <div>
      {/* Sub-section strip */}
      <div style={{
        display: "flex", background: "#252523", borderRadius: 10, padding: 3,
        gap: 2, marginBottom: 12,
      }}>
        {SECTIONS.map((s) => {
          const on = section === s.key;
          const showDot = s.key === "discover"
            && pendingFollowers.length > 0
            && section !== "discover"
            && (seenPendingCount === null || pendingFollowers.length > seenPendingCount);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => navigate("/community/people/" + s.key)}
              style={{
                flex: 1, padding: "6px 0", textAlign: "center", borderRadius: 8,
                border: "none",
                background: on ? "#3C1F13" : "transparent",
                color: on ? "#F0997B" : "#888780",
                fontSize: 11, fontWeight: on ? 700 : 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {s.icon} {t[s.labelKey] || s.key}
                {showDot && (
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#E85A5A", flexShrink: 0,
                  }} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Shared search input — Taste Buds, Following, Discover only.
          Groups has its own search bar inside PeopleGroupsSection. */}
      {section !== "groups" && (
        <div style={{ position: "relative", marginBottom: 18 }}>
          <input
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value.toLowerCase())}
            placeholder={searchPlaceholder}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }}
          />
        </div>
      )}

      {/* Taste Buds (mutual) */}
      {section === "taste-buds" && (
        <div>
          {tasteBudsSorted.length === 0 && (
            <p style={{ fontSize: 12, color: "#888780", margin: "0 0 16px" }}>
              {t.noTasteBudsYet || "No Taste Buds yet — when someone you follow follows you back, they'll show up here."}
            </p>
          )}
          {tasteBudsSorted.length > 0 && tasteBudsFiltered.length === 0 && (
            <p style={{ fontSize: 12, color: "#888780", margin: "0 0 16px" }}>
              {t.noSearchResults || "No matches."}
            </p>
          )}
          {tasteBudsPage.visible.map((f) => (
            <FollowRow
              key={f.id}
              entry={f}
              stats={budStats[f.otherUserId]}
              onOpen={openProfileSheet}
              onUnfollowConfirm={(profile, isMutual) => setInlineUnfollowTarget({ profile, isMutual })}
              onCompare={() => onCompareWith?.(f.otherProfile)}
              t={t}
              hideTasteBudsBadge
            />
          ))}
          <ShowMoreButton
            remaining={tasteBudsPage.remaining}
            pageSize={tasteBudsPage.pageSize}
            onClick={tasteBudsPage.showMore}
          />
        </div>
      )}

      {/* Following (one-way) */}
      {section === "following" && (
        <div>
          {followingOnly.length === 0 && (
            <p style={{ fontSize: 12, color: "#888780", margin: "0 0 16px" }}>
              {t.noFollowingYet || "Not following anyone yet. Find people under Discover."}
            </p>
          )}
          {followingOnly.length > 0 && followingFiltered.length === 0 && (
            <p style={{ fontSize: 12, color: "#888780", margin: "0 0 16px" }}>
              {t.noSearchResults || "No matches."}
            </p>
          )}
          {followingPage.visible.map((f) => (
            <FollowRow
              key={f.id}
              entry={f}
              onOpen={openProfileSheet}
              onUnfollowConfirm={(profile, isMutual) => setInlineUnfollowTarget({ profile, isMutual })}
              t={t}
            />
          ))}
          <ShowMoreButton
            remaining={followingPage.remaining}
            pageSize={followingPage.pageSize}
            onClick={followingPage.showMore}
          />
        </div>
      )}

      {/* Discover (remote username search + follow back) */}
      {section === "discover" && (
        <div>
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
                      <div style={{ flexShrink: 0 }}>
                        <SearchRowAction
                          profile={p}
                          relation={rel}
                          busy={busy}
                          onFollow={handleFollow}
                          onUnfollowConfirm={(profile) => setSearchUnfollowTarget(profile)}
                          t={t}
                        />
                      </div>
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
                  {t.followBack || "Follow back"}
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
                      onOpen={openProfileSheet}
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

          {!query.trim() && pendingFollowers.length === 0 && (
            <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
              {t.discoverEmpty || "Search by @username to find people. New followers will show up here too."}
            </p>
          )}
        </div>
      )}

      {/* Groups */}
      {section === "groups" && <PeopleGroupsSection user={user} />}

      {/* Modals & dialogs (shared across sections) */}
      {openProfile && (
        <MiniProfileSheet
          profile={openProfile}
          relation={openRelation}
          busy={!!busyById[openProfile.id]}
          cachedVisits={budVisits[openProfile.id]}
          onClose={closeProfileSheet}
          onCompareWith={onCompareWith}
          onUnfollow={handleSheetUnfollow}
          onFollow={async (id) => { await handleFollow(id); closeProfileSheet(); }}
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

      {inlineUnfollowTarget && (
        <UnfollowConfirmDialog
          profile={inlineUnfollowTarget.profile}
          isTasteBuds={inlineUnfollowTarget.isMutual}
          busy={!!busyById[inlineUnfollowTarget.profile.id]}
          onConfirm={async () => {
            await handleUnfollow(inlineUnfollowTarget.profile.id);
            setInlineUnfollowTarget(null);
          }}
          onCancel={() => setInlineUnfollowTarget(null)}
        />
      )}
    </div>
  );
}
