import { useLang } from "../contexts/LangContext.jsx";

/** Tail button for `usePaginatedList`. Renders nothing when there's nothing
 *  left to reveal, so callers can drop it after every paginated list without
 *  guarding. Style matches the dark-card tail spec used across the app. */
export function ShowMoreButton({ remaining, pageSize = 20, onClick }) {
  const { t } = useLang();
  if (!remaining) return null;
  const label = (t.showMoreTemplate || "Show {count} more ({remaining} remaining)")
    .replace("{count}", String(Math.min(pageSize, remaining)))
    .replace("{remaining}", String(remaining));
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        padding: 10,
        background: "transparent",
        border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        color: "#888780",
        fontSize: 13,
        cursor: "pointer",
        marginTop: 8,
      }}
    >
      {label}
    </button>
  );
}
