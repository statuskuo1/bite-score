import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./community/Avatar.jsx";
import { Pill } from "./community/Pill.jsx";

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Render a single notification row. After the 2026-05-04 tagging refactor
 * the live (new-write) types are:
 *   – follow / taste_buds  (unchanged)
 *   – heart_reaction       (unchanged)
 *   – group_visit_tagged   (variants: standard / auto_linked / pick_visit)
 *   – group_visit_all_logged (NEW — fanned out by the auto-resolve trigger)
 *
 * The panel still renders legacy types (`dine_tag`, `dine_tag_back`,
 * `dine_tag_accepted`, `dine_tag_mutual`, `group_visit_logged`) that live
 * in the DB from before the refactor, but nothing in the app writes them
 * anymore. See src/_archive/dine-tag-notifications.md.
 */
function NotifRow({
  notif,
  isResolvedDineTag,
  onFollowBack,
  onRefetch,
  onOpenProfile,
  onDineTagTap,
  onDineTagBackTap,
  onFollowTap,
  onDineTagAcceptedTap,
  onHeartTap,
  onTagMutualBack,
  onGroupVisitMutualBack,
  onGroupVisitTaggedTap,
  onGroupVisitLoggedTap,
  onGroupVisitAllLoggedTap,
  alreadyFollowed,
  onMarkFollowed,
  followingIds,
}) {
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

  // Live types (post-2026-05-04 refactor).
  const isGroupVisitTagged = notif.type === "group_visit_tagged";
  const isGroupVisitAllLogged = notif.type === "group_visit_all_logged";
  const isHeartReaction = notif.type === "heart_reaction";
  // Legacy types — only for DB rows written before the refactor.
  const isDineTag = notif.type === "dine_tag";
  const isDineTagBack = notif.type === "dine_tag_back";
  const isDineTagAccepted = notif.type === "dine_tag_accepted";
  const isDineTagMutual = notif.type === "dine_tag_mutual";
  const isGroupVisitLogged = notif.type === "group_visit_logged";

  const restaurantName = notif.meta?.restaurant_name || notif.meta?.place_name || "a place";
  // group_visit_tagged carries its variant on meta (set at insert time).
  const groupVisitVariant = isGroupVisitTagged ? (notif.meta?.variant || "standard") : null;
  const isGroupVisitAutoLinked = isGroupVisitTagged && groupVisitVariant === "auto_linked";
  const isGroupVisitPickVisit = isGroupVisitTagged && groupVisitVariant === "pick_visit";
  const isGroupVisitAutoLinkedResolved = isGroupVisitAutoLinked && !!notif.meta?.tagged_back;
  // Legacy dine_tag_mutual rows still show the inline tag-back UI; new
  // auto_linked group_visit_tagged rows use the same inline flow, re-
  // labeled "Tag to my entry ✓" to match the new semantics.
  const showTagToEntryUi = isDineTagMutual || (isGroupVisitAutoLinked && !isGroupVisitAutoLinkedResolved);
  // Legacy `dine_tag` whose underlying dine_with_tags row is gone — render past-tense.
  const isResolved = isDineTag && isResolvedDineTag;

  async function handleTagToEntry() {
    setBusy(true);
    try {
      if (isGroupVisitAutoLinked) {
        await onGroupVisitMutualBack?.(notif);
      } else {
        await onTagMutualBack?.(notif);
      }
      setTaggedBack(true);
      setShowConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  const someoneHandle = `@${p?.username || "someone"}`;
  const message = isResolved
    ? `${someoneHandle} tagged you at ${restaurantName}`
    : isDineTag
      ? `All bark no BITE 🐶 ${someoneHandle} tagged you at ${restaurantName}. Log your BITE?`
      : isDineTagMutual
        ? `${someoneHandle} tagged you at ${restaurantName}. Looks like you already logged! Tag them to your entry?`
        : isDineTagBack
          ? `${someoneHandle} tagged you back at ${restaurantName}. See their BITE Score`
          : isDineTagAccepted
            ? `${someoneHandle} tagged you back at ${restaurantName}. See their BITE Score`
            : isHeartReaction
              ? `${someoneHandle} hearted your BITE at ${restaurantName} ❤️`
              : isGroupVisitTagged
                ? groupVisitVariant === "auto_linked"
                  ? `${someoneHandle} tagged you at ${restaurantName}. Looks like you already logged! Tag them to your entry?`
                  : groupVisitVariant === "pick_visit"
                    ? `You've been to ${restaurantName} a few times recently — which visit was with ${someoneHandle}?`
                    : `All bark no BITE 🐶 ${someoneHandle} tagged you at ${restaurantName}. Log your BITE?`
                : isGroupVisitAllLogged
                  ? `🎉 Look at you! The whole party logged at ${restaurantName}.`
                  : isGroupVisitLogged
                    ? `${someoneHandle} logged their visit at ${restaurantName} with you.`
                    : isTasteBuds
                      ? `You and ${someoneHandle} are now Taste Buds! 🎉`
                      : `${someoneHandle} followed you`;

  const handleRowTap = isResolved
    ? () => p && onOpenProfile(p)
    : isGroupVisitAutoLinkedResolved
      ? () => p && onOpenProfile(p)
      : isDineTag
        ? () => onDineTagTap?.(notif)
        : isDineTagMutual
          ? () => { if (!taggedBack) setShowConfirm((v) => !v); }
          : isGroupVisitAutoLinked
            ? () => { if (!taggedBack) setShowConfirm((v) => !v); }
            : isGroupVisitPickVisit
              ? () => onGroupVisitTaggedTap?.(notif)
              : isHeartReaction
                ? () => onHeartTap?.(notif)
                : isDineTagBack
                  ? () => onDineTagBackTap?.(notif)
                  : isDineTagAccepted
                    ? () => onDineTagAcceptedTap?.(notif)
                    : isGroupVisitTagged
                      ? () => onGroupVisitTaggedTap?.(notif)
                      : isGroupVisitAllLogged
                        ? () => onGroupVisitAllLoggedTap?.(notif)
                        : isGroupVisitLogged
                          ? () => onGroupVisitLoggedTap?.(notif)
                          : notif.type === "follow"
                            ? () => onFollowTap?.(notif)
                            : () => p && onOpenProfile(p);

  const messageIsInteractive = !isResolved
    && !isGroupVisitAutoLinkedResolved
    && (isDineTagMutual || isDineTag || isHeartReaction || isGroupVisitTagged || isGroupVisitAllLogged || isGroupVisitLogged);

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
              style={{ background: "none", border: "none", padding: 0, cursor: messageIsInteractive ? "pointer" : "default", color: (isResolved || isGroupVisitAutoLinkedResolved) ? "#888780" : "inherit", fontSize: "inherit", textAlign: "left" }}
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
        {(isDineTagMutual || isGroupVisitAutoLinked) && taggedBack && (
          <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>Tagged ✓</span>
        )}
      </div>

      {showTagToEntryUi && showConfirm && !taggedBack && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, paddingLeft: 46 }}>
          <button
            type="button"
            onClick={handleTagToEntry}
            disabled={busy}
            style={{
              flex: 1, padding: "7px 10px", borderRadius: 8, border: "none",
              background: "#F0997B", color: "#141413", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {busy ? "…" : "Tag to my entry ✓"}
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
  notifications, resolvedDineTagIds, loading, onClose, onFollowBack, onRefetch,
  onOpenProfile, onDineTagTap, onDineTagBackTap, onFollowTap, onDineTagAcceptedTap,
  onHeartTap, onTagMutualBack, onGroupVisitMutualBack, onGroupVisitTaggedTap, onGroupVisitLoggedTap,
  onGroupVisitAllLoggedTap,
  sheetOpen, anchorPos, followingIds,
}) {
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
            isResolvedDineTag={resolvedDineTagIds?.has(n.id) ?? false}
            onFollowBack={onFollowBack}
            onRefetch={onRefetch}
            onOpenProfile={onOpenProfile}
            onDineTagTap={onDineTagTap}
            onDineTagBackTap={onDineTagBackTap}
            onFollowTap={onFollowTap}
            onDineTagAcceptedTap={onDineTagAcceptedTap}
            onHeartTap={onHeartTap}
            onTagMutualBack={onTagMutualBack}
            onGroupVisitMutualBack={onGroupVisitMutualBack}
            onGroupVisitTaggedTap={onGroupVisitTaggedTap}
            onGroupVisitLoggedTap={onGroupVisitLoggedTap}
            onGroupVisitAllLoggedTap={onGroupVisitAllLoggedTap}
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
