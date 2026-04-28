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
import { pairCompatibility, aggregateFriendsTopPicks } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Pill } from "./Pill.jsx";
import { Avatar } from "./Avatar.jsx";
import { UserIdentity } from "./UserIdentity.jsx";

const ROW_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  marginBottom: 6,
  background: "#1E1E1C",
  border: "0.5px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
};

const SECTION_LABEL_STYLE = {
  fontSize: 11,
  color: "#F0997B",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
  marginBottom: 6,
};

const FLAG_BOX_STYLE = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: "#252523",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  flexShrink: 0,
};

/** Map sendFriendRequest result codes onto user-visible reasons. */
function describeAddFriendError(code, t) {
  switch (code) {
    case "already_friends": return t.alreadyFriends || "Already friends";
    case "already_pending": return t.requestSentLabel || "Request already sent";
    case "self": return t.cannotAddSelf || "You can't add yourself";
    case "invalid":
    case "network":
    default:
      return t.addFriendFailed || "Couldn't send request — try again.";
  }
}

/** Tier-colored pill that reads as "78% match". Same color ramp as the
 *  Compare-tab badge so the two views stay visually consistent. */
function MatchPill({ score, suffix }) {
  if (score == null) {
    return (
      <span style={{
        padding: "5px 12px", borderRadius: 999, fontSize: 11,
        background: "transparent", color: "#888780",
        border: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap",
      }}>—</span>
    );
  }
  const col = tasteColor(score / 10);
  return (
    <span style={{
      padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: `${col}22`,
      color: col,
      border: `1px solid ${col}66`,
      whiteSpace: "nowrap",
    }}>
      {score}%{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

function flagFor(cuisine, name) {
  return FLAGS[cuisine] || (cuisine?.[0] || name?.[0] || "?").toUpperCase();
}

/** Mode (most frequent) value of `field` across `rows`, ignoring blanks. */
function modeOf(rows, field) {
  const counts = new Map();
  for (const r of rows || []) {
    const v = (r?.[field] || "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return best;
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
            <Pill onClick={() => onCompareWith(profile)} tone="default">
              {t.compareSub}
            </Pill>
          )}
          <Pill onClick={() => onUnfriend(relation.row.id)} tone="danger">
            {t.unfriend}
          </Pill>
        </div>
      );
    case "outgoing":
      return (
        <Pill onClick={() => onCancel(relation.row.id)} tone="muted">
          {t.cancelRequest}
        </Pill>
      );
    case "incoming":
      return (
        <div style={{ display: "flex", gap: 6 }}>
          <Pill onClick={() => onAccept(relation.row.id)} tone="primary">
            {t.acceptRequest}
          </Pill>
          <Pill onClick={() => onDecline(relation.row.id)} tone="muted">
            {t.declineRequest}
          </Pill>
        </div>
      );
    default:
      return (
        <Pill onClick={() => onAdd(profile.id)} tone="primary">
          {t.addFriend}
        </Pill>
      );
  }
}

/** One always-visible friend card. Click → jump to Compare with that friend.
 *  The compatibility pill is computed eagerly (`pairCompatibility`) so the
 *  user can scan the list and pick whom to compare against without expanding.
 *  We bypass `UserIdentity` because the sub-line shows ratings + city instead
 *  of `@username`. */
function FriendListRow({ friendship, stats, onCompareWith }) {
  const { t } = useLang();
  const profile = friendship.otherProfile;
  const subParts = [];
  if (stats?.ratings != null) {
    subParts.push(`${stats.ratings} ${t.ratingsLabel || "ratings"}`);
  }
  if (stats?.city) subParts.push(stats.city);
  const subLine = subParts.length ? subParts.join(" · ") : (profile?.username ? `@${profile.username}` : "");
  const name = profile?.display_name || profile?.username || "—";
  return (
    <button
      type="button"
      onClick={() => onCompareWith?.(profile)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", marginBottom: 8, width: "100%",
        background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 12, cursor: "pointer", textAlign: "left",
      }}
    >
      <Avatar profile={profile} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: "#F1EFE8",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{name}</div>
        <div style={{
          fontSize: 11, color: "#888780",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{subLine}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <MatchPill score={stats?.compatScore ?? null} suffix={t.matchSuffix} />
        <span style={{
          padding: "5px 12px", borderRadius: 14, fontSize: 12,
          background: "#3C1F13", color: "#F0997B",
          border: "1px solid rgba(240,153,123,0.4)", whiteSpace: "nowrap",
        }}>{t.compareSub}</span>
      </div>
    </button>
  );
}

/** One row in the aggregated "Friends' top picks" section. */
function TopPickRow({ pick }) {
  const { t } = useLang();
  const col = tasteColor(pick.avg);
  return (
    <div style={ROW_STYLE}>
      <div style={FLAG_BOX_STYLE}>{flagFor(pick.cuisine, pick.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: "#F1EFE8",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{pick.name}</div>
        <div style={{ fontSize: 11, color: "#888780", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[pick.cuisine || null, `avg ${pick.avg.toFixed(2)}`].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: col, lineHeight: 1.1 }}>
          {pick.avg.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>
          {pick.friendCount} {t.friendsCountSuffix || "friends"}
        </div>
      </div>
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
  /** `friendVisits` is `Map<friendUserId, visits[]>` — populated lazily after
   *  the friends list resolves. We fetch in parallel; per-friend rows show
   *  "—" until their slot fills in, which keeps the UI responsive. */
  const [friendVisits, setFriendVisits] = useState({});
  /** `addError`: { targetId, message } | null. Inline so failures don't pop a modal. */
  const [addError, setAddError] = useState(null);
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

  /** Eagerly fetch each accepted friend's restaurant visits in parallel. We
   *  only re-fetch users we don't already have; a friend who appears, vanishes,
   *  and re-appears keeps their cached visits without a round-trip. */
  useEffect(() => {
    if (!friends.length) return;
    const missing = friends
      .map((f) => f.otherUserId)
      .filter((uid) => uid && !(uid in friendVisits));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        missing.map(async (uid) => [uid, await fetchRestaurantVisitsForUser(supabase, uid)]),
      );
      if (cancelled) return;
      setFriendVisits((prev) => {
        const next = { ...prev };
        for (const [uid, v] of pairs) next[uid] = v;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [friends, friendVisits]);

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

  /** Per-friend stats: compatibility %, ratings count, primary city. */
  const friendStats = useMemo(() => {
    const out = {};
    for (const f of friends) {
      const v = friendVisits[f.otherUserId];
      if (!v) {
        out[f.otherUserId] = { ratings: null, city: "", compatScore: null };
        continue;
      }
      const compat = pairCompatibility(myVisits, v);
      out[f.otherUserId] = {
        ratings: v.length,
        city: modeOf(v, "city"),
        compatScore: compat?.score ?? null,
      };
    }
    return out;
  }, [friends, friendVisits, myVisits]);

  /** Aggregated Friends' top picks: places visited by ≥2 friends rank above
   *  same-avg single-friend picks (`aggregateFriendsTopPicks` already
   *  tiebreaks on friendCount). Capped to the top 10 to keep the section
   *  scannable; tap-through to the place is a future hook. */
  const topPicks = useMemo(() => {
    const fvb = friends
      .map((f) => ({ userId: f.otherUserId, visits: friendVisits[f.otherUserId] }))
      .filter((x) => Array.isArray(x.visits));
    if (!fvb.length) return [];
    return aggregateFriendsTopPicks(fvb).slice(0, 10);
  }, [friends, friendVisits]);

  function setBusy(id, on) {
    setBusyById((m) => ({ ...m, [id]: on }));
  }

  /**
   * Send a request, then reload. We surface failures inline so users see *why*
   * the button "did nothing" instead of guessing — the most common cases are
   * already-pending and network/RLS rejection.
   */
  async function handleAdd(targetId) {
    if (!user?.id || !targetId) return;
    setAddError(null);
    setBusy(targetId, true);
    try {
      const res = await sendFriendRequest(supabase, user.id, targetId);
      if (!res?.ok) {
        setAddError({ targetId, message: describeAddFriendError(res?.code, t) });
      }
      // Reload either way: `already_pending` / `already_friends` should still
      // refresh the relation map so the row's button switches to the right state.
      await reload();
    } catch (err) {
      console.warn("[BITE] handleAdd threw:", err);
      setAddError({ targetId, message: describeAddFriendError("network", t) });
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
            const errForRow = addError?.targetId === p.id ? addError.message : null;
            return (
              <div key={p.id}>
                <div style={ROW_STYLE}>
                  <UserIdentity profile={p} size={28} />
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
                {errForRow && (
                  <p style={{
                    fontSize: 11, color: "#A32D2D",
                    margin: "-2px 0 8px 4px",
                  }}>
                    {errForRow}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {incoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={SECTION_LABEL_STYLE}>{t.incomingRequests}</div>
          {incoming.map((r) => (
            <div key={r.id} style={ROW_STYLE}>
              <UserIdentity profile={r.otherProfile} size={28} />
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
          <div style={SECTION_LABEL_STYLE}>{t.outgoingRequests}</div>
          {outgoing.map((r) => (
            <div key={r.id} style={ROW_STYLE}>
              <UserIdentity profile={r.otherProfile} size={28} />
              <Pill onClick={() => handleRemove(r.id)} tone="muted" disabled={!!busyById[r.id]}>
                {t.cancelRequest}
              </Pill>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...SECTION_LABEL_STYLE, display: "flex", justifyContent: "space-between" }}>
        <span>{t.myFriends || t.friendsList}</span>
        {friends.length > 0 && (
          <span style={{ color: "#666663" }}>({friends.length})</span>
        )}
      </div>
      {!friends.length && (
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noFriendsYet}</p>
      )}
      {friends.map((f) => (
        <FriendListRow
          key={f.id}
          friendship={f}
          stats={friendStats[f.otherUserId]}
          onCompareWith={onCompareWith}
        />
      ))}

      {topPicks.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={SECTION_LABEL_STYLE}>{t.friendsTopPicks}</div>
          {topPicks.map((p) => (
            <TopPickRow key={p.placeId} pick={p} />
          ))}
        </div>
      )}
    </div>
  );
}
