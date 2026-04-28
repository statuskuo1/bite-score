import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  searchUsersByUsername,
  sendFriendRequest,
  acceptFriendRequest,
  deleteFriendship,
  listFriendships,
} from "../../utils/friendsApi.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import { pairCompatibility } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";

function avatar(profile, size = 32) {
  const fallback = (profile?.username || profile?.display_name || "?").charAt(0).toUpperCase();
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        referrerPolicy="no-referrer"
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "0.5px solid rgba(255,255,255,0.12)",
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#3C1F13", color: "#F0997B",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.42), fontWeight: 600,
    }}>{fallback}</div>
  );
}

function PillButton({ children, onClick, tone = "default", disabled }) {
  const palette = tone === "primary"
    ? { bg: "#F0997B", color: "#141413", border: "#F0997B" }
    : tone === "danger"
    ? { bg: "transparent", color: "#A32D2D", border: "rgba(163,45,45,0.5)" }
    : tone === "muted"
    ? { bg: "transparent", color: "#888780", border: "rgba(255,255,255,0.1)" }
    : { bg: "#3C1F13", color: "#F0997B", border: "rgba(240,153,123,0.4)" };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 12px", borderRadius: 14, fontSize: 12,
        background: palette.bg, color: palette.color,
        border: "1px solid " + palette.border,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >{children}</button>
  );
}

/**
 * Friend a single user. The button label depends on the existing relationship
 * (none / outgoing-pending / incoming-pending / friends).
 */
function FriendRowAction({ profile, relation, busy, onAdd, onAccept, onCancel, onDecline, onUnfriend, onCompareWith }) {
  const { t } = useLang();
  if (busy) return <span style={{ fontSize: 11, color: "#888780" }}>…</span>;
  switch (relation?.kind) {
    case "friends":
      return (
        <div style={{ display: "flex", gap: 6 }}>
          {onCompareWith && (
            <PillButton onClick={() => onCompareWith(profile)} tone="default">
              {t.compareSub}
            </PillButton>
          )}
          <PillButton onClick={() => onUnfriend(relation.row.id)} tone="danger">
            {t.unfriend}
          </PillButton>
        </div>
      );
    case "outgoing":
      return (
        <PillButton onClick={() => onCancel(relation.row.id)} tone="muted">
          {t.cancelRequest}
        </PillButton>
      );
    case "incoming":
      return (
        <div style={{ display: "flex", gap: 6 }}>
          <PillButton onClick={() => onAccept(relation.row.id)} tone="primary">
            {t.acceptRequest}
          </PillButton>
          <PillButton onClick={() => onDecline(relation.row.id)} tone="muted">
            {t.declineRequest}
          </PillButton>
        </div>
      );
    default:
      return (
        <PillButton onClick={() => onAdd(profile.id)} tone="primary">
          {t.addFriend}
        </PillButton>
      );
  }
}

/**
 * One accepted-friend card with collapsible "top picks" (their highest taste
 * restaurant visits) and the live compatibility % between you and them.
 */
function FriendCard({ friendship, myVisits, onCompareWith, onUnfriend }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [theirVisits, setTheirVisits] = useState(null);

  useEffect(() => {
    if (!open || theirVisits) return;
    let cancelled = false;
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, friendship.otherUserId);
      if (!cancelled) setTheirVisits(v);
    })();
    return () => { cancelled = true; };
  }, [open, theirVisits, friendship.otherUserId]);

  const compat = useMemo(() => {
    if (!theirVisits) return null;
    return pairCompatibility(myVisits || [], theirVisits || []);
  }, [theirVisits, myVisits]);

  const topPicks = useMemo(() => {
    if (!theirVisits) return [];
    return [...theirVisits]
      .filter((v) => Number.isFinite(+v.taste))
      .sort((a, b) => b.taste - a.taste)
      .slice(0, 5);
  }, [theirVisits]);

  const profile = friendship.otherProfile;
  const compatColor = compat?.score != null ? tasteColor((compat.score / 10)) : "#888780";

  return (
    <div style={{
      background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: "10px 12px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {avatar(profile)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile?.display_name || profile?.username || "—"}
          </div>
          <div style={{ fontSize: 11, color: "#888780" }}>@{profile?.username || "—"}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <PillButton onClick={() => onCompareWith(profile)} tone="default">{t.compareSub}</PillButton>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              fontSize: 18, color: "#888780", background: "none", border: "none",
              cursor: "pointer", lineHeight: 1, padding: "0 4px",
            }}
            aria-label={open ? "Collapse" : "Expand"}
          >{open ? "▾" : "▸"}</button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
          {theirVisits == null ? (
            <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>…</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {t.compatibility}
                </span>
                {compat?.score != null ? (
                  <span style={{ fontSize: 18, fontWeight: 600, color: compatColor }}>
                    {compat.score}%
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "#888780" }}>{t.notEnoughSharedData}</span>
                )}
              </div>

              <div style={{ marginBottom: 4, fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.topPicks}
              </div>
              {!topPicks.length && (
                <p style={{ fontSize: 12, color: "#888780", margin: "4px 0 0" }}>{t.noEntriesYet}</p>
              )}
              {topPicks.map((v) => (
                <div key={v.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "4px 0", fontSize: 12,
                }}>
                  <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: "#F1EFE8" }}>{v.name}</span>
                    {v.cuisine && (
                      <span style={{ color: "#888780", marginLeft: 6 }}>· {v.cuisine}</span>
                    )}
                  </div>
                  <span style={{ color: tasteColor(+v.taste), fontWeight: 500, marginLeft: 8 }}>
                    {(+v.taste).toFixed(1)}
                  </span>
                </div>
              ))}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <PillButton onClick={() => onUnfriend(friendship.id)} tone="danger">
              {t.unfriend}
            </PillButton>
          </div>
        </div>
      )}
    </div>
  );
}

export function FriendsTab({ user, onCompareWith }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [busyById, setBusyById] = useState({});
  const [myVisits, setMyVisits] = useState([]);
  const debounceRef = useRef(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const { friends: f, incoming: i, outgoing: o } = await listFriendships(supabase, user.id);
    setFriends(f);
    setIncoming(i);
    setOutgoing(o);
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, user.id);
      if (!cancelled) setMyVisits(v);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /** Debounced username prefix search. Empty string clears results. */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setResults([]); setSearchBusy(false); return; }
    setSearchBusy(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchUsersByUsername(supabase, q, user?.id);
      setResults(r);
      setSearchBusy(false);
    }, 220);
    return () => clearTimeout(debounceRef.current);
  }, [query, user?.id]);

  /** Map every other-user-id we know about → their relation kind + row. */
  const relationByUserId = useMemo(() => {
    const m = new Map();
    for (const r of friends) m.set(r.otherUserId, { kind: "friends", row: r });
    for (const r of incoming) m.set(r.otherUserId, { kind: "incoming", row: r });
    for (const r of outgoing) m.set(r.otherUserId, { kind: "outgoing", row: r });
    return m;
  }, [friends, incoming, outgoing]);

  function setBusy(id, on) {
    setBusyById((m) => ({ ...m, [id]: on }));
  }

  async function handleAdd(targetId) {
    if (!user?.id || !targetId) return;
    setBusy(targetId, true);
    try {
      await sendFriendRequest(supabase, user.id, targetId);
      await reload();
    } finally {
      setBusy(targetId, false);
    }
  }

  async function handleAccept(friendshipId) {
    setBusy(friendshipId, true);
    try {
      await acceptFriendRequest(supabase, friendshipId);
      await reload();
    } finally {
      setBusy(friendshipId, false);
    }
  }

  async function handleRemove(friendshipId) {
    setBusy(friendshipId, true);
    try {
      await deleteFriendship(supabase, friendshipId);
      await reload();
    } finally {
      setBusy(friendshipId, false);
    }
  }

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <input
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value.toLowerCase())}
          placeholder={t.searchByUsername}
          style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }}
        />
      </div>

      {query.trim() && (
        <div style={{ marginBottom: 16 }}>
          {searchBusy && (
            <p style={{ fontSize: 12, color: "#888780", margin: "0 0 6px" }}>…</p>
          )}
          {!searchBusy && !results.length && (
            <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noSearchResults}</p>
          )}
          {results.map((p) => {
            const rel = relationByUserId.get(p.id);
            const busy = !!busyById[p.id] || !!busyById[rel?.row?.id];
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", marginBottom: 6,
                background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
              }}>
                {avatar(p, 28)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.display_name || p.username}
                  </div>
                  <div style={{ fontSize: 11, color: "#888780" }}>@{p.username}</div>
                </div>
                <FriendRowAction
                  profile={p}
                  relation={rel}
                  busy={busy}
                  onAdd={handleAdd}
                  onAccept={handleAccept}
                  onCancel={handleRemove}
                  onDecline={handleRemove}
                  onUnfriend={handleRemove}
                  onCompareWith={onCompareWith}
                />
              </div>
            );
          })}
        </div>
      )}

      {incoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {t.incomingRequests}
          </div>
          {incoming.map((r) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", marginBottom: 6,
              background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
            }}>
              {avatar(r.otherProfile, 28)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.otherProfile?.display_name || r.otherProfile?.username || "—"}
                </div>
                <div style={{ fontSize: 11, color: "#888780" }}>@{r.otherProfile?.username || "—"}</div>
              </div>
              <FriendRowAction
                profile={r.otherProfile}
                relation={{ kind: "incoming", row: r }}
                busy={!!busyById[r.id]}
                onAdd={() => {}}
                onAccept={handleAccept}
                onCancel={handleRemove}
                onDecline={handleRemove}
                onUnfriend={handleRemove}
              />
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {t.outgoingRequests}
          </div>
          {outgoing.map((r) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", marginBottom: 6,
              background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
            }}>
              {avatar(r.otherProfile, 28)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.otherProfile?.display_name || r.otherProfile?.username || "—"}
                </div>
                <div style={{ fontSize: 11, color: "#888780" }}>@{r.otherProfile?.username || "—"}</div>
              </div>
              <PillButton onClick={() => handleRemove(r.id)} tone="muted" disabled={!!busyById[r.id]}>
                {t.cancelRequest}
              </PillButton>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {t.friendsList}
      </div>
      {!friends.length && (
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noFriendsYet}</p>
      )}
      {friends.map((f) => (
        <FriendCard
          key={f.id}
          friendship={f}
          myVisits={myVisits}
          onCompareWith={onCompareWith}
          onUnfriend={handleRemove}
        />
      ))}
    </div>
  );
}
