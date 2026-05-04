/**
 * Parse a user-typed `mm/dd/yy` (or `mm/dd/yyyy`) string into an ISO
 * timestamp at noon local time. Returns null for empty / unparseable input
 * so callers can fall back to the DB default (`now()`).
 *
 * Two-digit years resolve to the 2000s (25 → 2025). Accepts 1- or 2-digit
 * month/day and tolerates extra whitespace. Validates the calendar — e.g.
 * "02/30/25" returns null because JS's Date normalization would silently
 * shift it to March 2.
 */
export function parseVisitDateInput(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/[\/\-.]/).map((s) => s.trim());
  if (parts.length !== 3) return null;
  const [mStr, dStr, yStr] = parts;

  const m = Number(mStr);
  const d = Number(dStr);
  let y = Number(yStr);
  if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) return null;

  if (yStr.length <= 2) {
    y = 2000 + y;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;

  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date.toISOString();
}

/**
 * Inverse of `parseVisitDateInput` — format an ISO timestamp (or anything the
 * Date constructor accepts) into a `mm/dd/yy` string suitable for the form's
 * "Visit date" input. Returns "" on falsy / unparseable input so callers can
 * spread the result into a prefill without polluting it.
 *
 * Uses local-time month/day/year so a visit stored at e.g. noon UTC doesn't
 * render as the wrong day for users west of UTC. Matches the noon-local
 * convention `parseVisitDateInput` writes back.
 */
export function formatVisitDateInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}
