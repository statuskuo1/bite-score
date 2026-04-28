/**
 * Right-aligned big-number score with a tier label below it.
 * `value` can be a number (auto-formatted to 2 decimals) or a pre-formatted string.
 * Sized variants:
 *   - "lg": 22px / 11px, 600 weight  (form headers, prominent)
 *   - "md": 20px / 11px, 500 weight  (row right-side)
 *   - "sm": 16px / 10px, 500 weight  (per-visit modal items)
 */
export function ScoreDisplay({ value, label, color, size = "md" }) {
  const valSize = size === "lg" ? 22 : size === "sm" ? 16 : 20;
  const labelSize = size === "sm" ? 10 : 11;
  const valWeight = size === "lg" ? 600 : 500;
  const display = value == null
    ? "—"
    : typeof value === "number"
      ? value.toFixed(2)
      : value;
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: valSize, fontWeight: valWeight, color, lineHeight: 1 }}>
        {display}
      </div>
      {label != null && (
        <div style={{ fontSize: labelSize, color }}>{label}</div>
      )}
    </div>
  );
}
