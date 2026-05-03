import { useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { scoreColor, scoreLabel } from "../../utils/scoring.js";
import { PlaceStatsSheet } from "./PlaceStatsSheet.jsx";

/**
 * One aggregated place row for the Global leaderboard.
 * Styled to match TopPickRow: flat compact row, visit count in subtitle.
 */
export function PlaceLeaderboardRow({ place, bite, display, rank, restaurantWeights, drinkWeights, sweetWeights, placeKind }) {
  const { t } = useLang();
  const [showStats, setShowStats] = useState(false);
  const isCafe = "category" in place;
  const icon = isCafe
    ? (place.category === "Sweets" ? "🥐" : place.category === "Tea" ? "🍵" : "☕")
    : (FLAGS[place.cuisine] || (place.cuisine?.[0] || "?").toUpperCase());

  const rightVal = display ? display.val : (bite != null ? bite.toFixed(2) : "—");
  const rightCol = display ? display.color : scoreColor(bite);
  const rightLbl = display ? display.label : scoreLabel(bite, t);

  const subtitleParts = [
    isCafe ? (place.category || null) : (place.cuisine || null),
    place.city || null,
    `${place.visitCount} log${place.visitCount === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", marginBottom: 6,
        background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
      }}>
        {rank != null && (
          <div style={{ width: 22, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#666663", flexShrink: 0, lineHeight: 1 }}>
            #{rank}
          </div>
        )}
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: "#252523",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={() => { if (place.placeId) setShowStats(true); }}
            style={{
              fontSize: 14, fontWeight: 500, color: "#F1EFE8",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              cursor: place.placeId ? "pointer" : undefined,
              textDecoration: place.placeId ? "underline" : undefined,
              textDecorationColor: "rgba(255,255,255,0.2)",
            }}
          >
            {place.name}
          </div>
          <div style={{ fontSize: 11, color: "#888780", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitleParts.join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: rightCol, lineHeight: 1.1 }}>
            {rightVal}
          </div>
          <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>
            {rightLbl}
          </div>
        </div>
      </div>

      {showStats && (
        <PlaceStatsSheet
          post={{
            placeId: place.placeId,
            kind: placeKind || "rest",
            name: place.name,
            cuisine: place.cuisine,
            city: place.city,
            category: place.category,
          }}
          restaurantWeights={restaurantWeights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
          onClose={() => setShowStats(false)}
        />
      )}
    </>
  );
}
