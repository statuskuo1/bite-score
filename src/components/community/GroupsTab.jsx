import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  createGroup,
  deleteGroup,
  getGroupWithMembers,
  inviteMember,
  leaveGroup,
  listMyGroups,
  removeMember,
  SOFT_CAP,
} from "../../utils/groupsApi.js";
import { listFriendships } from "../../utils/friendsApi.js";
import {
  fetchAggregatedRestaurantPlaces,
  fetchRestaurantVisitsForUser,
} from "../../utils/visitPlacesApi.js";
import { rankGroupCuisines, getRestaurantCuisines } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Pill } from "./Pill.jsx";
import { UserIdentity } from "./UserIdentity.jsx";

/** Detail view for one group: members, invite picker, ranked cuisines + suggested places. */
function GroupDetail({ user, groupId, onBack, onDeleted }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [friends, setFriends] = useState([]);
  const [memberVisits, setMemberVisits] = useState({}); // { userId: visits[] }
  const [places, setPlaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const reload = useCallback(async () => {
    if (!groupId) return;
    const d = await getGroupWithMembers(supabase, groupId);
    setData(d);
  }, [groupId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { friends: f } = await listFriendships(supabase, user.id);
      if (!cancelled) setFriends(f);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /** Fetch visits for every member in parallel — needed for floor-score ranking. */
  useEffect(() => {
    if (!data?.members?.length) { setMemberVisits({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        data.members.map(async (m) => [m.user_id, await fetchRestaurantVisitsForUser(supabase, m.user_id)])
      );
      if (!cancelled) setMemberVisits(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [data?.members?.map((m) => m.user_id).join(",")]);  // eslint-disable-line react-hooks/exhaustive-deps

  /** Aggregated restaurant places — used to suggest spots fewer than half the group has visited. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await fetchAggregatedRestaurantPlaces(supabase, { minVisits: 1, topReviewersLimit: 3 });
      if (!cancelled) setPlaces(p);
    })();
    return () => { cancelled = true; };
  }, []);

  const isOwner = data?.group?.owner_id === user?.id;
  const memberIds = useMemo(() => new Set((data?.members || []).map((m) => m.user_id)), [data?.members]);

  const friendsInvitable = useMemo(
    () => friends.filter((f) => !memberIds.has(f.otherUserId)),
    [friends, memberIds]
  );

  const ranked = useMemo(() => {
    if (!data?.members?.length) return [];
    const memberVisitsByUser = data.members.map((m) => ({
      userId: m.user_id,
      visits: memberVisits[m.user_id] || [],
    }));
    /** Relax to N-1 coverage when group has 4+ members so one outlier doesn't hide everything. */
    const minCov = data.members.length >= 4 ? data.members.length - 1 : "all";
    return rankGroupCuisines(memberVisitsByUser, getRestaurantCuisines, { minCoverage: minCov });
  }, [data?.members, memberVisits]);

  const memberHalf = data?.members?.length ? Math.ceil(data.members.length / 2) : 0;

  /** For each top cuisine, surface places where < half the group has visited.
   *  We use the per-member visits we already loaded to count visited members. */
  const suggestionsByCuisine = useMemo(() => {
    if (!data?.members?.length || !ranked.length) return [];
    const visitedMembersByPlace = new Map();
    for (const m of data.members) {
      const seen = new Set((memberVisits[m.user_id] || []).map((v) => v.placeId).filter(Boolean));
      for (const placeId of seen) {
        const set = visitedMembersByPlace.get(placeId) || new Set();
        set.add(m.user_id);
        visitedMembersByPlace.set(placeId, set);
      }
    }
    const out = [];
    for (const cuisine of ranked.slice(0, 3)) {
      const matches = places
        .filter((p) => (p.cuisine || "").toLowerCase() === cuisine.cuisine.toLowerCase()
          || (p.isFusion && (p.cuisine2 || "").toLowerCase() === cuisine.cuisine.toLowerCase()))
        .map((p) => ({
          ...p,
          visitedMemberCount: (visitedMembersByPlace.get(p.placeId) || new Set()).size,
        }))
        .filter((p) => p.visitedMemberCount < memberHalf)
        .sort((a, b) => b.avgTaste - a.avgTaste)
        .slice(0, 3);
      out.push({ cuisine, places: matches });
    }
    return out;
  }, [ranked, places, memberVisits, data?.members, memberHalf]);

  async function handleInvite(userId) {
    setBusy(true);
    try {
      await inviteMember(supabase, groupId, userId);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId) {
    setBusy(true);
    try {
      await removeMember(supabase, groupId, userId);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      await leaveGroup(supabase, groupId, user.id);
      onBack();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteGroup(supabase, groupId);
      onDeleted?.();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div>
        <button type="button" onClick={onBack} style={{ fontSize: 12, color: "#888780", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 }}>
          {t.backToList}
        </button>
        <p style={{ fontSize: 12, color: "#888780" }}>…</p>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onBack} style={{ fontSize: 12, color: "#888780", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 }}>
        {t.backToList}
      </button>

      <div style={{
        background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 12, padding: "12px 14px", marginBottom: 12,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8" }}>{data.group.name}</div>
          {isOwner && (
            <Pill onClick={handleDelete} tone="danger" disabled={busy}>{t.deleteGroup}</Pill>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {t.members} ({data.members.length}/{SOFT_CAP})
          </span>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowInvite((v) => !v)}
              style={{
                fontSize: 11, color: "#F0997B", background: "#3C1F13",
                border: "1px solid rgba(240,153,123,0.4)", padding: "3px 10px",
                borderRadius: 12, cursor: "pointer",
              }}
            >+ {t.inviteFriend}</button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.members.map((m) => {
            const isMe = m.user_id === user.id;
            const isOwnerMember = m.user_id === data.group.owner_id;
            const suffix = isMe
              ? <span style={{ color: "#888780", marginLeft: 6 }}>· {t.youLabel}</span>
              : (isOwnerMember
                  ? <span style={{ color: "#888780", marginLeft: 6 }}>· {t.ownerLabel}</span>
                  : null);
            return (
              <div key={m.user_id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 0",
              }}>
                <UserIdentity profile={m.profile} size={26} nameSuffix={suffix} />
                {isMe && !isOwnerMember && (
                  <Pill onClick={handleLeave} tone="danger" disabled={busy}>{t.leaveGroup}</Pill>
                )}
                {isOwner && !isMe && (
                  <Pill onClick={() => handleRemove(m.user_id)} tone="muted" disabled={busy}>{t.removeMember}</Pill>
                )}
              </div>
            );
          })}
        </div>

        {showInvite && isOwner && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
            {!friends.length && (
              <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.groupNeedsFriends}</p>
            )}
            {friends.length > 0 && !friendsInvitable.length && (
              <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noFriendsYet}</p>
            )}
            {friendsInvitable.map((f) => (
              <div key={f.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
              }}>
                <UserIdentity profile={f.otherProfile} size={24} />
                <Pill
                  onClick={() => handleInvite(f.otherUserId)}
                  tone="primary"
                  disabled={busy || data.members.length >= SOFT_CAP}
                >{t.addFriend}</Pill>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {t.groupTopCuisines}
      </div>
      {!ranked.length && (
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.notEnoughGroupData}</p>
      )}
      {ranked.slice(0, 5).map((r) => {
        const flag = FLAGS[r.cuisine] || (r.cuisine?.[0] || "?").toUpperCase();
        return (
          <div key={r.cuisine} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{flag}</span>
            <span style={{ flex: 1, fontSize: 13, color: "#F1EFE8" }}>{r.cuisine}</span>
            <span style={{ fontSize: 10, color: "#888780" }}>{t.floorScore}</span>
            <span style={{ fontSize: 14, color: tasteColor(r.floor), fontWeight: 600, minWidth: 36, textAlign: "right" }}>
              {r.floor.toFixed(1)}
            </span>
          </div>
        );
      })}

      {suggestionsByCuisine.some((s) => s.places.length > 0) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {t.suggestedSpots}
          </div>
          {suggestionsByCuisine.map(({ cuisine, places: ps }) => {
            if (!ps.length) return null;
            return (
              <div key={cuisine.cuisine} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>
                  {(FLAGS[cuisine.cuisine] || "")} {cuisine.cuisine}
                </div>
                {ps.map((p) => (
                  <div key={p.placeId} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", marginBottom: 6,
                    background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#888780" }}>
                        {p.city || "—"} · {p.visitCount} {t.visitsCount}
                        {p.visitedMemberCount > 0 && (
                          <span> · {p.visitedMemberCount}/{data.members.length} {t.members.toLowerCase()}</span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: tasteColor(p.avgTaste), fontWeight: 600 }}>
                      {p.avgTaste.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GroupsTab({ user }) {
  const { t } = useLang();
  const [groups, setGroups] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const list = await listMyGroups(supabase, user.id);
    setGroups(list);
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);

  async function submitCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await createGroup(supabase, user.id, name);
      if (res.ok) {
        setNewName("");
        setCreating(false);
        await reload();
        if (res.data?.id) setOpenId(res.data.id);
      }
    } finally {
      setBusy(false);
    }
  }

  if (openId) {
    return (
      <GroupDetail
        user={user}
        groupId={openId}
        onBack={() => { setOpenId(null); reload(); }}
        onDeleted={() => { setOpenId(null); reload(); }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t.groupsSub}
        </span>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          style={{
            fontSize: 12, color: "#F0997B", background: "#3C1F13",
            border: "1px solid rgba(240,153,123,0.4)", padding: "5px 12px",
            borderRadius: 14, cursor: "pointer",
          }}
        >+ {t.createGroup}</button>
      </div>

      {creating && (
        <div style={{
          background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
          borderRadius: 12, padding: "12px 14px", marginBottom: 12,
        }}>
          <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>
            {t.groupName}
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.groupNamePlaceholder}
            maxLength={80}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 13, marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setCreating(false)} style={{
              fontSize: 12, color: "#888780", background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)", padding: "5px 12px",
              borderRadius: 14, cursor: "pointer",
            }}>{t.cancel}</button>
            <button type="button" onClick={submitCreate} disabled={busy || !newName.trim()} style={{
              fontSize: 12, color: "#141413", background: "#F0997B",
              border: "none", padding: "5px 12px", borderRadius: 14,
              cursor: busy || !newName.trim() ? "not-allowed" : "pointer",
              opacity: busy || !newName.trim() ? 0.5 : 1,
            }}>{t.save}</button>
          </div>
        </div>
      )}

      {!groups.length && !creating && (
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noGroupsYet}</p>
      )}

      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => setOpenId(g.id)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", marginBottom: 8, width: "100%",
            background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: 12, cursor: "pointer", textAlign: "left",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {g.name || "—"}
            </div>
            {g.owner_id === user?.id && (
              <div style={{ fontSize: 10, color: "#888780" }}>· {t.ownerLabel}</div>
            )}
          </div>
          <span style={{ fontSize: 18, color: "#888780" }}>›</span>
        </button>
      ))}
    </div>
  );
}
