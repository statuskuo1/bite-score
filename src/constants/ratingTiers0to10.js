/**
 * Absolute 0–10 scale (direct taste ratings, etc.).
 * Adjust `lo` / `hi` to change cutoffs; labels use translation keys on `tr`.
 * Top band [9.5, 10] includes 10; other bands are [lo, hi) except documented below.
 */

export const RATING_010_BANDS = [
  { lo: 0, hi: 2, translationKey: "sucks", color: "#A32D2D" },
  { lo: 2, hi: 4, translationKey: "meh", color: "#888780" },
  { lo: 4, hi: 7, translationKey: "average", color: "#EF9F27" },
  { lo: 7, hi: 8.5, translationKey: "goodTaste", color: "#5B9BD5" },
  { lo: 8.5, hi: 9.5, translationKey: "great", color: "#97C459" },
  { lo: 9.5, hi: 10, translationKey: "elite", color: "#97C459", hiInclusive: true },
];

/**
 * Normalized BITE / café display score = (utility ratio) × 10, where ratio = raw ÷ theoretical max.
 * Tier cutoffs follow **percent of max** (ratio × 100); same words/colors as `RATING_010_BANDS`.
 *
 * | Tier | ~% of max | 0–10 display |
 * | sucks | 0–20% | [0, 2) |
 * | meh | 20–35% | [2, 3.5) |
 * | average | 35–50% | [3.5, 5) |
 * | good | 50–65% | [5, 6.5) |
 * | great | 65–80% | [6.5, 8) |
 * | elite | 80–100% | [8, 10] |
 */
export const RATING_010_BANDS_NORMALIZED = [
  { lo: 0, hi: 2, translationKey: "sucks", color: "#A32D2D" },
  { lo: 2, hi: 3.5, translationKey: "meh", color: "#888780" },
  { lo: 3.5, hi: 5, translationKey: "average", color: "#EF9F27" },
  { lo: 5, hi: 6.5, translationKey: "goodTaste", color: "#5B9BD5" },
  { lo: 6.5, hi: 8, translationKey: "great", color: "#97C459" },
  { lo: 8, hi: 10, translationKey: "elite", color: "#97C459", hiInclusive: true },
];

function inBand(s, seg) {
  if (seg.hiInclusive) return s >= seg.lo && s <= seg.hi;
  return s >= seg.lo && s < seg.hi;
}

/** Human-readable range for legend (e.g. "0–2", "9.5–10"). */
export function formatRating010Range(seg) {
  const a = seg.lo % 1 === 0 ? String(seg.lo) : String(seg.lo);
  const b = seg.hi % 1 === 0 ? String(seg.hi) : String(seg.hi);
  return `${a}–${b}`;
}

function labelFromBands(s, tr, bands) {
  if (s === null || s === undefined || Number.isNaN(+s)) return "—";
  const x = +s;
  for (const seg of bands) {
    if (inBand(x, seg)) return tr[seg.translationKey];
  }
  return tr.sucks;
}

function colorFromBands(s, bands) {
  if (s === null || s === undefined || Number.isNaN(+s)) return "#888780";
  const x = +s;
  for (const seg of bands) {
    if (inBand(x, seg)) return seg.color;
  }
  return "#A32D2D";
}

export function label010(s, tr) {
  return labelFromBands(s, tr, RATING_010_BANDS);
}

export function color010(s) {
  return colorFromBands(s, RATING_010_BANDS);
}

/** Tier label for normalized BITE / café score (0–10 display). */
export function label010Normalized(s, tr) {
  return labelFromBands(s, tr, RATING_010_BANDS_NORMALIZED);
}

export function color010Normalized(s) {
  return colorFromBands(s, RATING_010_BANDS_NORMALIZED);
}

/** One string: "0–2: sucks · 2–4: meh · …" for FAQ / tooltips. */
export function rating010LegendInline(tr, sep = " · ") {
  return RATING_010_BANDS.map((seg) => `${formatRating010Range(seg)}: ${tr[seg.translationKey]}`).join(sep);
}

export function rating010LegendInlineNormalized(tr, sep = " · ") {
  return RATING_010_BANDS_NORMALIZED.map((seg) => `${formatRating010Range(seg)}: ${tr[seg.translationKey]}`).join(sep);
}

/** Tier rows for filters: best-first, [label, color]. */
export function rating010FilterRows(tr) {
  return [...RATING_010_BANDS].reverse().map((seg) => [tr[seg.translationKey], seg.color]);
}
