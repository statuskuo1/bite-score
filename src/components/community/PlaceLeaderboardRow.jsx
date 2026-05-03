import { useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { scoreColor, scoreLabel } from "../../utils/scoring.js";
import { S } from "../../styles/sharedStyles.js";
import { PlaceStatsSheet } from "./PlaceStatsSheet.jsx";

/**
 * One aggregated place row for Global tab (restaurants / drinks / sweets).
 * Aggregates across ALL users — we deliberately don't show individual @usernames
 * here so the leaderboard reads as community-level rather than per-user.
 *
 * `bite` is computed by the parent (GlobalTab) using mean-then-BITE against
 * the viewer's current weights, so it reflects "how this place would score
 * for me under my sliders". Rendered with the normalized 0–10 tier bands
 * (`scoreColor` / `scoreLabel`) — same scale My Log uses for BITE.
 *
 * Tap toggles a collapsable detail panel that mirrors My Log's EntryCard:
 * a 3-column grid of the raw BITE inputs. Values shown here are averages
 * across all visits (`avg*` from the parent's aggregation), so each row
 * answers "what does this place look like, on average, to the community?"
 * before the viewer's weights are applied.
 */
export function PlaceLeaderboardRow({ place, bite, display, rank, restaurantWeights, drinkWeights, sweetWeights, placeKind }) {
  const { t } = useLang();
  const [exp, setExp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const isCafe = "category" in place;
  const icon = isCafe
    ? (place.category === "Sweets" ? "🥐" : place.category === "Tea" ? "🍵" : place.category === "Other" ? "☕" : "☕")
    : (FLAGS[place.cuisine] || (place.cuisine?.[0] || "?").toUpperCase());

  /** Right-side metric defaults to BITE (back-compat for any caller that
   *  doesn't pass `display`); GlobalTab passes a custom display so the metric
   *  tracks its View pill (Taste / Bang-Buck / Wait / Repeatability). */
  const rightVal = display ? display.val : (bite != null ? bite.toFixed(2) : "—");
  const rightCol = display ? display.color : scoreColor(bite);
  const rightLbl = display ? display.label : scoreLabel(bite, t);

  const subtitle = isCafe
    ? `${place.category}${place.city ? " · " + place.city : ""}`
    : `${place.cuisine || ""}${place.city ? " · " + place.city : ""}`;

  /** Format a numeric average; render an em-dash when the place has no
   *  visits with valid BITE inputs (avg = null). */
  const fmt = (v, fn) => (v == null || !Number.isFinite(v) ? "—" : fn(v));
  /** Repeatability is integer 0–3 (with a non-linear lookup); round + clamp
   *  so the avg lands on a real bucket. Mirrors `roundedRepeat` in GlobalTab. */
  const repeatBucket = place.avgRepeat == null
    ? null
    : Math.max(0, Math.min(3, Math.round(place.avgRepeat)));
  const repeatDisplay = repeatBucket == null
    ? "—"
    : place.useRMajority === false
      ? t.off
      : ("⭐".repeat(repeatBucket) || "✕");

  const expandedRows = [
    [t.taste, fmt(place.avgTaste, (v) => v.toFixed(1))],
    ["Cost", fmt(place.avgCost, (v) => "$" + v.toFixed(2))],
    [t.portions, fmt(place.avgPortions, (v) => v.toFixed(1) + "x")],
    [t.wait, fmt(place.avgWait, (v) => v.toFixed(0) + " min")],
    ["Repeat", repeatDisplay],
  ];

  return (
    <>
    <div style={{
      background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
      borderRadius: 12, marginBottom: 8,
    }}>
      <div
        onClick={() => setExp((x) => !x)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 12px", cursor: "pointer",
        }}
      >
        {rank != null && (
          <div style={{ width: 22, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#666663", flexShrink: 0, lineHeight: 1 }}>
            #{rank}
          </div>
        )}
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "#252523", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>{icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={(e) => { e.stopPropagation(); if (place.placeId) setShowStats(true); }}
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
            {subtitle}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: rightCol, lineHeight: 1.1 }}>
            {rightVal}
          </div>
          <div style={{ fontSize: 11, color: "#888780", lineHeight: 1.2 }}>{rightLbl}</div>
          <div style={{ fontSize: 11, color: "#666663", marginTop: 2 }}>
            {place.visitCount} {t.visitsCount}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#888780", marginLeft: 2 }}>{exp ? "▲" : "▼"}</div>
      </div>

      {exp && (
        <div style={{
          padding: "0 14px 12px 70px",
          borderTop: "0.5px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)",
            gap: 8, marginTop: 10,
          }}>
            {expandedRows.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: "#888780" }}>{k}</div>
                <div style={S.val}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "#666663" }}>
            {t.avg} · {place.validCount}/{place.visitCount} {t.visitsCount}
          </div>
        </div>
      )}
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
