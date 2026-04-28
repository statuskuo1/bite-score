/**
 * Profile avatar shared by every community surface (Friends / Compare / Groups).
 *
 * Falls back to a single-letter monogram when `avatar_url` is missing or fails
 * to load. `referrerPolicy="no-referrer"` lets Google avatars render without
 * tripping the default lockdown.
 */
export function Avatar({ profile, size = 32 }) {
  const fallback = (profile?.username || profile?.display_name || "?")
    .charAt(0)
    .toUpperCase();

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        referrerPolicy="no-referrer"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "0.5px solid rgba(255,255,255,0.12)",
        }}
      />
    );
  }

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
