import { useEffect, useState } from "react";
import { supabase } from "../../config/supabaseClient.js";
import {
  fetchVisitByIdAndType,
  fetchCoDinersForPosts,
} from "../../utils/feedApi.js";
import { fetchReactionsForPosts, toggleHeart } from "../../utils/feedReactionsApi.js";
import { FeedPostRow } from "./FeedPostRow.jsx";

/**
 * Sheet shown for notification deep-links — renders a single visit as a
 * feed-style card. Used as a fallback for tag-back notifications when the
 * referenced post isn't in the viewer's Taste Buds feed (non-mutual
 * follow), and as the primary surface for heart-reaction notifications.
 *
 * Heart behavior:
 *   - viewer == post owner (heart-reaction case): `onToggleHeart={null}`
 *     and FeedPostRow renders a static heart icon + count + reactor stack.
 *     We can't self-heart.
 *   - viewer != post owner (tag-back fallback): wires a local optimistic
 *     toggle so the recipient can like the surfaced post.
 *
 * Loads three things in parallel after mount: the visit row itself
 * (`fetchVisitByIdAndType`), co-diners (`fetch_co_diners_for_entries`
 * RPC), and the reaction state for the viewer. All three fail soft —
 * a missing co-diners or reactions fetch just hides those rows.
 *
 * Visual: centered modal, dark backdrop, click-outside dismiss, body
 * scroll lock — same pattern as `MiniProfileSheet`.
 */
export function FeedPostSheet({
  postId,
  postType,
  viewerId,
  restaurantWeights,
  drinkWeights,
  sweetWeights,
  onClose,
}) {
  const [post, setPost] = useState(null);
  const [coDiners, setCoDiners] = useState(null);
  const [reactionState, setReactionState] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | missing
  const [heartBusy, setHeartBusy] = useState(false);

  useEffect(() => {
    if (!postId || !postType) {
      setStatus("missing");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    (async () => {
      const p = await fetchVisitByIdAndType(supabase, postId, postType);
      if (cancelled) return;
      if (!p) {
        setStatus("missing");
        return;
      }
      setPost(p);
      setStatus("ready");

      /** Enrichments are optional — render the card immediately and let
       *  these fill in. Both helpers expect a posts array. */
      const [coMap, rxMap] = await Promise.all([
        fetchCoDinersForPosts(supabase, [p], viewerId),
        fetchReactionsForPosts(supabase, [p], viewerId),
      ]);
      if (cancelled) return;
      const key = `${p.kind}-${p.id}`;
      setCoDiners(coMap.get(key) || []);
      setReactionState(rxMap.get(key) || { count: 0, mine: false, reactors: [] });
    })();
    return () => { cancelled = true; };
  }, [postId, postType, viewerId]);

  /** Lock body scroll while the sheet is open, matching MiniProfileSheet. */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /** Optimistic heart toggle — mirrors FeedTab.handleToggleHeart but writes
   *  into the local single-post reaction state. Only wired when the viewer
   *  is not the post owner (self-hearts are disallowed at the API layer
   *  anyway). */
  const canHeart = !!(viewerId && post?.ownerId && viewerId !== post.ownerId);
  async function handleToggleHeart(p) {
    if (!canHeart || heartBusy) return;
    const prev = reactionState || { count: 0, mine: false, reactors: [] };
    const willHeart = !prev.mine;
    const viewerProfile = { id: viewerId, username: "", display_name: "", avatar_url: "" };
    const optimistic = willHeart
      ? {
          count: prev.count + 1,
          mine: true,
          reactors: [viewerProfile, ...prev.reactors.filter((r) => r.id !== viewerId)],
        }
      : {
          count: Math.max(0, prev.count - 1),
          mine: false,
          reactors: prev.reactors.filter((r) => r.id !== viewerId),
        };
    setReactionState(optimistic);
    setHeartBusy(true);
    const res = await toggleHeart(supabase, viewerId, p, prev.mine);
    setHeartBusy(false);
    if (!res) setReactionState(prev);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 320,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.25rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          maxHeight: "calc(100vh - 2.5rem)",
          overflowY: "auto",
          background: "#141413",
          borderRadius: 16,
          border: "0.5px solid rgba(255,255,255,0.15)",
          padding: "0.75rem",
          boxSizing: "border-box",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              fontSize: 22, color: "#888780",
              background: "none", border: "none",
              cursor: "pointer", lineHeight: 1, padding: "4px 8px",
            }}
          >
            ×
          </button>
        </div>

        {status === "loading" && (
          <div style={{
            background: "#1E1E1C",
            borderRadius: 14,
            height: 220,
            opacity: 0.6,
            animation: "pulse 1.2s ease-in-out infinite",
          }} />
        )}

        {status === "missing" && (
          <div style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "#888780",
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            Couldn't load that post. It may have been removed.
          </div>
        )}

        {status === "ready" && post && (
          <FeedPostRow
            post={post}
            restaurantWeights={restaurantWeights}
            drinkWeights={drinkWeights}
            sweetWeights={sweetWeights}
            viewerId={viewerId}
            coDiners={coDiners || []}
            reactionState={reactionState}
            reactionBusy={heartBusy}
            onOpenProfile={null}
            onToggleHeart={canHeart ? handleToggleHeart : null}
          />
        )}
      </div>
    </div>
  );
}
