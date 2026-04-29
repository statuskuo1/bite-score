import { useState } from "react";

const Q_STYLE = { fontWeight: 500, fontSize: 14, color: "#F0997B", marginBottom: 6 };
const A_STYLE = { fontSize: 13, color: "#888780", lineHeight: 1.7 };
const ITEM_STYLE = { borderBottom: "0.5px solid rgba(255,255,255,0.1)", padding: "14px 0" };

function FaqItem({ q, children }) {
  return (
    <div style={ITEM_STYLE}>
      <div style={Q_STYLE}>{q}</div>
      <div style={A_STYLE}>{children}</div>
    </div>
  );
}

function IndentedLine({ children }) {
  return (
    <div style={{ paddingLeft: 10, borderLeft: "2px solid rgba(255,255,255,0.12)", marginBottom: 4 }}>
      {children}
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "12px 0",
          background: "none", border: "none",
          borderTop: "0.5px solid rgba(255,255,255,0.1)",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#F0997B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </span>
        <span style={{
          fontSize: 16, color: "#888780", lineHeight: 1,
          display: "inline-block",
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 0.15s",
        }}>›</span>
      </button>
      {open && <div style={{ paddingBottom: 8 }}>{children}</div>}
    </div>
  );
}

export function FaqView() {
  return (
    <div>
      {/* ── TIER 1: Overview — collapsible, default open ── */}
      <CollapsibleSection title="Overview" defaultOpen>
        <FaqItem q="What is BITE Score?">
          BITE — the Benefit Index of Taste and Efficiency — is a personal restaurant rating system
          that weighs everything you actually care about into one number: taste, cost, portion size,
          wait time, and whether you'd go back. You set the weights, so the score reflects your
          priorities. Change them anytime and your scores adjust in real time.
        </FaqItem>

        <FaqItem q="How do I rate?">
          Tap the + button and pick Restaurant or Cafe. For cafes, your entry automatically sorts
          into Drinks or Sweets based on the category you pick (Coffee, Tea → Drinks; Croissant,
          Soft Serve → Sweets). Each has its own leaderboard and scoring formula. You can log
          multiple items per cafe visit.
        </FaqItem>

        <FaqItem q="What's a Taste Bud?">
          When you mutually follow each other, you become Taste Buds. (Since Instagram won't give
          you this feature, I will.) You can view each other's full log, compare your ratings, and
          discover restaurants through each other.
        </FaqItem>

        <FaqItem q="Can others see my ratings?">
          Your ratings appear on the Global leaderboard by restaurant. Anyone who follows you can
          view your full log and compare with you.
        </FaqItem>

        <FaqItem q="What do the scores mean?">
          Scores range from 0 to 10: 9+ is Elite, 7.5+ is Great, 6+ is Good, 4+ is Decent, below
          4 is Don't bother.
        </FaqItem>
      </CollapsibleSection>

      {/* ── TIER 2: Community features ── */}
      <CollapsibleSection title="Community features">
        <FaqItem q="How do Taste Buds' Top Picks work?">
          Top Picks aggregates the highest-rated restaurants across all your Taste Buds. If
          multiple Taste Buds rate the same place highly, it rises to the top. It's a
          crowdsourced best-of list from the people whose taste you trust.
        </FaqItem>

        <FaqItem q="What is 'They tried, you haven't'?">
          When you compare with a Taste Bud, the app shows restaurants they've rated that you
          haven't visited yet — sorted by their rating. Works both ways. It's a personalized
          recommendation engine powered by people you actually know.
        </FaqItem>

        <FaqItem q="How is taste compatibility calculated?">
          Compatibility looks at restaurants you've both visited and compares how similarly you
          rated them. The closer your scores across shared restaurants, the higher your match
          percentage. If you haven't been to any of the same places yet, there's not enough
          data to calculate.
        </FaqItem>
      </CollapsibleSection>

      {/* ── TIER 3: The math ── */}
      <CollapsibleSection title="The math behind BITE">
        <FaqItem q="How is the restaurant BITE Score calculated?">
          Three factors feed into your score, each weighted by your personal preferences
          (adjustable anytime):
          <div style={{ marginTop: 8 }}>
            <IndentedLine>Taste — your 0–10 rating of the food. Default weight: 50%.</IndentedLine>
            <IndentedLine>
              Bang per Buck — total cost ÷ portions ÷ $20 benchmark. $20/portion is neutral —
              cheaper boosts your score, pricier drags it down slightly. Default weight: 40%.
            </IndentedLine>
            <IndentedLine>
              Wait — entered in minutes, converted to a penalty. Early minutes hurt the most —
              going from 10 to 20 min matters way more than 60 to 70. Capped at 120 min.
              Default weight: 10%.
            </IndentedLine>
          </div>
          <div style={{ marginTop: 8 }}>
            If Repeatability is on, it adjusts the final score up or down (see below). Scores
            are normalized to 0–10.
          </div>
        </FaqItem>

        <FaqItem q="What does Repeatability do?">
          A Michelin-style 0–3 star rating that adjusts your base score:
          <div style={{ marginTop: 8 }}>
            <IndentedLine>⭐⭐⭐ Must return: +40% boost</IndentedLine>
            <IndentedLine>⭐⭐ Would seek out: +20% boost</IndentedLine>
            <IndentedLine>⭐ If occasion calls: no change</IndentedLine>
            <IndentedLine>✕ Wouldn't return: −30% penalty</IndentedLine>
          </div>
          <div style={{ marginTop: 8 }}>
            A high base score with low Repeatability drops. A solid base with high Repeatability
            climbs. This is what separates "good meal" from "I'm going back."
          </div>
        </FaqItem>

        <FaqItem q="How are Drinks scored?">
          Fixed weights: 70% Taste, 30% Bang per Buck. The neutral benchmark is $5.25/item
          instead of $20. Wait penalty is soft — capped at 10% of your base score. Same
          Repeatability multiplier applies.
        </FaqItem>

        <FaqItem q="How are Sweets scored?">
          Same formula as Drinks.
        </FaqItem>
      </CollapsibleSection>
    </div>
  );
}
