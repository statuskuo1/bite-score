/**
 * Tiny "Open in Maps ↗" affordance for any card / sheet that surfaces a
 * named place. We default to brand orange (matches the rest of the
 * tappable accent copy in feed / explore rows) so it actually reads as a
 * primary action — the previous blue link was getting lost on dark cards.
 *
 * `placeId` here is the Google Places ID (when we have it on the row,
 * not the internal places.id UUID). Passing it tightens the search to
 * the exact establishment instead of fuzzy-matching name + city.
 */

const ACCENT_ORANGE = "#F0997B";

export function MapsLink({
  name,
  city,
  googlePlaceId,
  size = "sm",
  style,
  onClick,
}) {
  if (!name) return null;
  const query = encodeURIComponent([name, city].filter(Boolean).join(", "));
  const placeIdParam = googlePlaceId
    ? `&query_place_id=${encodeURIComponent(googlePlaceId)}`
    : "";
  const href = `https://www.google.com/maps/search/?api=1&query=${query}${placeIdParam}`;

  const fontSize = size === "md" ? 12 : 11;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      style={{
        fontSize,
        color: ACCENT_ORANGE,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        ...style,
      }}
    >
      Open in Maps ↗
    </a>
  );
}
