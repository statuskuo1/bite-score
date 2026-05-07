import { useMemo, useState } from "react";
import { evalBadges, BADGE_SECTIONS } from "../utils/badgeDefinitions.js";
import { SectionLabel } from "./SectionLabel.jsx";
import { S } from "../styles/sharedStyles.js";

function HexBadge({ color, bgColor, earned }) {
  const outerFill = earned ? color : "#2A2A28";
  const innerStroke = earned ? color : "#333330";
  const innerOpacity = earned ? 0.5 : 1;
  return (
    <svg viewBox="0 0 60 60" width="100%" style={{ display: "block" }}>
      {/* outer hexagon */}
      <polygon
        points="30,4 52.5,17 52.5,43 30,56 7.5,43 7.5,17"
        fill={outerFill}
      />
      {/* inner ring */}
      <polygon
        points="30,10 47.3,20 47.3,40 30,50 12.7,40 12.7,20"
        fill="none"
        stroke={innerStroke}
        strokeWidth="1.5"
        strokeOpacity={innerOpacity}
      />
      {/* pip circle */}
      <circle
        cx="49" cy="47" r="7"
        fill={earned ? bgColor : "#1E1E1C"}
        stroke={earned ? color : "#3A3A38"}
        strokeWidth="1"
      />
      <text
        x="49" y="50"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={earned ? "#F1EFE8" : "#444"}
      >
        {earned ? "✓" : "○"}
      </text>
    </svg>
  );
}

export function BadgesView({ entries, cafes, weights, questL }) {
  const badges = useMemo(
    () => evalBadges(entries, cafes, weights, questL),
    [entries, cafes, weights, questL],
  );
  const earnedCount = badges.filter(b => b.earned).length;
  const [activeBadgeId, setActiveBadgeId] = useState(null);
  const activeBadge = activeBadgeId ? badges.find(b => b.id === activeBadgeId) : null;

  return (
    <div>
      <div style={{ ...S.lbl, marginBottom: 14, color: "#888780" }}>
        {earnedCount} / 24 badges earned
      </div>

      {BADGE_SECTIONS.map(section => {
        const sectionBadges = badges.filter(b => b.section === section);
        return (
          <div key={section}>
            <SectionLabel>{section}</SectionLabel>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 20,
            }}>
              {sectionBadges.map(b => (
                <div
                  key={b.id}
                  style={{ textAlign: "center", cursor: "pointer" }}
                  onClick={() => setActiveBadgeId(b.id === activeBadgeId ? null : b.id)}
                >
                  <HexBadge color={b.color} bgColor={b.bgColor} earned={b.earned} />
                  <div style={{ fontSize: 9, color: "#888780", marginTop: 4, lineHeight: 1.3, wordBreak: "break-word" }}>
                    {b.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {activeBadge && (
        <div
          onClick={() => setActiveBadgeId(null)}
          style={{
            position: "fixed", inset: 0,
            zIndex: 400,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.55)",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 240,
              width: "calc(100vw - 48px)",
              background: "#1E1E1C",
              border: "0.5px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: 16,
              boxSizing: "border-box",
              boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: activeBadge.color, marginBottom: 4 }}>
              {activeBadge.name}
            </div>
            <div style={{ fontSize: 12, color: "#888780", lineHeight: 1.5, marginBottom: 8 }}>
              {activeBadge.desc}
            </div>
            {activeBadge.earned ? (
              <div style={{ fontSize: 11, color: "#97C459" }}>
                ✓ Earned{activeBadge.earnedDate ? ` ${activeBadge.earnedDate}` : ""}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#888780" }}>
                {activeBadge.progress}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
