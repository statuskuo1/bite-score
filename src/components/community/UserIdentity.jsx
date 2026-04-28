import { Avatar } from "./Avatar.jsx";

/**
 * Avatar + display name + @username trio. Used in every community list row
 * (search hits, requests, friends, group members, compare targets).
 *
 * Renders a flex container so callers can drop it anywhere a single child is
 * expected. Action buttons should sit AFTER this component in the same row.
 *
 * `variant`:
 *   - "row"    : 13/11 px, regular weight (list rows, requests, search hits)
 *   - "header" : 14/11 px, semibold name (card / detail headers)
 *
 * `nameSuffix` adds inline annotation after the display name (e.g. "· you",
 * "· owner") without forcing every caller to inline the JSX.
 */
export function UserIdentity({ profile, size = 28, variant = "row", nameSuffix = null }) {
  const isHeader = variant === "header";
  const nameSize = isHeader ? 14 : 13;
  const nameWeight = isHeader ? 500 : 400;
  const handleSize = 11;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
      <Avatar profile={profile} size={size} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: nameSize,
            fontWeight: nameWeight,
            color: "#F1EFE8",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {profile?.display_name || profile?.username || "—"}
          {nameSuffix}
        </div>
        <div style={{ fontSize: handleSize, color: "#888780" }}>
          @{profile?.username || "—"}
        </div>
      </div>
    </div>
  );
}
