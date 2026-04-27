import { useLang } from "../contexts/LangContext.jsx";
import {
  RATING_010_BANDS,
  RATING_010_BANDS_NORMALIZED,
  formatRating010Range,
} from "../constants/ratingTiers0to10.js";

/**
 * Shared 0–10 tier legend (ranges + labels). Bands come from `ratingTiers0to10.js`:
 * default = absolute taste; `normalized` = on-screen BITE / café (ratio to max).
 *
 * @param {{ inline?: boolean, normalized?: boolean }} props — inline: one wrapped line; else stacked rows
 */
export function RatingTierLegend({ inline = false, normalized = false }) {
  const { t } = useLang();
  const bands = normalized ? RATING_010_BANDS_NORMALIZED : RATING_010_BANDS;
  const base = { fontSize: 11, color: "#888780", lineHeight: 1.6 };
  if (inline) {
    return (
      <span style={base}>
        {bands.map((seg, i) => (
          <span key={seg.translationKey}>
            {i > 0 ? " · " : null}
            <span style={{ color: "#F1EFE8" }}>{formatRating010Range(seg)}</span>
            {": "}
            {t[seg.translationKey]}
          </span>
        ))}
      </span>
    );
  }
  return (
    <div style={{ ...base, borderLeft: "2px solid rgba(255,255,255,0.1)", paddingLeft: 10 }}>
      {bands.map((seg) => (
        <div key={seg.translationKey} style={{ marginBottom: 4 }}>
          <span style={{ color: "#F1EFE8" }}>{formatRating010Range(seg)}</span>
          {": "}
          {t[seg.translationKey]}
        </div>
      ))}
    </div>
  );
}
