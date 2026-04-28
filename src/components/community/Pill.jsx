/**
 * Compact pill button used across community tabs (add / accept / unfriend / cancel).
 *
 * Tones encode semantic intent so callers don't repeat hex codes:
 *   - `primary` : main CTA (add friend, accept request)
 *   - `default` : secondary CTA (compare, view)
 *   - `muted`   : low-priority / cancel-style
 *   - `danger`  : destructive (decline, unfriend, leave, delete)
 */
const PALETTES = {
  primary: { bg: "#F0997B", color: "#141413", border: "#F0997B" },
  default: { bg: "#3C1F13", color: "#F0997B", border: "rgba(240,153,123,0.4)" },
  muted: { bg: "transparent", color: "#888780", border: "rgba(255,255,255,0.1)" },
  danger: { bg: "transparent", color: "#A32D2D", border: "rgba(163,45,45,0.5)" },
};

export function Pill({ children, onClick, tone = "default", disabled, type = "button" }) {
  const palette = PALETTES[tone] || PALETTES.default;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 12px",
        borderRadius: 14,
        fontSize: 12,
        background: palette.bg,
        color: palette.color,
        border: "1px solid " + palette.border,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
