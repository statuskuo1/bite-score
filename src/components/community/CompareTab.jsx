import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { listFriendships } from "../../utils/friendsApi.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import { pairCompatibility } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { UserIdentity } from "./UserIdentity.jsx";

function CuisineRow({ cuisine, mine, theirs, delta }) {
  const myCol = tasteColor(mine);
  const theirCol = tasteColor(theirs);
  const flag = FLAGS[cuisine] || (cuisine?.[0] || "?").toUpperCase();
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr auto auto auto",
      alignItems: "center", gap: 10,
      padding: "8px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{flag}</span>
      <span style={{ fontSize: 13, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {cuisine}
      </span>
      <span style={{ fontSize: 13, color: myCol, fontWeight: 500, textAlign: "right", minWidth: 32 }}>
        {mine.toFixed(1)}
      </span>
      <span style={{ fontSize: 13, color: theirCol, fontWeight: 500, textAlign: "right", minWidth: 32 }}>
        {theirs.toFixed(1)}
      </span>
      <span style={{ fontSize: 11, color: "#888780", textAlign: "right", minWidth: 36 }}>
        Δ{delta.toFixed(1)}
      </span>
    </div>
  );
}

export function CompareTab({ user, initialTarget, onClearTarget }) {
  const { t } = useLang();
  const [friends, setFriends] = useState([]);
  const [target, setTarget] = useState(initialTarget || null);
  const [myVisits, setMyVisits] = useState([]);
  const [theirVisits, setTheirVisits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { friends: f } = await listFriendships(supabase, user.id);
      if (!cancelled) setFriends(f);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, user.id);
      if (!cancelled) setMyVisits(v);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!target?.id) { setTheirVisits([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, target.id);
      if (!cancelled) {
        setTheirVisits(v);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [target?.id]);

  /** When user switches sub-tab in via initialTarget, sync local state once. */
  useEffect(() => {
    if (initialTarget && initialTarget.id !== target?.id) {
      setTarget(initialTarget);
    }
  }, [initialTarget?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const compat = useMemo(() => {
    if (!target?.id) return null;
    return pairCompatibility(myVisits, theirVisits);
  }, [myVisits, theirVisits, target?.id]);

  function clearTarget() {
    setTarget(null);
    onClearTarget?.();
  }

  if (!target) {
    return (
      <div>
        <p style={{ fontSize: 12, color: "#888780", margin: "0 0 12px" }}>{t.pickFriendToCompare}</p>
        {!friends.length && (
          <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noFriendsYet}</p>
        )}
        {friends.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTarget(f.otherProfile)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", marginBottom: 8, width: "100%",
              background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: 12, cursor: "pointer", textAlign: "left",
            }}
          >
            <UserIdentity profile={f.otherProfile} size={32} />
            <span style={{ fontSize: 18, color: "#888780" }}>›</span>
          </button>
        ))}
      </div>
    );
  }

  const compatColor = compat?.score != null ? tasteColor((compat.score / 10)) : "#888780";
  const insufficientMine = (myVisits || []).length === 0;

  return (
    <div>
      <button
        type="button"
        onClick={clearTarget}
        style={{
          fontSize: 12, color: "#888780", background: "none", border: "none",
          cursor: "pointer", padding: 0, marginBottom: 12,
        }}
      >{t.backToList}</button>

      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 12, padding: "12px 14px", marginBottom: 12,
      }}>
        <UserIdentity profile={target} size={40} variant="header" />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {t.compatibility}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: compatColor, lineHeight: 1.1 }}>
            {loading ? "…" : compat?.score != null ? `${compat.score}%` : "—"}
          </div>
        </div>
      </div>

      {loading && (
        <p style={{ fontSize: 12, color: "#888780" }}>…</p>
      )}

      {!loading && insufficientMine && (
        <p style={{ fontSize: 12, color: "#888780" }}>{t.insufficientVisits}</p>
      )}

      {!loading && !insufficientMine && compat?.notEnoughData && (
        <p style={{ fontSize: 12, color: "#888780" }}>{t.notEnoughSharedData}</p>
      )}

      {!loading && compat?.agreements?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {t.youAgreeOn}
            </span>
            <span style={{ fontSize: 11, color: "#888780" }}>
              {compat.sharedCuisines} {t.sharedCuisines.toLowerCase()}
            </span>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "auto 1fr auto auto auto",
            gap: 10, padding: "0 0 4px",
            fontSize: 10, color: "#666663",
          }}>
            <span></span>
            <span></span>
            <span style={{ textAlign: "right" }}>{t.youLabel}</span>
            <span style={{ textAlign: "right" }}>@{target.username?.slice(0, 8) || "them"}</span>
            <span style={{ textAlign: "right" }}>Δ</span>
          </div>
          {compat.agreements.map((a) => (
            <CuisineRow key={a.cuisine} cuisine={a.cuisine} mine={a.mine} theirs={a.theirs} delta={a.delta} />
          ))}
        </div>
      )}

      {!loading && compat?.onlyTheirs?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {t.youShouldTry}
          </div>
          {compat.onlyTheirs.slice(0, 6).map((c) => (
            <div key={c.cuisine} style={{
              display: "flex", justifyContent: "space-between",
              padding: "5px 0", fontSize: 12,
              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{ color: "#F1EFE8" }}>
                {(FLAGS[c.cuisine] || "")} {c.cuisine}
              </span>
              <span style={{ color: tasteColor(c.avg), fontWeight: 500 }}>{c.avg.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && compat?.onlyMine?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {t.theyShouldTry}
          </div>
          {compat.onlyMine.slice(0, 6).map((c) => (
            <div key={c.cuisine} style={{
              display: "flex", justifyContent: "space-between",
              padding: "5px 0", fontSize: 12,
              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{ color: "#F1EFE8" }}>
                {(FLAGS[c.cuisine] || "")} {c.cuisine}
              </span>
              <span style={{ color: tasteColor(c.avg), fontWeight: 500 }}>{c.avg.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
