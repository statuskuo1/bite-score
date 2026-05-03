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
        text: "satisfaction index taste cost portion size meals one person wait time repeatability weighted how much you care factors example restaurant date night quick bite same score normalized 0 10 benefit index efficiency",
        node: (
          <>
            A satisfaction index determined by your ratings in taste, cost, portion size (how many meals for one person), wait time, and repeatability, weighted by how much you care about these factors.
            <div style={{ marginTop: 12, fontWeight: 500, color: "#F1EFE8" }}>
              Same satisfaction, two different paths:
            </div>
            <div style={{ marginTop: 8 }}>
              <IndentedLine><b>Restaurant A — "Date Night"</b></IndentedLine>
              <IndentedLine>Taste 8.5 · Cost $50 · Wait 30 min</IndentedLine>
              <IndentedLine>Weights: 75% taste / 15% cost / 10% wait</IndentedLine>
              <IndentedLine>→ BITE Score: <b>7.0</b></IndentedLine>
            </div>
            <div style={{ marginTop: 8 }}>
              <IndentedLine><b>Restaurant B — "Quick Bite"</b></IndentedLine>
              <IndentedLine>Taste 8.0 · Cost $8 · Wait 2 min</IndentedLine>
              <IndentedLine>Weights: 50% taste / 35% cost / 15% wait</IndentedLine>
              <IndentedLine>→ BITE Score: <b>7.0</b></IndentedLine>
            </div>
            <div style={{ marginTop: 12 }}>
              Scores are normalized to 0–10. Learn more in the math section.
            </div>
            <div style={{ marginTop: 8, fontStyle: "italic", color: "#888780" }}>
              BITE = Benefit Index of Taste and Efficiency.
            </div>
          </>
        ),
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
        q: "How is compatibility calculated?",
        text: "compatibility food preferences align not just eaten same places measures similar taste cost wait top cuisines overlap both visited same restaurants how closely rated factors more log accurate both need at least 5 entries score show",
        node: "Compatibility looks at how closely your food preferences align — not just whether you've eaten at the same places. It measures how similar you care about taste/cost/wait, and whether your top cuisines overlap. If you've both visited the same restaurants, how closely you rated them factors in too. The more you both log, the more accurate it gets. Both people need at least 5 entries for a score to show.",
      },
      {
        q: "How does \"Pick a Place\" work?",
        text: "pick a place suggested tastes cuisine preference factor weights lower two scores not average place one person loves other mediocre won't make list only places genuinely work both",
        node: "Suggested based on your tastes, cuisine preference, and factor weights. Uses the lower of your two scores, not the average. So a place one person loves but the other would find mediocre won't make the list. Only places that genuinely work for both of you come through.",
      },
    ],
  },
  {
    section: "The math behind BITE",
    items: [
      {
        q: "How is the BITE Score calculated?",
        text: "three factors weighted preferences adjustable my palette taste 0 10 increments consistency bang per buck cost portions benchmarked median meal spend country wait minutes penalized curve scores normalized 0 10",
        node: (
          <>
            Three factors, each weighted by your preferences (adjustable anytime in My Palette):
            <div style={{ marginTop: 8 }}>
              <IndentedLine>Taste: 0–10, in 0.1 or 0.5 increments for consistency.</IndentedLine>
              <IndentedLine>Bang per Buck: cost ÷ portions, benchmarked against the median meal spend for your country.</IndentedLine>
              <IndentedLine>Wait: logged in minutes, but penalized on a curve.</IndentedLine>
            </div>
            <div style={{ marginTop: 8 }}>Scores are normalized to 0–10.</div>
          </>
        ),
      },
      {
        q: "How are scores normalized between 0–10?",
        text: "scores normalized 0 10 raw score compared theoretical best your weights taste 10 no cost drag wait penalty ratio capped 0 1 multiply 70 percent personal max comparable adjust weights",
        node: (
          <>
            Each rating's raw score is compared to the theoretical best for your weights (taste = 10, no cost drag, no wait penalty). We take that ratio (capped between 0 and 1) and multiply by 10.
            <div style={{ marginTop: 8 }}>
              So a 7 always means "70% of your personal max" — scores stay comparable even when you adjust your weights.
            </div>
          </>
        ),
      },
      {
        q: "What does Repeatability do?",
        text: "michelin style 0 3 star rating adjusts base score formula wt taste wbpb bpb ww wait must return +40% boost would seek out +20% wouldn't return -30% penalty good meal going back high base score low repeatability drops solid base high repeatability climbs",
        node: (
          <>
            A Michelin-style 0–3 star rating that adjusts your base score:
            <div style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#F1EFE8" }}>
              Base Score = w<sub>t</sub> · T − w<sub>bpb</sub> · BPB − w<sub>w</sub> · W
            </div>
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
