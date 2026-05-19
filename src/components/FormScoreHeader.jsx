import { ScoreDisplay } from "./ScoreDisplay.jsx";

/**
 * Live score preview pinned to the top-right of the parent form card so it
 * sits inline with the "← Change" link and "THE BASICS" section label on the
 * left. Renders a small "BITE Score" caption above the value.
 *
 * The parent card must set `position: "relative"` for this absolute anchor
 * to work. Used by both RestForm and CafeForm in add + edit modes.
 */
export function FormScoreHeader({ score, scoreColor, scoreLabel }) {
  return (
    <div style={{
      position: "absolute",
      top: "1rem",
      right: "1.25rem",
      textAlign: "right",
    }}>
      <div style={{
        fontSize: 10, color: "#888780", letterSpacing: "0.06em",
        textTransform: "uppercase", marginBottom: 4,
      }}>
        BITE Score
      </div>
      <ScoreDisplay value={score} label={scoreLabel} color={scoreColor} size="lg" />
    </div>
  );
}
