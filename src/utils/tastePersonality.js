import { REGION_MAP } from "../constants/cuisineConstants.js";
import { calcBiteOutOf10 } from "./scoring.js";

/**
 * English-only taste-personality engine for the Restaurants palette.
 *
 * Why this module exists: the previous `pr0..pr3` / `r0..r3` block in
 * PaletteView.jsx read 4 dimensions through very wide `if/else` buckets, so the
 * card felt static for most users. This module derives a richer set of signals
 * from the same entries, classifies the user into one of a handful of
 * archetypes, then layers 1–3 bullets that only fire when their underlying
 * signal is meaningful.
 *
 * Mandarin is currently stashed (see
 * docs/decisions/2026-04-28-stash-mandarin-localization.md), so this engine is
 * English-only. If/when zh comes back, either thread a `lang` arg through or
 * mirror this file with a parallel zh build.
 */

/** Below this many entries the card shows a "log more meals" placeholder. */
export const MIN_ENTRIES_FOR_PERSONALITY = 1;

const NUM = (x, fallback = 0) => {
  const n = +x;
  return Number.isFinite(n) ? n : fallback;
};

/** Shannon entropy normalized to [0,1] over the share distribution. */
function normalizedEntropy(counts) {
  const values = Object.values(counts).filter((c) => c > 0);
  const total = values.reduce((a, c) => a + c, 0);
  if (total === 0 || values.length <= 1) return 0;
  const H = values.reduce((a, c) => {
    const p = c / total;
    return a - p * Math.log(p);
  }, 0);
  return H / Math.log(values.length);
}

/**
 * Pure: derive every signal we use for archetype + bullet selection from the
 * raw entry list and current restaurant weights.
 */
export function computeRestaurantSignals(entries, weights) {
  const total = entries.length;
  if (total === 0) {
    return { total: 0, hasEnoughData: false };
  }

  const tastes = entries.map((e) => NUM(e.taste));
  const costs = entries.map((e) => NUM(e.cost) / (NUM(e.portions, 1) || 1));
  const waits = entries.map((e) => NUM(e.wait));

  const sum = (arr) => arr.reduce((a, x) => a + x, 0);
  const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

  const avgTaste = avg(tastes);
  const avgCost = avg(costs);
  const avgWait = avg(waits);

  const eliteHits = entries.filter((e) => NUM(e.taste) >= 8).length;
  const eliteHitRate = eliteHits / total;

  const mustReturn = entries.filter((e) => NUM(e.repeatability) === 3).length;
  const mustReturnRate = mustReturn / total;

  const recommend = entries.filter((e) => e.useR === true).length;
  const recommendRate = recommend / total;

  const longWaits = entries.filter((e) => NUM(e.wait) >= 30).length;

  const regionCounts = {};
  entries.forEach((e) => {
    const r = REGION_MAP[e.cuisine] || "Other";
    regionCounts[r] = (regionCounts[r] || 0) + 1;
  });
  const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
  const topRegionEntry = sortedRegions[0];
  const topRegion = topRegionEntry ? topRegionEntry[0] : null;
  const topRegionShare = topRegionEntry ? topRegionEntry[1] / total : 0;
  const secondRegionEntry = sortedRegions[1];
  const regionCount = sortedRegions.length;
  const regionDiversity = normalizedEntropy(regionCounts);

  const cuisineCounts = {};
  entries.forEach((e) => {
    if (!e.cuisine) return;
    cuisineCounts[e.cuisine] = (cuisineCounts[e.cuisine] || 0) + 1;
  });
  const cuisineCount = Object.keys(cuisineCounts).length;
  const sortedCuisines = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1]);
  const topCuisine = sortedCuisines[0] ? sortedCuisines[0][0] : null;

  // Top BITE pick: average BITE per restaurant name, then pick the best.
  const groups = {};
  entries.forEach((e) => {
    const k = e.name;
    if (!k) return;
    const score = calcBiteOutOf10(
      NUM(e.taste),
      NUM(e.cost),
      NUM(e.portions, 1),
      NUM(e.wait),
      e.useR,
      NUM(e.repeatability),
      weights,
    );
    if (score == null || Number.isNaN(score)) return;
    if (!groups[k]) groups[k] = { name: k, scores: [] };
    groups[k].scores.push(score);
  });
  const topPick = Object.values(groups)
    .map((g) => ({ name: g.name, score: avg(g.scores), visits: g.scores.length }))
    .sort((a, b) => b.score - a.score)[0] || null;

  return {
    total,
    hasEnoughData: total >= MIN_ENTRIES_FOR_PERSONALITY,
    avgTaste,
    avgCost,
    avgWait,
    eliteHitRate,
    mustReturnRate,
    recommendRate,
    longWaits,
    topRegion,
    topRegionShare,
    secondRegion: secondRegionEntry ? secondRegionEntry[0] : null,
    secondRegionShare: secondRegionEntry ? secondRegionEntry[1] / total : 0,
    regionCount,
    regionDiversity,
    cuisineCount,
    topCuisine,
    topPick,
  };
}

const pct = (x) => Math.round(x * 100);
const fix1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const money = (x) => "$" + Math.round(x);

/**
 * Archetype rules. First match wins; order is most-specific → least-specific.
 * Each entry: { key, match(s), title, blurb, roastTitle, roastBlurb }.
 *
 * Some archetypes set `coversRegion: true` so the region bullet is suppressed
 * (avoids saying the same fact twice).
 */
const ARCHETYPES = [
  {
    key: "hunter",
    coversValue: true,
    match: (s) => s.topPick && s.topPick.score >= 8.5 && s.avgCost < 35,
    title: "The Hunter",
    blurb: (s) =>
      `Top BITE pick at ${s.topPick.name} (${fix1(s.topPick.score)}/10) on a ${money(
        s.avgCost,
      )}/meal average. You find the steal that other people walk past.`,
    roastTitle: "The Hunter",
    roastBlurb: (s) =>
      `${s.topPick.name} pulled ${fix1(s.topPick.score)}/10 and your average tab is ${money(
        s.avgCost,
      )}. Babe, that's not a discerning palate, that's a budget.`,
  },
  {
    key: "snob",
    match: (s) => s.avgTaste >= 7.5 && s.eliteHitRate >= 0.35,
    title: "The Connoisseur",
    blurb: (s) =>
      `Average taste ${fix1(s.avgTaste)}/10 with ${pct(
        s.eliteHitRate,
      )}% of meals scoring 8+. You don't waste a meal slot.`,
    roastTitle: "The Snob",
    roastBlurb: (s) =>
      `${pct(s.eliteHitRate)}% of your meals score 8 or higher. Sweetie, the rest of us eat food too.`,
  },
  {
    key: "splurger",
    coversValue: true,
    match: (s) => s.avgCost > 70 && s.eliteHitRate < 0.4,
    title: "The Splurger",
    blurb: (s) =>
      `Spending ${money(s.avgCost)}/meal on average — you go for the experience first, the math later.`,
    roastTitle: "The Splurger",
    roastBlurb: (s) =>
      `${money(s.avgCost)}/meal average and only ${pct(
        s.eliteHitRate,
      )}% of those landed at 8+. Babe, that's not "treating yourself," that's tipping for mediocrity.`,
  },
  {
    key: "patientPilgrim",
    match: (s) => s.avgWait >= 25 && s.eliteHitRate >= 0.3,
    title: "The Patient Pilgrim",
    blurb: (s) =>
      `Average wait ${Math.round(s.avgWait)} min with ${pct(
        s.eliteHitRate,
      )}% elite hits — you're willing to stand in line for a real one.`,
    roastTitle: "The Line-Stander",
    roastBlurb: (s) =>
      `${Math.round(s.avgWait)} min average wait for a ${pct(
        s.eliteHitRate,
      )}% hit rate. Sweetie, the line is not the vibe.`,
  },
  {
    key: "critic",
    match: (s) => s.total >= 10 && s.avgTaste < 6.5 && s.recommendRate < 0.5,
    title: "The Critic",
    blurb: (s) =>
      `${s.total} meals logged, average taste ${fix1(
        s.avgTaste,
      )}/10. You see through the hype — the bar is yours, not the room's.`,
    roastTitle: "The Critic",
    roastBlurb: (s) =>
      `${s.total} meals, ${fix1(
        s.avgTaste,
      )}/10 average. At what point do we admit the common denominator is you.`,
  },
  {
    key: "loyalist",
    coversRegion: true,
    match: (s) => s.topRegionShare >= 0.5 && s.mustReturnRate >= 0.25,
    title: "The Loyalist",
    blurb: (s) =>
      `${pct(s.topRegionShare)}% of your log is ${s.topRegion}, and ${pct(
        s.mustReturnRate,
      )}% earn a "must return". You know your lane and you stay in it.`,
    roastTitle: "The Loyalist",
    roastBlurb: (s) =>
      `${pct(s.topRegionShare)}% ${s.topRegion}. Babe, ordering off the same menu your whole life isn't loyalty — it's fear.`,
  },
  {
    key: "globetrotter",
    coversRegion: true,
    match: (s) =>
      s.regionCount >= 5 && s.cuisineCount >= 8 && s.topRegionShare < 0.55,
    title: "The Globetrotter",
    blurb: (s) =>
      `${s.cuisineCount} cuisines across ${s.regionCount} regions, top region only ${pct(
        s.topRegionShare,
      )}% of meals. You eat like the world is the menu.`,
    roastTitle: "The Globetrotter",
    roastBlurb: (s) =>
      `${s.cuisineCount} cuisines, ${s.regionCount} regions. Babe, the gap year ended.`,
  },
  {
    key: "explorer",
    match: () => true,
    title: "The Explorer",
    blurb: (s) =>
      s.topRegion
        ? `You're still mapping it out — ${s.cuisineCount} cuisines so far, leaning ${s.topRegion}. The personality sharpens as you log more.`
        : `You're still mapping it out — keep logging and the personality sharpens.`,
    roastTitle: "The Explorer",
    roastBlurb: (s) =>
      `${s.cuisineCount} cuisines logged and zero pattern. You don't have a personality yet, sweetie, you have a sample size.`,
  },
];

function pickArchetype(signals) {
  const arc = ARCHETYPES.find((a) => a.match(signals)) || ARCHETYPES[ARCHETYPES.length - 1];
  return {
    key: arc.key,
    title: arc.title,
    blurb: arc.blurb(signals),
    roastTitle: arc.roastTitle,
    roastBlurb: arc.roastBlurb(signals),
    coversRegion: !!arc.coversRegion,
    coversValue: !!arc.coversValue,
  };
}

/**
 * Bullet generators. Each returns null when its signal isn't meaningful.
 * `archetype` is passed so a generator can suppress itself when the archetype
 * already covered the same fact.
 */
const BULLET_GENERATORS = [
  function regionMixBullet(s, archetype) {
    if (archetype.coversRegion) return null;
    if (!s.topRegion || s.topRegionShare < 0.4) return null;
    const second = s.secondRegion && s.secondRegionShare >= 0.15
      ? `, then ${s.secondRegion} (${pct(s.secondRegionShare)}%)`
      : "";
    return {
      key: "regionMix",
      text: `${s.topRegion} is ${pct(s.topRegionShare)}% of your log${second}.`,
      roast: second
        ? `${pct(s.topRegionShare)}% ${s.topRegion}${second}. Calling that a "shortlist" because "diverse palate" would be a lie.`
        : `${pct(s.topRegionShare)}% ${s.topRegion}. The other regions left you on read.`,
    };
  },
  function tasteBullet(s) {
    const t = fix1(s.avgTaste);
    const elite = pct(s.eliteHitRate);
    if (s.avgTaste >= 8) {
      return {
        key: "taste",
        text: `Average taste ${t}/10 — ${elite}% of meals score 8 or higher.`,
        roast: `Average taste ${t}/10. Sweetie, not every meal is the best night of your life.`,
      };
    }
    if (s.avgTaste >= 6.5) {
      return {
        key: "taste",
        text: `Average taste ${t}/10. You enjoy a meal without needing it to change your life.`,
        roast: `Average taste ${t}/10. Babe, "fine" is a feeling, not a rating.`,
      };
    }
    if (s.total >= 8) {
      return {
        key: "taste",
        text: `Average taste ${t}/10 — every miss is data.`,
        roast: `Average taste ${t}/10 across ${s.total} meals. Sweetie, at this volume it's not the restaurants.`,
      };
    }
    return null;
  },
  function valueBullet(s, archetype) {
    if (archetype.coversValue) return null;
    const c = money(s.avgCost);
    if (s.avgCost > 70) {
      return {
        key: "value",
        text: `Spending ~${c}/meal — you go for the experience.`,
        roast: `${c}/meal average. Babe, that's not a treat, that's a subscription.`,
      };
    }
    if (s.avgCost >= 35) {
      return {
        key: "value",
        text: `Spending ~${c}/meal — middle ground between value and splurge.`,
        roast: `${c}/meal average. Cute. Too high to brag, too low to flex.`,
      };
    }
    return {
      key: "value",
      text: `Spending ~${c}/meal — value finder.`,
      roast: `${c}/meal average. Either you found gems, sweetie, or your standards live in the basement with the prices.`,
    };
  },
  function repeatBullet(s) {
    const r = pct(s.mustReturnRate);
    if (s.mustReturnRate >= 0.4) {
      return {
        key: "repeat",
        text: `${r}% of restaurants earn a "must return" — you commit to your hits.`,
        roast: `${r}% must-returns. Babe, you're not committed, you're stuck.`,
      };
    }
    if (s.total >= 10 && s.mustReturnRate <= 0.1) {
      return {
        key: "repeat",
        text: `Only ${r}% earn a "must return" — you keep moving.`,
        roast: `${r}% must-returns. Allergic to commitment, even pasta-shaped.`,
      };
    }
    return null;
  },
  function topPickBullet(s) {
    if (!s.topPick || s.topPick.score < 7.5) return null;
    return {
      key: "topPick",
      text: `Top BITE pick: ${s.topPick.name} (${fix1(s.topPick.score)}/10).`,
      roast: `Top BITE: ${s.topPick.name} at ${fix1(s.topPick.score)}/10. That's the ceiling.`,
    };
  },
  function waitBullet(s) {
    if (s.longWaits < 3 && s.avgWait < 20) return null;
    if (s.longWaits >= 3) {
      return {
        key: "wait",
        text: `Sat through 30+ min waits ${s.longWaits} times. Patient when it counts.`,
        roast: `${s.longWaits} times you waited 30+ min for food. Therapy is also an option.`,
      };
    }
    return {
      key: "wait",
      text: `Average wait ${Math.round(s.avgWait)} min — you'll queue when it's worth it.`,
      roast: `Average ${Math.round(s.avgWait)} min waits. You like food enough to suffer for it.`,
    };
  },
];

const MAX_BULLETS = 3;

function buildBullets(signals, archetype) {
  const out = [];
  for (const gen of BULLET_GENERATORS) {
    if (out.length >= MAX_BULLETS) break;
    const b = gen(signals, archetype);
    if (b) out.push(b);
  }
  return out;
}

/**
 * Public API: produce a fully-baked taste personality for the Restaurants
 * palette. Returns `{ archetype, bullets, hasEnoughData, signals }`.
 *
 * `hasEnoughData` gates the UI to a "log a few more meals" placeholder when
 * the user has fewer than `MIN_ENTRIES_FOR_PERSONALITY` entries — too few
 * data points and every archetype is noise.
 */
export function getRestaurantPersonality(entries, weights) {
  const signals = computeRestaurantSignals(entries || [], weights);
  if (!signals.hasEnoughData) {
    return { hasEnoughData: false, signals, archetype: null, bullets: [] };
  }
  const archetype = pickArchetype(signals);
  const bullets = buildBullets(signals, archetype);
  return { hasEnoughData: true, signals, archetype, bullets };
}
