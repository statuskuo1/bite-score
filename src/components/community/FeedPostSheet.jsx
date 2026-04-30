import { useEffect, useState } from "react";
import { supabase } from "../../config/supabaseClient.js";
import {
  fetchVisitByIdAndType,
  fetchCoDinersForPosts,
} from "../../utils/feedApi.js";
import { fetchReactionsForPosts } from "../../utils/feedReactionsApi.js";
import { FeedPostRow } from "./FeedPostRow.jsx";

/**
 * Sheet shown when a heart-reaction notification is tapped — renders the
 * hearted post as a single feed-style card so the recipient can see what
 * their Taste Buds saw and hearted.
 *
 * The recipient is always the post owner (notifications insert hard-skips
 * self-hearts), so the card is rendered read-only:
 *   - `onToggleHeart={null}`  → no self-hearting; FeedPostRow falls back
 *     to a static heart icon + count + reactor stack.
 *   - `onOpenProfile={null}`  → no profile drilldown into yourself.
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
            coDiners={coDiners || []}
            reactionState={reactionState}
            reactionBusy={false}
            onOpenProfile={null}
            onToggleHeart={null}
          />
        )}
      </div>
    </div>
  );
}
