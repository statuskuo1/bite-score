/**
 * Profile avatar shared by every community surface (Friends / Compare / Groups).
 *
 * Profile photos are intentionally not rendered — we always show a single-letter
 * monogram derived from username / display_name. `avatar_url` may still be
 * present on the profile (synced from Google OAuth into `profiles.avatar_url`),
 * but it is ignored here. To re-enable photos, restore the `<img>` branch.
 */
export function Avatar({ profile, size = 32 }) {
  const fallback = (profile?.username || profile?.display_name || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "#3C1F13",
        color: "#F0997B",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
      }}
    >
      {fallback}
    </div>
  );
}
