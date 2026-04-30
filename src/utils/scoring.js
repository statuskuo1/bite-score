import { T } from "../translations.js";
import {
  color010,
  color010Normalized,
  label010,
  label010Normalized,
} from "../constants/ratingTiers0to10.js";
import { toUSD } from "./currency.js";

export function rMult(r) {
  return r === 3 ? 0.4 : r === 2 ? 0.2 : r === 1 ? 0 : -0.3;
}
export function applyR(base, r) {
  return Math.round((base + Math.abs(base) * rMult(r)) * 100) / 100;
}

/**
 * Taste / Bang-Buck / Wait as fractions that sum to 1.
 * Sliders are independent 0–100; ratios follow relative sizes (same as /100 when sum is 100).
 */
export function restaurantWeightRatios(wts) {
  const wt = wts || { taste: 50, bpb: 40, wait: 10 };
  const a = Math.max(0, Number(wt.taste) || 0);
  const b = Math.max(0, Number(wt.bpb) || 0);
  const c = Math.max(0, Number(wt.wait) || 0);
  const s = a + b + c;
  if (s <= 0) return { rt: 0.5, rb: 0.4, rw: 0.1 };
  return { rt: a / s, rb: b / s, rw: c / s };
}

/** Raw BITE utility (weight-dependent magnitude). currencyCode converts cost to USD before scoring. */
export function calcBite(t, cost, portions, w, useR, r, wts, currencyCode = "USD") {
  if (!portions) return null;
  const costUSD = toUSD(cost, currencyCode);
  const bpb = (costUSD / portions) / 20;
  const wp = Math.min(10, (Math.log(w + 1) / Math.log(121)) * 10);
  const { rt, rb, rw } = restaurantWeightRatios(wts);
  const base = rt * t - rb * bpb - rw * wp;
  return useR ? applyR(base, r) : Math.round(base * 100) / 100;
}

/** Theoretical best raw BITE for these weights (taste 10, no bpb/wait drag, 3★). Same pipeline as calcBite. */
export function calcMaxBite(wts) {
  return calcBite(10, 0, 1, 0, true, 3, wts);
}

/**
 * Fraction of theoretical max utility (0–1). Same as BITE_raw ÷ BITE_max; negative raw maps to 0.
 */
export function biteUtilityRatio(raw, max) {
  if (raw === null || max === null || max <= 0) return null;
  const r = raw / max;
  return Math.min(1, Math.max(0, r));
}

/** Display score 0–10 from utility ratio (ratio × 10, rounded). */
export function utilityRatioToOutOf10(ratio) {
  if (ratio === null || ratio === undefined) return null;
  const scaled = ratio * 10;
  return Math.round(Math.min(10, Math.max(0, scaled)) * 100) / 100;
}

/** Restaurant: utility ratio for current weights (0–1), or null. */
export function calcBiteUtilityRatio(t, cost, portions, w, useR, r, wts, currencyCode = "USD") {
  const raw = calcBite(t, cost, portions, w, useR, r, wts, currencyCode);
  const max = calcMaxBite(wts);
  return biteUtilityRatio(raw, max);
}

/** BITE on 0–10: normalized utility ratio × 10 (see `biteUtilityRatio`). */
export function calcBiteOutOf10(t, cost, portions, w, useR, r, wts, currencyCode = "USD") {
  return utilityRatioToOutOf10(calcBiteUtilityRatio(t, cost, portions, w, useR, r, wts, currencyCode));
}

/** Mean BITE (0–10) over visits; uses each entry's currency_code for correct USD conversion. */
export function meanRestaurantBiteOutOf10(entries, wts) {
  let sum = 0;
  let n = 0;
  for (const e of entries) {
    const v = calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, wts, e.currency_code || "USD");
    if (v != null && !Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

/** Defaults for café (drinks + sweets) weight sliders. Independent from restaurants. */
export const CAFE_WEIGHT_DEFAULTS = { taste: 70, bpb: 20, wait: 10 };

/**
 * Raw café score with parameterized weights. Same blend shape as restaurants
 * (`rt*t − rb*bpb − rw*wp`) but two cafe-specific calibrations:
 *   - bpb divisor `/5.25` keeps bang/buck meaningful for cheaper items (in USD)
 *   - wait curve uses `log(31)` so it saturates around 30 min instead of 120
 */
export function calcCafe(t, cost, portions, wait, useR, r, wts, currencyCode = "USD") {
  if (!portions) return null;
  const costUSD = toUSD(cost, currencyCode);
  const bpb = (costUSD / portions) / 5.25;
  const wp = Math.min(10, (Math.log(wait + 1) / Math.log(31)) * 10);
  const { rt, rb, rw } = restaurantWeightRatios(wts || CAFE_WEIGHT_DEFAULTS);
  const base = rt * t - rb * bpb - rw * wp;
  return useR ? applyR(base, r) : Math.round(base * 100) / 100;
}

/** Best raw café score for these weights (same pipeline as calcCafe). */
export function calcCafeMax(wts) {
  return calcCafe(10, 0, 1, 0, true, 3, wts);
}

/** Café: utility ratio (0–1), or null. */
export function calcCafeUtilityRatio(t, cost, portions, wait, useR, r, wts, currencyCode = "USD") {
  const raw = calcCafe(t, cost, portions, wait, useR, r, wts, currencyCode);
  const max = calcCafeMax(wts);
  return biteUtilityRatio(raw, max);
}

/** Café BITE on 0–10: normalized ratio × 10. */
export function calcCafeOutOf10(t, cost, portions, wait, useR, r, wts, currencyCode = "USD") {
  return utilityRatioToOutOf10(calcCafeUtilityRatio(t, cost, portions, wait, useR, r, wts, currencyCode));
}

/** Tier color for normalized BITE / café 0–10 (ratio to theoretical best). */
export function scoreColor(s) {
  return color010Normalized(s);
}

/** Tier label for normalized BITE / café 0–10 (wider bands than absolute taste). */
export function scoreLabel(s, tr) {
  if (!tr) tr = T.en;
  return label010Normalized(s, tr);
}

/** Tier label for raw taste 0–10 (absolute bands). */
export function tasteLabel(t, tr) {
  if (!tr) tr = T.en;
  return label010(t, tr);
}

/** Tier color for raw taste 0–10 (absolute bands). */
export function tasteColor(t) {
  return color010(t);
}

export function cafeScoreColor(s) {
  return color010Normalized(s);
}
export function cafeScoreLabel(s, tr) {
  return scoreLabel(s, tr);
}
