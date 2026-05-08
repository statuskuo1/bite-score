import { calcBiteOutOf10, meanRestaurantBiteOutOf10, RESTAURANT_WEIGHT_DEFAULTS } from "./scoring.js";
import { REGION_MAP, CUISINE_REGIONS } from "../constants/cuisineConstants.js";

export const BADGE_SECTIONS = ["Milestones", "Streak", "Group Dining", "Quest", "Score", "Social"];

const SECTION_STYLE = {
  Milestones:    { color: "#F0997B", bgColor: "#3C1F13" },
  Streak:        { color: "#EF9F27", bgColor: "#2A1E05" },
  "Group Dining":{ color: "#5B9BD5", bgColor: "#0C2A3A" },
  Quest:         { color: "#97C459", bgColor: "#1A2E0A" },
  Score:         { color: "#AFA9EC", bgColor: "#1E1A3A" },
  Social:        { color: "#888780", bgColor: "#252523" },
};

function isoDate(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d)) return null;
    return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
  } catch { return null; }
}

function weekKey(ts) {
  if (!ts) return null;
  const ms = Date.parse(ts);
  if (isNaN(ms)) return null;
  return Math.floor(ms / (7 * 24 * 3600 * 1000));
}

function maxConsecutiveWeeks(entries) {
  const keys = [...new Set(entries.map(e => weekKey(e.visitedAt)).filter(k => k !== null))].sort((a, b) => a - b);
  if (!keys.length) return 0;
  let maxRun = 1, run = 1;
  for (let i = 1; i < keys.length; i++) {
    if (keys[i] - keys[i-1] === 1) { run++; maxRun = Math.max(maxRun, run); }
    else run = 1;
  }
  return maxRun;
}

function def(id, name, desc, section, emoji, check, earnedDesc) {
  const { color, bgColor } = SECTION_STYLE[section];
  return { id, name, desc, earnedDesc: earnedDesc || desc, section, emoji, color, bgColor, ...check() };
}

export function evalBadges(entries = [], cafes = [], weights, questL = new Set(), followingCount = 0, tasteBudCount = 0) {
  const wts = weights ?? RESTAURANT_WEIGHT_DEFAULTS;
  const streak = maxConsecutiveWeeks(entries);
  const regions = new Set(entries.map(e => REGION_MAP[e.cuisine]).filter(Boolean));
  const allRegionCount = Object.keys(CUISINE_REGIONS).length;

  const fusionEntry = entries.find(e => e.isFusion);
  const cafeEntry = cafes[0];

  const eliteCount = entries.filter(e => (calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, wts, e.currency_code || "USD") ?? -1) >= 8).length;
  const toughCount = entries.filter(e => {
    const b = calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, wts, e.currency_code || "USD");
    return b !== null && b < 2;
  }).length;
  const meanBite = entries.length ? meanRestaurantBiteOutOf10(entries, wts) : null;

  return [
    // ── Milestones ──────────────────────────────────────────────────────
    def("first-bite", "First Bite", "Log your first restaurant.", "Milestones", "🍴", () => ({
      earned: entries.length >= 1,
      earnedDate: isoDate(entries[0]?.visitedAt),
      progress: `${entries.length} / 1`,
    }), "Logged your first restaurant."),
    def("warmed-up", "Getting Warmed Up", "Log 10 restaurants.", "Milestones", "🔥", () => ({
      earned: entries.length >= 10,
      earnedDate: entries.length >= 10 ? isoDate(entries[9]?.visitedAt) : null,
      progress: `${entries.length} / 10`,
    }), "Logged 10 restaurants."),
    def("seasoned", "Seasoned", "Log 25 restaurants.", "Milestones", "🧂", () => ({
      earned: entries.length >= 25,
      earnedDate: entries.length >= 25 ? isoDate(entries[24]?.visitedAt) : null,
      progress: `${entries.length} / 25`,
    }), "Logged 25 restaurants."),
    def("hundred-club", "Hundred Club", "Log 100 restaurants.", "Milestones", "💯", () => ({
      earned: entries.length >= 100,
      earnedDate: entries.length >= 100 ? isoDate(entries[99]?.visitedAt) : null,
      progress: `${entries.length} / 100`,
    }), "Logged 100 restaurants."),
    def("fusion-curious", "Fusion Curious", "Log your first fusion dish.", "Milestones", "🌀", () => ({
      earned: !!fusionEntry,
      earnedDate: isoDate(fusionEntry?.visitedAt),
      progress: fusionEntry ? "1 / 1" : "0 / 1",
    }), "Logged your first fusion dish."),
    def("cafe-crawler", "Cafe Crawler", "Log your first cafe visit.", "Milestones", "☕", () => ({
      earned: cafes.length >= 1,
      earnedDate: isoDate(cafeEntry?.visitedAt),
      progress: `${cafes.length} / 1`,
    }), "Logged your first cafe visit."),

    // ── Streak ───────────────────────────────────────────────────────────
    def("on-a-roll", "On a Roll", "Log entries 2 weeks in a row.", "Streak", "🎯", () => ({
      earned: streak >= 2,
      earnedDate: null,
      progress: `${streak} / 2 weeks`,
    }), "Logged entries 2 weeks in a row."),
    def("cant-stop", "Can't Stop Won't Stop", "Log entries 4 weeks in a row.", "Streak", "⚡", () => ({
      earned: streak >= 4,
      earnedDate: null,
      progress: `${streak} / 4 weeks`,
    }), "Logged entries 4 weeks in a row."),
    def("lifestyle", "This Is a Lifestyle", "Log entries 26 weeks in a row.", "Streak", "🏃", () => ({
      earned: streak >= 26,
      earnedDate: null,
      progress: `${streak} / 26 weeks`,
    }), "Logged entries 26 weeks in a row."),
    def("lifer", "The Lifer", "Log entries 52 weeks in a row.", "Streak", "👑", () => ({
      earned: streak >= 52,
      earnedDate: null,
      progress: `${streak} / 52 weeks`,
    }), "Logged entries 52 weeks in a row."),

    // ── Group Dining ─────────────────────────────────────────────────────
    def("better-together", "Better Together", "Log your first group meal.", "Group Dining", "🤝", () => ({
      earned: false, earnedDate: null, progress: "coming soon",
    }), "Logged your first group meal."),
    def("round-table", "Round Table", "Dine in a group of 4+.", "Group Dining", "⭕", () => ({
      earned: false, earnedDate: null, progress: "coming soon",
    }), "Dined in a group of 4+."),
    def("long-table", "The Long Table", "Dine in a group of 8+.", "Group Dining", "🪑", () => ({
      earned: false, earnedDate: null, progress: "coming soon",
    }), "Dined in a group of 8+."),
    def("ride-or-die", "Ride or Die", "Dine with the same person 10x.", "Group Dining", "💪", () => ({
      earned: false, earnedDate: null, progress: "coming soon",
    }), "Dined with the same person 10 times."),

    // ── Quest ─────────────────────────────────────────────────────────────
    def("half-alphabet", "Half Alphabet", "Complete 13 A-Z quest letters.", "Quest", "📖", () => ({
      earned: questL.size >= 13,
      earnedDate: null,
      progress: `${questL.size} / 26`,
    }), "Completed 13 A-Z quest letters."),
    def("a-to-z", "A to Z", "Complete all 26 A-Z quest letters.", "Quest", "🔤", () => ({
      earned: questL.size >= 26,
      earnedDate: null,
      progress: `${questL.size} / 26`,
    }), "Completed all 26 A-Z quest letters."),
    def("region-hopper", "Region Hopper", "Eat cuisines from 5 different regions.", "Quest", "✈️", () => ({
      earned: regions.size >= 5,
      earnedDate: null,
      progress: `${regions.size} / 5`,
    }), "Ate cuisines from 5 different regions."),
    def("world-eater", "World Eater", `Eat cuisines from all ${allRegionCount} regions.`, "Quest", "🌍", () => ({
      earned: regions.size >= allRegionCount,
      earnedDate: null,
      progress: `${regions.size} / ${allRegionCount}`,
    }), `Ate cuisines from all ${allRegionCount} regions.`),

    // ── Score ─────────────────────────────────────────────────────────────
    def("high-standards", "High Standards", "Maintain an average BITE score ≥ 6.5 across 10+ logs.", "Score", "⭐", () => ({
      earned: entries.length >= 10 && meanBite !== null && meanBite >= 6.5,
      earnedDate: null,
      progress: entries.length < 10
        ? `${entries.length} / 10 logs`
        : meanBite !== null ? `avg ${meanBite.toFixed(2)} / 6.5` : "0 entries",
    }), "Maintained an average BITE score ≥ 6.5 across 10+ logs."),
    def("elite-palate", "Elite Palate", "Rate 5+ restaurants at the Elite tier (BITE ≥ 8.0).", "Score", "💎", () => ({
      earned: eliteCount >= 5,
      earnedDate: null,
      progress: `${eliteCount} / 5`,
    }), "Rated 5+ restaurants at the Elite tier (BITE ≥ 8.0)."),
    def("tough-crowd", "Tough Crowd", "Rate 5+ restaurants at the lowest tier (BITE < 2.0).", "Score", "😤", () => ({
      earned: toughCount >= 5,
      earnedDate: null,
      progress: `${toughCount} / 5`,
    }), "Rated 5+ restaurants at the lowest tier (BITE < 2.0)."),

    // ── Social ────────────────────────────────────────────────────────────
    def("first-follow", "First Follow", "Follow your first fellow foodie.", "Social", "👋", () => ({
      earned: followingCount >= 1,
      earnedDate: null,
      progress: `${followingCount} / 1`,
    }), "Followed your first fellow foodie."),
    def("first-taste-bud", "First Taste Bud", "Connect with your first Taste Bud.", "Social", "🤝", () => ({
      earned: tasteBudCount >= 1,
      earnedDate: null,
      progress: `${tasteBudCount} / 1`,
    }), "Connected with your first Taste Bud."),
    def("found-your-people", "Found Your People", "Connect with 5 Taste Buds.", "Social", "👥", () => ({
      earned: false, earnedDate: null, progress: "coming soon",
    }), "Connected with 5 Taste Buds."),
    def("circle-of-trust", "Circle of Trust", "Connect with 10 Taste Buds.", "Social", "🔐", () => ({
      earned: false, earnedDate: null, progress: "coming soon",
    }), "Connected with 10 Taste Buds."),
  ];
}
