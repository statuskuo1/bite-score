import { useLang } from "../contexts/LangContext.jsx";
import { Pill } from "./Pill.jsx";
import { ScoreDisplay } from "./ScoreDisplay.jsx";

/**
 * Top-of-form chrome: "Restaurant / Cafe" toggle pill on the left,
 * live score preview on the right. Used by both RestForm and CafeForm.
 *
 * If `addType` is undefined the pill toggle is omitted (e.g. edit mode).
 */
export function FormScoreHeader({
  addType,
  setAddType,
  score,
  scoreColor,
  scoreLabel,
}) {
  const { t } = useLang();
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "center", marginBottom: 16,
    }}>
      {addType !== undefined ? (
        <div style={{
          display: "flex", gap: 0, background: "#141413",
          borderRadius: 20, padding: 3,
        }}>
          <Pill active={addType === "restaurant"} onClick={() => setAddType("restaurant")}>{t.restaurantTab}</Pill>
          <Pill active={addType === "cafe"} onClick={() => setAddType("cafe")}>{t.cafeTab}</Pill>
        </div>
      ) : (
        <div />
      )}
      <ScoreDisplay value={score} label={scoreLabel} color={scoreColor} size="lg" />
    </div>
  );
}
