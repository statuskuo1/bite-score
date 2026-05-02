import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./community/Avatar.jsx";
import { Pill } from "./community/Pill.jsx";
import { useLang } from "../contexts/LangContext.jsx";

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotifRow({ notif, onFollowBack, onRefetch, onOpenProfile, onDineTagTap, onDineTagBackTap, onFollowTap, onDineTagAcceptedTap, onHeartTap, onTagMutualBack, alreadyFollowed, onMarkFollowed, followingIds }) {
  const [followed, setFollowed] = useState(false);
  const [isTasteBuds, setIsTasteBuds] = useState(notif.type === "taste_buds");
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [taggedBack, setTaggedBack] = useState(false);
  const p = notif.fromProfile;
  const isFollowed = followed || alreadyFollowed || (followingIds?.has(notif.from_user_id) ?? false);

  async function handleFollowBack() {
    if (busy || isFollowed) return;
    setBusy(true);
    try {
      const res = await onFollowBack(notif.from_user_id);
      setFollowed(true);
      onMarkFollowed?.(notif.id);
      if (res?.isMutual) setIsTasteBuds(true);
      await onRefetch?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleTagBack() {
    setBusy(true);
    try {
      await onTagMutualBack?.(notif);
      setTaggedBack(true);
      setShowConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  const isDineTag = notif.type === "dine_tag";
  const isDineTagBack = notif.type === "dine_tag_back";
  const isDineTagAccepted = notif.type === "dine_tag_accepted";
  const isDineTagMutual = notif.type === "dine_tag_mutual";
  const isHeartReaction = notif.type === "heart_reaction";
  const restaurantName = notif.meta?.restaurant_name || notif.meta?.place_name || "a place";
  const message = isDineTag
    ? `All bark no BITE 🐶 @${p?.username || "someone"} tagged you at ${restaurantName}. Log your BITE?`
    : isDineTagMutual
      ? `@${p?.username || "someone"} tagged you at ${restaurantName}. Looks like you already logged! Tag them back?`
      : isDineTagBack
        ? `@${p?.username || "someone"} tagged you back at ${restaurantName}. see their BITE Score`
        : isDineTagAccepted
          ? `@${p?.username || "someone"} tagged you back at ${restaurantName}. see their BITE Score`
          : isHeartReaction
            ? `@${p?.username || "someone"} hearted your BITE at ${restaurantName} ❤️`
            : isTasteBuds
              ? `You and @${p?.username || "someone"} are now Taste Buds! 🎉`
              : `@${p?.username || "someone"} followed you`;

  const handleRowTap = isDineTag
    ? () => onDineTagTap?.(notif)
    : isDineTagMutual
      ? () => { if (!taggedBack) setShowConfirm((v) => !v); }
      : isHeartReaction
        ? () => onHeartTap?.(notif)
        : isDineTagBack
          ? () => onDineTagBackTap?.(notif)
          : isDineTagAccepted
            ? () => (notif.meta?.entry_id && notif.meta?.entry_type)
                ? onDineTagAcceptedTap?.(notif)
                : p && onOpenProfile(p)
            : notif.type === "follow"
              ? () => onFollowTap?.(notif)
              : () => p && onOpenProfile(p);

  return (
    <div style={{
      padding: "10px 12px",
      borderLeft: notif.read ? "none" : "2px solid #F0997B",
      paddingLeft: notif.read ? 12 : 10,
      borderBottom: "0.5px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={handleRowTap}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}
        >
          <Avatar profile={p} size={36} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "#F1EFE8", lineHeight: 1.4 }}>
            <button
              type="button"
              onClick={handleRowTap}
              style={{ background: "none", border: "none", padding: 0, cursor: isDineTagMutual || isDineTag || isHeartReaction ? "pointer" : "default", color: "inherit", fontSize: "inherit", textAlign: "left" }}
            >
              {message}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#666663", marginTop: 2 }}>
            {relativeTime(notif.created_at)}
          </div>
        </div>

        {notif.type === "follow" && !isFollowed && (
          <div style={{ flexShrink: 0 }}>
            {busy ? (
              <span style={{ fontSize: 11, color: "#888780" }}>…</span>
            ) : (
              <Pill onClick={handleFollowBack} tone="primary">Follow back</Pill>
            )}
          </div>
        )}
        {notif.type === "follow" && isFollowed && !isTasteBuds && (
          <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>Following</span>
        )}
        {isDineTagMutual && taggedBack && (
          <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>Tagged ✓</span>
        )}
      </div>

      {isDineTagMutual && showConfirm && !taggedBack && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, paddingLeft: 46 }}>
          <button
            type="button"
            onClick={handleTagBack}
            disabled={busy}
            style={{
              flex: 1, padding: "7px 10px", borderRadius: 8, border: "none",
              background: "#F0997B", color: "#141413", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {busy ? "…" : "Tag them back ✓"}
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            style={{
              padding: "7px 12px", borderRadius: 8,
              background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)",
              color: "#888780", fontSize: 12, cursor: "pointer",
            }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

export function NotificationPanel({
  notifications, loading, onClose, onFollowBack, onRefetch,
  onOpenProfile, onDineTagTap, onDineTagBackTap, onFollowTap, onDineTagAcceptedTap,
  onHeartTap, onTagMutualBack, sheetOpen, anchorPos, followingIds,
}) {
  const { t } = useLang();
  const panelRef = useRef(null);
  const [followedIds, setFollowedIds] = useState(() => new Set());

  function markFollowed(id) {
    setFollowedIds((prev) => new Set([...prev, id]));
  }

  useEffect(() => {
    function handler(e) {
      if (sheetOpen) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, sheetOpen]);

  const top = anchorPos?.top ?? 64;
  const narrow = window.innerWidth < 480;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top,
        right: 16,
        ...(narrow ? { left: 16 } : { width: 320 }),
        maxWidth: "calc(100vw - 32px)",
        maxHeight: Math.min(440, window.innerHeight - top - 24),
        overflowY: "auto",
        background: "#1E1E1C",
        border: "0.5px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: 500,
      }}
    >
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: "0.5px solid rgba(255,255,255,0.1)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#F1EFE8" }}>Notifications</span>
        <button type="button" onClick={onClose}
          style={{ fontSize: 18, color: "#888780", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>
          ×
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "20px 14px", fontSize: 13, color: "#888780", textAlign: "center" }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: "24px 14px", fontSize: 13, color: "#888780", textAlign: "center" }}>No notifications yet.</div>
      ) : (
        notifications.map((n) => (
          <NotifRow
            key={n.id}
            notif={n}
            onFollowBack={onFollowBack}
            onRefetch={onRefetch}
            onOpenProfile={onOpenProfile}
            onDineTagTap={onDineTagTap}
            onDineTagBackTap={onDineTagBackTap}
            onFollowTap={onFollowTap}
            onDineTagAcceptedTap={onDineTagAcceptedTap}
            onHeartTap={onHeartTap}
            onTagMutualBack={onTagMutualBack}
            alreadyFollowed={followedIds.has(n.id)}
            onMarkFollowed={markFollowed}
            followingIds={followingIds}
          />
        ))
      )}
    </div>,
    document.body,
  );
}
