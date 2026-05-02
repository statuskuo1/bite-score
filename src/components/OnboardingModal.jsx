import { useState } from "react";
import { MouthLogo } from "./MouthLogo.jsx";
import { WeightSliders } from "./WeightSliders.jsx";
import { useLang } from "../contexts/LangContext.jsx";
import { RESTAURANT_WEIGHT_DEFAULTS, normalizeWeights } from "../utils/scoring.js";

const WEIGHT_DEFAULTS = RESTAURANT_WEIGHT_DEFAULTS;

const OVERLAY = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.82)",
  zIndex: 500,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "1.5rem",
};

const CARD = {
  background: "#1E1E1C",
  borderRadius: 16,
  padding: "28px 24px 24px",
  maxWidth: 360,
  width: "100%",
  border: "0.5px solid rgba(255,255,255,0.12)",
  boxSizing: "border-box",
};

const CTA_BTN = {
  width: "100%",
  padding: "12px",
  background: "#F0997B",
  color: "#141413",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 0,
};

const SKIP_LINK = {
  display: "block",
  textAlign: "center",
  fontSize: 12,
  color: "#888780",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "10px 0 0",
  width: "100%",
};

// Dots are clickable — can navigate back to any previously visited card.
function ProgressDots({ card, onGoTo }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
      {[0, 1, 2].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => i < card && onGoTo(i)}
          style={{
            width: 6, height: 6, borderRadius: "50%", padding: 0, border: "none",
            background: i <= card ? "#F0997B" : "#444441",
            cursor: i < card ? "pointer" : "default",
          }}
        />
      ))}
    </div>
  );
}

export function OnboardingModal({ restaurantWeights, onWeightSave, onComplete, isGuest, startAtCard = 0 }) {
  const { t } = useLang();
  const [card, setCard] = useState(startAtCard);
  const [draftW, setDraftW] = useState(() => normalizeWeights(restaurantWeights));

  function draftUpd(k, v) {
    const nv = Math.round(Math.min(10, Math.max(1, +v)));
    setDraftW((w) => ({ ...w, [k]: nv }));
  }

  if (card === 0) {
    return (
      <div style={OVERLAY}>
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <MouthLogo />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1EFE8", margin: "0 0 16px", textAlign: "center", lineHeight: 1.3 }}>
            Not all 4-stars are equal.
          </h2>

          {/* Row 1 — price groups hug the ≠, each group center-justified within its column */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 500, color: "#97C459", lineHeight: 1 }}>$12</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#97C459", marginTop: 8 }}>food truck</div>
              <div style={{ fontSize: 12, color: "#555553", marginTop: 8 }}>⭐⭐⭐⭐</div>
            </div>
            <div style={{ fontSize: 52, fontWeight: 300, color: "#F1EFE8", lineHeight: 1, padding: "0 16px", flexShrink: 0, textAlign: "center" }}>≠</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 500, color: "#F0997B", lineHeight: 1 }}>$80</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#F0997B", marginTop: 8 }}>michelin</div>
              <div style={{ fontSize: 12, color: "#555553", marginTop: 8 }}>⭐⭐⭐⭐</div>
            </div>
          </div>

          {/* Row 2 — tagline */}
          <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 20px", textAlign: "center", lineHeight: 1.4 }}>
            <span style={{ color: "#F0997B" }}>BITE</span>
            <span style={{ color: "#F1EFE8" }}> knows the difference.</span>
          </p>

          {/* Row 3 — CTA */}
          <button type="button" style={CTA_BTN} onClick={() => setCard(1)}>
            Show me →
          </button>
          <button type="button" style={{ ...SKIP_LINK, color: "#555553" }} onClick={() => onComplete()}>
            Skip for now
          </button>
          <ProgressDots card={0} onGoTo={setCard} />
        </div>
      </div>
    );
  }

  if (card === 1) {
    return (
      <div style={OVERLAY}>
        <div style={CARD}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1EFE8", margin: "0 0 18px", lineHeight: 1.3, textAlign: "center" }}>
            How much do you care about...
          </h2>
          <WeightSliders
            weights={draftW}
            labels={[
              [t.taste || "Taste", "taste"],
              [t.bangBuck || "Bang per Buck", "bpb"],
              [t.wait || "Wait", "wait"],
            ]}
            onUpdate={draftUpd}
            onReset={() => setDraftW({ ...WEIGHT_DEFAULTS })}
            defaults={WEIGHT_DEFAULTS}
            hideLabel
          />
          <button
            type="button"
            style={{ ...CTA_BTN, marginTop: 20 }}
            onClick={() => { onWeightSave(draftW); setCard(2); }}
          >
            Looks good →
          </button>
          <ProgressDots card={1} onGoTo={setCard} />
        </div>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div style={OVERLAY}>
        <div style={CARD}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1EFE8", margin: "0 0 20px", textAlign: "center" }}>
            Sign in or create an account
          </h2>
          <button type="button" style={CTA_BTN} onClick={() => onComplete("signin")}>
            Sign in or create an account
          </button>
          <button type="button" style={{ ...SKIP_LINK, color: "#555553" }} onClick={() => onComplete()}>
            Maybe later
          </button>
          <ProgressDots card={2} onGoTo={setCard} />
        </div>
      </div>
    );
  }

  return (
    <div style={OVERLAY}>
      <div style={CARD}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1EFE8", margin: "0 0 10px", textAlign: "center" }}>
          Where did you last eat out?
        </h2>
        <p style={{ fontSize: 13, color: "#C4C2BA", margin: "0 0 20px", lineHeight: 1.65, textAlign: "center" }}>
          Log your first BITE.
        </p>
        <button type="button" style={CTA_BTN} onClick={() => onComplete("/add")}>
          + Add Rating
        </button>
        <button type="button" style={SKIP_LINK} onClick={() => onComplete()}>
          I'll do it later
        </button>
        <ProgressDots card={2} onGoTo={setCard} />
      </div>
    </div>
  );
}
