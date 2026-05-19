import { ScoreDisplay } from "./ScoreDisplay.jsx";

/**
 * Top-of-form chrome: live score preview on the right, blank spacer on the
 * left. Used by both RestForm and CafeForm in add + edit modes.
 *
 * The restaurant/cafe toggle pill that used to live here was removed when
 * the AddEntryTypeChoice picker took over kind selection on /add. The
 * "← Change" link in the form (when `onChangeType` is provided) is the new
 * way to switch kinds.
 */
export function FormScoreHeader({ score, scoreColor, scoreLabel }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "center", marginBottom: 16,
    }}>
      <div />
      <ScoreDisplay value={score} label={scoreLabel} color={scoreColor} size="lg" />
    </div>
  );
}
