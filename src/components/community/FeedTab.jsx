import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  fetchTasteBudsFeed,
  fetchCoDinersForPosts,
} from "../../utils/feedApi.js";
import {
  fetchReactionsForPosts,
  toggleHeart,
} from "../../utils/feedReactionsApi.js";
import {
  followUser,
  unfollowUser,
  getRelation,
} from "../../utils/followsApi.js";
import { FeedPostRow } from "./FeedPostRow.jsx";
import { MiniProfileSheet } from "./MiniProfileSheet.jsx";

const PAGE_SIZE = 30;

function postKey(p) {
  return `${p.kind}-${p.id}`;
}

/**
 * Date bucket label used by the section dividers between posts. Mirrors
 * the relative-date logic in FeedPostRow so the divider above a card
 * always reads the same as the card's subtitle.
 */
function dateBucket(iso) {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const now = new Date();
  const then = new Date(ts);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DateDivider({ label }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "14px 4px 12px",
    }}>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.08)" }} />
      <span style={{ fontSize: 11, color: "#888780", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
}

/**
 * Chronological feed of recent bites from the viewer's Taste Buds.
 *
 * Posts come from `fetchTasteBudsFeed`; per-post enrichments (co-diners
 * and reactions) are fetched in parallel after the main page lands, so
 * the cards render fast and fill in their dined-with row + heart count
 * a moment later.
 *
 * Tapping a post's header opens MiniProfileSheet. Tapping the heart
 * toggles the viewer's reaction (optimistic, reconciles on response).
 * Reactions are red-heart only — the schema reserves the column for
 * future variants but the UI only ever produces 'heart'.
 *
 * Pagination is server-side via a `visited_at` cursor — bud-aggregate
 * volume can grow unbounded.
 */
export function FeedTab({
  user,
  restaurantWeights,
  drinkWeights,
  sweetWeights,
  onCompareWith,
  onViewLog,
  onFollowChange,
}) {
  const { t } = useLang();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  /** Enrichments — same key shape as FeedPostRow's React `key=` so a
   *  Map.get(`${kind}-${id}`) lookup is O(1) per render. */
  const [coDinersByKey, setCoDinersByKey] = useState(new Map());
  const [reactionsByKey, setReactionsByKey] = useState(new Map());
  const [busyHeartKey, setBusyHeartKey] = useState(null);

  /** Profiles surfaced in the feed are by definition Taste Buds at fetch
   *  time, so we open the sheet with that relation immediately. A fresh
   *  `getRelation` call still runs in the background to catch cases where
   *  the user unfollowed someone mid-session. */
  const [sheetProfile, setSheetProfile] = useState(null);
  const [sheetRelation, setSheetRelation] = useState(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setPosts([]);
      setCursor(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { posts: p, nextCursor } = await fetchTasteBudsFeed(supabase, user.id, {
        limit: PAGE_SIZE,
      });
      if (cancelled) return;
      setPosts(p);
      setCursor(nextCursor);
      setLoading(false);
      enrich(p, true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /**
   * Fire-and-forget enrichment for a slice of posts (initial page or
   * "Show more" append). Both calls fail soft, so partial enrichment is
   * normal — missing entries just don't render their dined-with row /
   * heart count.
   */
  async function enrich(slice, replace) {
    if (!slice?.length || !user?.id) return;
    const [coMap, rxMap] = await Promise.all([
      fetchCoDinersForPosts(supabase, slice, user.id),
      fetchReactionsForPosts(supabase, slice, user.id),
    ]);
    setCoDinersByKey((prev) => {
      const next = replace ? new Map() : new Map(prev);
      for (const [k, v] of coMap) next.set(k, v);
      return next;
    });
    setReactionsByKey((prev) => {
      const next = replace ? new Map() : new Map(prev);
      for (const [k, v] of rxMap) next.set(k, v);
      return next;
    });
  }

  async function showMore() {
    if (!cursor || loadingMore || !user?.id) return;
    setLoadingMore(true);
    const { posts: p, nextCursor } = await fetchTasteBudsFeed(supabase, user.id, {
      before: cursor,
      limit: PAGE_SIZE,
    });
    setPosts((prev) => [...prev, ...p]);
    setCursor(nextCursor);
    setLoadingMore(false);
    enrich(p, false);
  }

  async function handleToggleHeart(post) {
    const key = postKey(post);
    if (busyHeartKey === key || !user?.id) return;
    const prev = reactionsByKey.get(key) || { count: 0, mine: false, reactors: [] };
    const willHeart = !prev.mine;

    /** Optimistic: bump count, flip mine, prepend or strip viewer's avatar. */
    const viewerProfile = {
      id: user.id,
      username: user.user_metadata?.username || "",
      display_name: user.user_metadata?.display_name || "",
      avatar_url: user.user_metadata?.avatar_url || "",
    };
    const optimistic = willHeart
      ? {
          count: prev.count + 1,
          mine: true,
          reactors: [viewerProfile, ...prev.reactors.filter((r) => r.id !== user.id)],
        }
      : {
          count: Math.max(0, prev.count - 1),
          mine: false,
          reactors: prev.reactors.filter((r) => r.id !== user.id),
        };
    setReactionsByKey((m) => {
      const next = new Map(m);
      next.set(key, optimistic);
      return next;
    });
    setBusyHeartKey(key);

    const res = await toggleHeart(supabase, user.id, post, prev.mine);
    setBusyHeartKey(null);
    if (!res) {
      /** Rollback on failure. */
      setReactionsByKey((m) => {
        const next = new Map(m);
        next.set(key, prev);
        return next;
      });
    }
  }

  async function openProfileSheet(author) {
    if (!author?.id) return;
    setSheetProfile(author);
    setSheetRelation("taste_buds");
    if (!user?.id) return;
    const rel = await getRelation(supabase, user.id, author.id);
    setSheetRelation(rel);
  }

  function closeSheet() {
    setSheetProfile(null);
    setSheetRelation(null);
  }

  async function handleFollow(targetId) {
    if (!user?.id || !targetId) return;
    setSheetBusy(true);
    const res = await followUser(supabase, user.id, targetId);
    setSheetBusy(false);
    if (res.ok) {
      onFollowChange?.();
      const rel = await getRelation(supabase, user.id, targetId);
      setSheetRelation(rel);
    }
  }

  async function handleUnfollow(targetId) {
    if (!user?.id || !targetId) return;
    setSheetBusy(true);
    await unfollowUser(supabase, user.id, targetId);
    setSheetBusy(false);
    onFollowChange?.();
    closeSheet();
  }

  if (!loading && posts.length === 0) {
    return (
      <div style={{
        padding: "32px 16px",
        textAlign: "center",
        background: "#1E1E1C",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🦗</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#F1EFE8", marginBottom: 6 }}>
          {t.feedEmptyTitle || "Hmm, crickets."}
        </div>
        <p style={{ fontSize: 12, color: "#888780", margin: "0 0 16px", lineHeight: 1.5 }}>
          {t.feedEmptyBody
            || "Your Taste Buds aren't dining out yet. When they log a bite, you'll see it here."}
        </p>
        <button
          type="button"
          onClick={() => navigate("/community/people/discover")}
          style={{
            padding: "8px 18px", borderRadius: 10,
            background: "#F0997B", color: "#141413",
            border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {t.feedEmptyCta || "Find more Taste Buds"}
        </button>
      </div>
    );
  }

  /** Walk posts in order, emitting a date divider whenever the bucket
   *  changes. The very first divider (above the first post) is omitted so
   *  the top of the feed reads as a card header, not a label. */
  let lastBucket = null;

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              background: "#1E1E1C",
              borderRadius: 14,
              height: 180,
              opacity: 0.4 + i * 0.1,
              animation: "pulse 1.2s ease-in-out infinite",
            }} />
          ))}
        </div>
      )}

      {!loading && posts.map((p) => {
        const key = postKey(p);
        const bucket = dateBucket(p.visitedAt);
        const showDivider = lastBucket !== null && bucket !== lastBucket;
        lastBucket = bucket;
        return (
          <div key={key}>
            {showDivider && <DateDivider label={bucket} />}
            <FeedPostRow
              post={p}
              restaurantWeights={restaurantWeights}
              drinkWeights={drinkWeights}
              sweetWeights={sweetWeights}
              coDiners={coDinersByKey.get(key)}
              reactionState={reactionsByKey.get(key)}
              reactionBusy={busyHeartKey === key}
              onOpenProfile={openProfileSheet}
              onToggleHeart={handleToggleHeart}
            />
          </div>
        );
      })}

      {!loading && cursor && (
        <button
          type="button"
          onClick={showMore}
          disabled={loadingMore}
          style={{
            width: "100%", padding: 10,
            background: "transparent",
            border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            color: "#888780",
            fontSize: 13,
            cursor: loadingMore ? "wait" : "pointer",
            marginTop: 8,
            opacity: loadingMore ? 0.6 : 1,
          }}
        >
          {loadingMore ? "…" : (t.showMore || "Show more")}
        </button>
      )}

      {sheetProfile && (
        <MiniProfileSheet
          profile={sheetProfile}
          relation={sheetRelation}
          busy={sheetBusy}
          onClose={closeSheet}
          onCompareWith={(p) => { closeSheet(); onCompareWith?.(p); }}
          onUnfollow={handleUnfollow}
          onFollow={handleFollow}
          onViewLog={(p) => { closeSheet(); onViewLog?.(p); }}
          t={t}
        />
      )}
    </div>
  );
}
