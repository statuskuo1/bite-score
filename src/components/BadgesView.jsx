import { useMemo, useState } from "react";
import { evalBadges, BADGE_SECTIONS } from "../utils/badgeDefinitions.js";
import { SectionLabel } from "./SectionLabel.jsx";
import { S } from "../styles/sharedStyles.js";

function hexagonPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    pts.push((cx + r * Math.cos(a)).toFixed(2) + "," + (cy + r * Math.sin(a)).toFixed(2));
  }
  return "M" + pts.join("L") + "Z";
}

export function BadgeSVG({ emoji, earned, color, border, bg }) {
  const cx = 32, cy = 36, r = 28;
  const path = hexagonPath(cx, cy, r);
  const innerPath = hexagonPath(cx, cy, r - 5);
  const opacity = earned ? 1 : 0.35;
  return (
    <svg viewBox="0 0 64 72" width={64} height={72} xmlns="http://www.w3.org/2000/svg">
      <path d={path} fill={bg} stroke={border} strokeWidth="1.5" opacity={opacity} />
      {earned && <path d={innerPath} fill="none" stroke={border} strokeWidth="0.5" opacity="0.4" />}
      <text x="32" y="41" textAnchor="middle" fontSize="20" opacity={opacity}>{emoji}</text>
      {earned
        ? <><circle cx="52" cy="58" r="8" fill={color} /><text x="52" y="62" textAnchor="middle" fontSize="10" fill="#141413">✓</text></>
        : <><circle cx="52" cy="58" r="8" fill="#1E1E1C" stroke={border} strokeWidth="0.5" opacity="0.5" /><text x="52" y="62" textAnchor="middle" fontSize="9" fill="#888780">🔒</text></>
      }
    </svg>
  );
}

export function BadgesView({ entries, cafes, weights, questL, followingCount = 0, tasteBudCount = 0 }) {
  const badges = useMemo(
    () => evalBadges(entries, cafes, weights, questL, followingCount, tasteBudCount),
    [entries, cafes, weights, questL, followingCount, tasteBudCount],
  );
  const earnedCount = badges.filter(b => b.earned).length;
  const [activeBadgeId, setActiveBadgeId] = useState(null);
  const activeBadge = activeBadgeId ? badges.find(b => b.id === activeBadgeId) : null;

  return (
    <div>
      <div style={{ ...S.lbl, marginBottom: 14, color: "#888780" }}>
        {earnedCount} / {badges.length} badges earned
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
                  <BadgeSVG emoji={b.emoji} earned={b.earned} color={b.color} border={b.color} bg={b.bgColor} />
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
