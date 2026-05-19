import { useState } from "react";

/**
 * Full-screen choice screen shown on /add when there's no incoming pre-fill
 * context (no notif tag, no group-visit prefill, no edit "Move to" hop, no
 * restorable draft). Three color-coded cards — Restaurant (orange), Cafe
 * (green), and a non-interactive Bar coming-soon teaser. Tapping a live
 * card invokes `onPick(type)` which sets `addType` and reveals the
 * corresponding form.
 *
 * The matching "← Change" link in RestForm/CafeForm flips the choice back
 * so users can recover from picking the wrong type.
 */
export function AddEntryTypeChoice({ onPick }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#D85A30", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        New entry
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#F1EFE8", marginBottom: 6, lineHeight: 1.2 }}>
        What are you logging?
      </div>
      <div style={{ fontSize: 13, color: "#888780", lineHeight: 1.5, marginBottom: 20 }}>
        Pick the type to load the right scoring fields.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {CARDS.map((card) => (
          <ChoiceCard key={card.type} card={card} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

const CARDS = [
  {
    type: "restaurant",
    icon: "🍽️",
    tag: "RESTAURANT",
    name: "Full meal",
    desc: "Taste, portions, cost, wait, repeatability.",
    bg: "#2A1208",
    border: "#6B3018",
    hoverBg: "#3C1A0A",
    hoverBorder: "#F0997B",
    accent: "#F0997B",
    pillBg: "rgba(240,153,123,0.15)",
    pillBorder: "rgba(240,153,123,0.3)",
  },
  {
    type: "cafe",
    icon: "☕",
    tag: "CAFE",
    name: "Coffee, drinks & sweets",
    desc: "Bean origin, roast, milk level, flavor notes.",
    bg: "#0C1A10",
    border: "#1F5030",
    hoverBg: "#122216",
    hoverBorder: "#97C459",
    accent: "#97C459",
    pillBg: "rgba(151,196,89,0.15)",
    pillBorder: "rgba(151,196,89,0.3)",
  },
  {
    type: "bar",
    icon: "🍸",
    tag: "COMING SOON",
    name: "Bar",
    desc: "Cocktails, wine, beer — vibe, value, pours.",
    bg: "#141413",
    border: "rgba(255,255,255,0.12)",
    borderStyle: "dashed",
    accent: "#888780",
    pillBg: "rgba(136,135,128,0.12)",
    pillBorder: "rgba(136,135,128,0.25)",
    disabled: true,
  },
];

function ChoiceCard({ card, onPick }) {
  const [hover, setHover] = useState(false);
  const disabled = !!card.disabled;
  const active = hover && !disabled;

  const baseStyle = {
    width: "100%",
    textAlign: "left",
    padding: "22px 20px",
    borderRadius: 14,
    background: active ? card.hoverBg : card.bg,
    border: `1px ${card.borderStyle || "solid"} ${active ? card.hoverBorder : card.border}`,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    display: "flex",
    alignItems: "center",
    gap: 16,
    transition: "background 0.15s, border-color 0.15s",
    boxSizing: "border-box",
    color: "inherit",
    font: "inherit",
  };

  const content = (
    <>
      <div style={{ fontSize: 44, lineHeight: 1, flexShrink: 0 }}>{card.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          background: card.pillBg,
          color: card.accent,
          border: `0.5px solid ${card.pillBorder}`,
          marginBottom: 6,
        }}>
          {card.tag}
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, color: card.accent, marginBottom: 3, lineHeight: 1.3 }}>
          {card.name}
        </div>
        <div style={{ fontSize: 13, color: "#888780", lineHeight: 1.5 }}>
          {card.desc}
        </div>
      </div>
      {!disabled && (
        <div style={{
          fontSize: 22,
          color: card.accent,
          opacity: active ? 1 : 0.6,
          flexShrink: 0,
          lineHeight: 1,
          transition: "opacity 0.15s",
        }}>
          ›
        </div>
      )}
    </>
  );

  if (disabled) {
    return <div style={baseStyle}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onPick(card.type)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={baseStyle}
    >
      {content}
    </button>
  );
}
