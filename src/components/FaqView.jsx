import { useState } from "react";

const A_STYLE = { fontSize: 14, color: "#AEABA4", lineHeight: 1.7 };

function IndentedLine({ children }) {
  return (
    <div style={{ paddingLeft: 10, borderLeft: "2px solid rgba(255,255,255,0.12)", marginBottom: 4 }}>
      {children}
    </div>
  );
}

function FaqItem({ q, children, forceOpen }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  return (
    <div style={{ borderBottom: "0.5px solid rgba(255,255,255,0.1)" }}>
      <button
        type="button"
        onClick={() => { if (!forceOpen) setOpen((v) => !v); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "16px 0",
          background: "none", border: "none",
          cursor: forceOpen ? "default" : "pointer", textAlign: "left", gap: 12,
        }}
      >
        <span style={{ fontWeight: 500, fontSize: 14, color: "#F1EFE8", lineHeight: 1.4 }}>{q}</span>
        {!forceOpen && (
          <span style={{
            fontSize: 16, color: "#888780", lineHeight: 1, flexShrink: 0,
            display: "inline-block",
            transform: isOpen ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
          }}>›</span>
        )}
      </button>
      {isOpen && <div style={{ ...A_STYLE, paddingBottom: 16 }}>{children}</div>}
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
        <span style={{ fontSize: 14, fontWeight: 700, color: "#F0997B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
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

// Each item has `text` (plain string for search) and `node` (JSX for rendering).
const FAQ_DATA = [
  {
    section: "Overview",
    defaultOpen: true,
    items: [
      {
        q: "What is BITE Score?",
        text: "bite benefit index taste efficiency personal restaurant rating system weighs everything you actually care about one number taste cost portion size wait time whether you'd go back set the weights score reflects priorities change them anytime scores adjust real time",
        node: "BITE — the Benefit Index of Taste and Efficiency — is a personal restaurant rating system that weighs everything you actually care about into one number: taste, cost, portion size, wait time, and whether you'd go back. You set the weights, so the score reflects your priorities. Change them anytime and your scores adjust in real time.",
      },
      {
        q: "How do I rate?",
        text: "tap plus button pick restaurant cafe cafes entry automatically sorts drinks sweets category coffee tea croissant soft serve leaderboard scoring formula log multiple items per cafe visit",
        node: "Tap the + button and pick Restaurant or Cafe. For cafes, your entry automatically sorts into Drinks or Sweets based on the category you pick (Coffee, Tea → Drinks; Croissant, Soft Serve → Sweets). Each has its own leaderboard and scoring formula. You can log multiple items per cafe visit.",
      },
      {
        q: "What's a Taste Bud?",
        text: "mutually follow each other become taste buds instagram feature view full log compare ratings discover restaurants",
        node: "When you mutually follow each other, you become Taste Buds. (Since Instagram won't give you this feature, I will.) You can view each other's full log, compare your ratings, and discover restaurants through each other.",
      },
      {
        q: "Can others see my ratings?",
        text: "ratings appear global leaderboard by restaurant anyone who follows you view full log compare",
        node: "Your ratings appear on the Global leaderboard by restaurant. Anyone who follows you can view your full log and compare with you.",
      },
      {
        q: "What do the scores mean?",
        text: "scores range 0 10 elite great good decent don't bother 9 7.5 6 4",
        node: "Scores range from 0 to 10: 9+ is Elite, 7.5+ is Great, 6+ is Good, 4+ is Decent, below 4 is Don't bother.",
      },
    ],
  },
  {
    section: "Community features",
    items: [
      {
        q: "How do Taste Buds' Top Picks work?",
        text: "top picks aggregates highest rated restaurants across taste buds multiple rate same place rises to top crowdsourced best of list people whose taste you trust",
        node: "Top Picks aggregates the highest-rated restaurants across all your Taste Buds. If multiple Taste Buds rate the same place highly, it rises to the top. It's a crowdsourced best-of list from the people whose taste you trust.",
      },
      {
        q: "What is 'They tried, you haven't'?",
        text: "compare taste bud shows restaurants they've rated you haven't visited yet sorted by rating both ways personalized recommendation engine people you actually know",
        node: "When you compare with a Taste Bud, the app shows restaurants they've rated that you haven't visited yet — sorted by their rating. Works both ways. It's a personalized recommendation engine powered by people you actually know.",
      },
      {
        q: "How is compatibility calculated?",
        text: "compatibility measures food preferences align another person eaten same places blends two signals taste profile similarity 70% weight preferences average spend tolerance cuisine region distribution rating agreement 30% shared restaurants taste scores no shared visits based entirely taste profiles updates log more weights prioritize taste cost bang per buck spend tolerance price range cuisine regions overlap minimum 5 entries meaningful score fewer than 5 shows dash",
        node: (
          <>
            Compatibility measures how well your food preferences align with another person's — not just whether you've eaten at the same places.
            <div style={{ marginTop: 8 }}>It blends two signals:</div>
            <div style={{ marginTop: 6 }}>
              <IndentedLine>Taste profile similarity (70%) — how closely your weight preferences, average spend tolerance, and cuisine region distribution match.</IndentedLine>
              <IndentedLine>Rating agreement (30%) — for restaurants you've both logged, how closely your taste scores align.</IndentedLine>
            </div>
            <div style={{ marginTop: 8 }}>If you have no shared visits yet, compatibility is based entirely on your taste profiles. The score updates as you both log more.</div>
            <div style={{ marginTop: 8 }}>Three dimensions of preference similarity:</div>
            <div style={{ marginTop: 6 }}>
              <IndentedLine>Weights — do you both prioritize taste over cost, or value bang per buck more?</IndentedLine>
              <IndentedLine>Spend tolerance — are you both comfortable at the same price range?</IndentedLine>
              <IndentedLine>Cuisine regions — do your top regions overlap?</IndentedLine>
            </div>
            <div style={{ marginTop: 8 }}>Minimum 5 entries required for a meaningful score. If either person has fewer than 5 entries, compatibility shows as — until there's enough data.</div>
          </>
        ),
      },
    ],
  },
  {
    section: "The math behind BITE",
    items: [
      {
        q: "How is the restaurant BITE Score calculated?",
        text: "three factors score weighted personal preferences taste 0 10 rating food default weight 50% bang per buck total cost portions $20 benchmark neutral cheaper boosts pricier drags down 40% wait minutes converted penalty early minutes hurt most capped 120 min 10% repeatability adjusts final score normalized 0 10",
        node: (
          <>
            Three factors feed into your score, each weighted by your personal preferences (adjustable anytime):
            <div style={{ marginTop: 8 }}>
              <IndentedLine>Taste — your 0–10 rating of the food. Default weight: 50%.</IndentedLine>
              <IndentedLine>Bang per Buck — total cost ÷ portions ÷ $20 benchmark. $20/portion is neutral — cheaper boosts your score, pricier drags it down slightly. Default weight: 40%.</IndentedLine>
              <IndentedLine>Wait — entered in minutes, converted to a penalty. Early minutes hurt the most — going from 10 to 20 min matters way more than 60 to 70. Capped at 120 min. Default weight: 10%.</IndentedLine>
            </div>
            <div style={{ marginTop: 8 }}>If Repeatability is on, it adjusts the final score up or down (see below). Scores are normalized to 0–10.</div>
          </>
        ),
      },
      {
        q: "What does Repeatability do?",
        text: "michelin style 0 3 star rating adjusts base score must return +40% boost would seek out +20% wouldn't return -30% penalty good meal going back high base score low repeatability drops solid base high repeatability climbs",
        node: (
          <>
            A Michelin-style 0–3 star rating that adjusts your base score:
            <div style={{ marginTop: 8 }}>
              <IndentedLine>⭐⭐⭐ Must return: +40% boost</IndentedLine>
              <IndentedLine>⭐⭐ Would seek out: +20% boost</IndentedLine>
              <IndentedLine>⭐ If occasion calls: no change</IndentedLine>
              <IndentedLine>✕ Wouldn't return: −30% penalty</IndentedLine>
            </div>
            <div style={{ marginTop: 8 }}>A high base score with low Repeatability drops. A solid base with high Repeatability climbs. This is what separates "good meal" from "I'm going back."</div>
          </>
        ),
      },
      {
        q: "How are Drinks scored?",
        text: "fixed weights 70% taste 30% bang per buck neutral benchmark $5.25 per item instead $20 wait penalty soft capped 10% base score repeatability multiplier applies",
        node: "Fixed weights: 70% Taste, 30% Bang per Buck. The neutral benchmark is $5.25/item instead of $20. Wait penalty is soft — capped at 10% of your base score. Same Repeatability multiplier applies.",
      },
      {
        q: "How are Sweets scored?",
        text: "same formula as drinks sweets scoring",
        node: "Same formula as Drinks.",
      },
    ],
  },
];

const ALL_ITEMS = FAQ_DATA.flatMap((s) => s.items);

export function FaqView() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const q = query.trim().toLowerCase();
  const matched = q
    ? ALL_ITEMS.filter((item) =>
        item.q.toLowerCase().includes(q) || item.text.includes(q)
      )
    : null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Search FAQs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            background: "#1A1A18",
            border: `1.5px solid ${focused ? "#F0997B" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 10,
            color: "#F1EFE8",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      {matched !== null ? (
        matched.length === 0 ? (
          <div style={{ fontSize: 14, color: "#888780", textAlign: "center", padding: "24px 0" }}>
            No results for "{query}"
          </div>
        ) : (
          <div>
            {matched.map((item) => (
              <FaqItem key={item.q} q={item.q} forceOpen>
                {item.node}
              </FaqItem>
            ))}
          </div>
        )
      ) : (
        FAQ_DATA.map(({ section, defaultOpen, items }) => (
          <CollapsibleSection key={section} title={section} defaultOpen={defaultOpen}>
            {items.map((item) => (
              <FaqItem key={item.q} q={item.q}>
                {item.node}
              </FaqItem>
            ))}
          </CollapsibleSection>
        ))
      )}
    </div>
  );
}
