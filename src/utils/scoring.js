import { T } from "../translations.js";
import {
  color010,
  color010Normalized,
  label010,
  label010Normalized,
} from "../constants/ratingTiers0to10.js";

export function rMult(r) {
  return r === 3 ? 0.4 : r === 2 ? 0.2 : r === 1 ? 0 : -0.3;
}
export function applyR(base, r) {
  return Math.round((base + Math.abs(base) * rMult(r)) * 100) / 100;
}

/** Raw BITE utility (weight-dependent magnitude). */
export function calcBite(t, cost, portions, w, useR, r, wts) {
  if (!portions) return null;
  const wt = wts || { taste: 50, bpb: 40, wait: 10 };
  const bpb = (cost / portions) / 20;
  const wp = Math.min(10, (Math.log(w + 1) / Math.log(121)) * 10);
  const base = (wt.taste / 100) * t - (wt.bpb / 100) * bpb - (wt.wait / 100) * wp;
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
export function calcBiteUtilityRatio(t, cost, portions, w, useR, r, wts) {
  const raw = calcBite(t, cost, portions, w, useR, r, wts);
  const max = calcMaxBite(wts);
  return biteUtilityRatio(raw, max);
}

/** BITE on 0–10: normalized utility ratio × 10 (see `biteUtilityRatio`). */
export function calcBiteOutOf10(t, cost, portions, w, useR, r, wts) {
  return utilityRatioToOutOf10(calcBiteUtilityRatio(t, cost, portions, w, useR, r, wts));
}

/** Raw café score (fixed blend in formula, then /1.593). */
export function calcCafe(t, cost, portions, wait, useR, r) {
  if (!portions) return null;
  const bpb = (cost / portions) / 5.25;
  const wp = Math.min(10, (Math.log(wait + 1) / Math.log(121)) * 10);
  const base = 0.7 * t - 0.3 * bpb;
  const waitPenalty = Math.abs(base) * 0.1 * (wp / 10);
  const withWait = base - waitPenalty;
  const raw = useR ? applyR(withWait, r) : Math.round(withWait * 100) / 100;
  return Math.round((raw / 1.593) * 100) / 100;
}

/** Best raw café score for current formula (same pipeline as calcCafe). */
export function calcCafeMax() {
  return calcCafe(10, 0, 1, 0, true, 3);
}

/** Café: utility ratio (0–1), or null. */
export function calcCafeUtilityRatio(t, cost, portions, wait, useR, r) {
  const raw = calcCafe(t, cost, portions, wait, useR, r);
  const max = calcCafeMax();
  return biteUtilityRatio(raw, max);
}

/** Café BITE on 0–10: normalized ratio × 10. */
export function calcCafeOutOf10(t, cost, portions, wait, useR, r) {
  return utilityRatioToOutOf10(calcCafeUtilityRatio(t, cost, portions, wait, useR, r));
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
