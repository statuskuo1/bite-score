import { T } from "../translations.js";

export function rMult(r) {
  return r === 3 ? 0.4 : r === 2 ? 0.2 : r === 1 ? 0 : -0.3;
}
export function applyR(base, r) {
  return Math.round((base + Math.abs(base) * rMult(r)) * 100) / 100;
}

export function calcMaxBite(wts) {
  const wt = wts || { taste: 50, bpb: 40, wait: 10 };
  const base = (wt.taste / 100) * 10;
  return Math.round((base + Math.abs(base) * 0.4) * 100) / 100;
}

export function calcBite(t, cost, portions, w, useR, r, wts) {
  if (!portions) return null;
  const wt = wts || { taste: 50, bpb: 40, wait: 10 };
  const bpb = (cost / portions) / 20;
  const wp = Math.min(10, (Math.log(w + 1) / Math.log(121)) * 10);
  const base = (wt.taste / 100) * t - (wt.bpb / 100) * bpb - (wt.wait / 100) * wp;
  return useR ? applyR(base, r) : Math.round(base * 100) / 100;
}

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

export function scoreColor(s) {
  if (s === null) return "#888780";
  if (s >= 3) return "#97C459";
  if (s >= 2) return "#5B9BD5";
  if (s >= 1) return "#EF9F27";
  return "#A32D2D";
}
export function scoreLabel(s, tr) {
  if (!tr) tr = T.en;
  if (s === null) return "—";
  if (s >= 4) return tr.elite;
  if (s >= 3) return tr.great;
  if (s >= 2) return tr.good;
  if (s >= 1) return tr.decent;
  return tr.dontBother;
}
export function tasteLabel(t, tr) {
  if (!tr) tr = T.en;
  if (t <= 2) return tr.sucks;
  if (t <= 4) return tr.meh;
  if (t <= 7) return tr.average;
  if (t <= 8.5) return tr.goodTaste;
  return tr.greatTaste;
}
export function cafeScoreColor(s) {
  if (s === null) return "#888780";
  if (s >= 4) return "#97C459";
  if (s >= 3) return "#5B9BD5";
  if (s >= 2) return "#EF9F27";
  if (s >= 1) return "#A32D2D";
  return "#A32D2D";
}
export function cafeScoreLabel(s, tr) {
  if (!tr) tr = T.en;
  if (s === null) return "—";
  if (s >= 4) return tr.elite;
  if (s >= 3) return tr.great;
  if (s >= 2) return tr.good;
  if (s >= 1) return tr.decent;
  return tr.dontBother;
}
