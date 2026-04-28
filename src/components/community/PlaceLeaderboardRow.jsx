import { useLang } from "../../contexts/LangContext.jsx";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { tasteColor, tasteLabel } from "../../utils/scoring.js";

/**
 * One aggregated place row for Global tab (restaurants / drinks / sweets).
 * Aggregates across ALL users — we deliberately don't show individual @usernames
 * here so the leaderboard reads as community-level rather than per-user.
 */
export function PlaceLeaderboardRow({ place }) {
  const { t } = useLang();
  const isCafe = "category" in place;
  const icon = isCafe
    ? (place.category === "Sweets" ? "🥐" : place.category === "Tea" ? "🍵" : place.category === "Other" ? "☕" : "☕")
    : (FLAGS[place.cuisine] || (place.cuisine?.[0] || "?").toUpperCase());

  const avgTaste = +place.avgTaste;
  const col = tasteColor(avgTaste);
  const lbl = tasteLabel(avgTaste, t);

  const subtitle = isCafe
    ? `${place.category}${place.city ? " · " + place.city : ""}`
    : `${place.cuisine || ""}${place.city ? " · " + place.city : ""}`;

  return (
    <div style={{
      background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: "10px 12px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: "#252523", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, flexShrink: 0,
      }}>{icon}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {place.name}
        </div>
        <div style={{ fontSize: 11, color: "#888780", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: col, lineHeight: 1.1 }}>
          {avgTaste.toFixed(1)}
        </div>
        <div style={{ fontSize: 10, color: "#888780", lineHeight: 1.2 }}>{lbl}</div>
        <div style={{ fontSize: 10, color: "#666663", marginTop: 2 }}>
          {place.visitCount} {t.visitsCount}
        </div>
      </div>
    </div>
  );
}
