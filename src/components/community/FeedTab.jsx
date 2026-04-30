import { useNavigate } from "react-router-dom";
import { useLang } from "../../contexts/LangContext.jsx";

/**
 * Feed tab — empty state for Phase A.
 *
 * Phase A only ships the IA reorg (Feed | People | Explore). The actual
 * Strava-style chronological feed lands in Phase B; until then, every
 * visit to /community/feed renders this empty state. Once Phase B is live
 * the same component will keep using these strings as the zero-Taste-Buds
 * empty state, so the copy is written for that audience too.
 */
export function FeedTab() {
  const { t } = useLang();
  const navigate = useNavigate();
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
