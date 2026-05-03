import { useEffect, useState } from "react";
import { supabase } from "../../config/supabaseClient.js";
import { Avatar } from "./Avatar.jsx";
import { fetchUsersBiteAtPlace } from "../../utils/userBiteForPlace.js";
import { scoreColor } from "../../utils/scoring.js";

/**
 * Expanded "+N others" sheet for a feed card — lists every co-diner or
 * heart reactor on a post with each person's own BITE for the place
 * (their inputs, their weights — never viewer-adjusted).
 *
 * Sits at zIndex 310 so MiniProfileSheet (zIndex 320) stacks on top when
 * a row is tapped. Closing the profile sheet leaves this list intact;
 * the user dismisses this list separately to return to the feed.
 *
 * Props:
 *   post         — feed post (used for placeId + kind to score against)
 *   profiles     — full list of users to show (co-diners or all reactors)
 *   title        — header label ("Dined with" / "Hearts")
 *   loading      — true while caller is still fetching the full list
 *                  (e.g., reactors path pre-fetches in FeedTab)
 *   onClose      — () => void, dismiss this sheet
 *   onOpenProfile — (profile) => void, opens MiniProfileSheet on top
 */
export function OthersListSheet({ post, profiles, title, loading, onClose, onOpenProfile }) {
  const [bitesByUser, setBitesByUser] = useState(new Map());
  const [bitesLoading, setBitesLoading] = useState(true);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Re-fetch whenever the underlying profile set changes (e.g., reactors
   *  list lands after async pre-fetch). Safe-guarded against unmount. */
  useEffect(() => {
    let cancelled = false;
    if (!profiles?.length || !post?.placeId) {
      setBitesByUser(new Map());
      setBitesLoading(false);
      return () => { cancelled = true; };
    }
    setBitesLoading(true);
    const ids = profiles.map((p) => p.id).filter(Boolean);
    fetchUsersBiteAtPlace(supabase, ids, post).then((m) => {
      if (cancelled) return;
      setBitesByUser(m);
      setBitesLoading(false);
    });
    return () => { cancelled = true; };
  }, [profiles, post?.placeId, post?.kind]);

  const showSpinner = loading || (bitesLoading && !bitesByUser.size);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 310,
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
          padding: "1.25rem",
          boxSizing: "border-box",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#F1EFE8", lineHeight: 1.2 }}>
              {title || "People"}
            </div>
            {profiles?.length > 0 && (
              <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>
                {profiles.length} {profiles.length === 1 ? "person" : "people"}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 22, color: "#888780",
              background: "none", border: "none", cursor: "pointer",
              lineHeight: 1, padding: 0,
            }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Body — scrollable list */}
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, marginRight: -4, paddingRight: 4 }}>
          {showSpinner ? (
            <div style={{
              fontSize: 13, color: "#888780",
              textAlign: "center", padding: "20px 0",
            }}>
              Loading…
            </div>
          ) : !profiles?.length ? (
            <div style={{
              fontSize: 13, color: "#888780",
              textAlign: "center", padding: "20px 0",
            }}>
              No one to show.
            </div>
          ) : (
            profiles.map((p) => {
              const score = bitesByUser.get(p.id);
              const hasScore = score != null && Number.isFinite(score);
              const col = hasScore ? scoreColor(score) : "#666663";
              const interactive = typeof onOpenProfile === "function";
              const rowStyle = {
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 6px",
                background: "none",
                border: "none",
                borderRadius: 8,
                cursor: interactive ? "pointer" : "default",
                color: "inherit",
                textAlign: "left",
              };
              const inner = (
                <>
                  <Avatar profile={p} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: "#F1EFE8",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.display_name || p.username || "—"}
                    </div>
                    {p.username && p.display_name && (
                      <div style={{
                        fontSize: 11, color: "#888780", marginTop: 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        @{p.username}
                      </div>
                    )}
                  </div>
                  <div style={{
                    flexShrink: 0,
                    minWidth: 44,
                    textAlign: "right",
                    fontSize: 15,
                    fontWeight: 700,
                    color: col,
                    lineHeight: 1.1,
                  }}>
                    {hasScore ? score.toFixed(2) : "—"}
                    <div style={{
                      fontSize: 9, color: "#888780",
                      fontWeight: 500, marginTop: 2, letterSpacing: "0.04em",
                    }}>
                      BITE
                    </div>
                  </div>
                </>
              );
              return interactive ? (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenProfile(p)}
                  style={rowStyle}
                >
                  {inner}
                </button>
              ) : (
                <div key={p.id} style={rowStyle}>
                  {inner}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
