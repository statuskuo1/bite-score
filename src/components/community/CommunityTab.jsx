import { useState, useEffect } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { GlobalTab } from "./GlobalTab.jsx";
import { FriendsTab } from "./FriendsTab.jsx";
import { CompareTab } from "./CompareTab.jsx";
import { GroupsTab } from "./GroupsTab.jsx";
import { UserLogView } from "./UserLogView.jsx";

const SUBS = [
  { key: "global", labelKey: "globalSub", hintKey: "communityHintGlobal", icon: "🌐" },
  { key: "friends", labelKey: "friendsSub", hintKey: "communityHintFriends", icon: "👥" },
  { key: "compare", labelKey: "compareSub", hintKey: "communityHintCompare", icon: "🪞" },
  { key: "groups", labelKey: "groupsSub", hintKey: "communityHintGroups", icon: "🎉" },
];

function GuestPreview({ message, onSignIn, children }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
        <p style={{ fontSize:13, color:"#C4C2BA", margin:0, lineHeight:1.5 }}>{message}</p>
        <button type="button" onClick={onSignIn} style={{ padding:"8px 20px", borderRadius:8, border:"none", background:"#F0997B", color:"#141413", fontSize:13, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
          Sign In
        </button>
      </div>
      <div style={{ opacity:0.3, pointerEvents:"none", userSelect:"none" }}>
        {children}
      </div>
    </div>
  );
}

function FriendsMockup() {
  const FRIENDS = [
    { init:"A", color:"#5B9BD5", name:"Alex Chen",    handle:"alexc",    badge:"Taste Buds", compat:91 },
    { init:"J", color:"#97C459", name:"Jordan Kim",   handle:"jordank",  badge:"Following",  compat:78 },
    { init:"M", color:"#EF9F27", name:"Maya Patel",   handle:"mayap",    badge:"Taste Buds", compat:65 },
  ];
  const rowStyle = { display:"flex", alignItems:"center", gap:10, padding:"8px 10px", marginBottom:6, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:10 };
  const sectionLabel = { fontSize:11, color:"#F0997B", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600, marginBottom:6 };
  return (
    <div>
      <input readOnly placeholder="Search by @username" style={{ width:"100%", boxSizing:"border-box", marginBottom:16 }} />
      <div style={sectionLabel}>Following · 3</div>
      {FRIENDS.map(f => (
        <div key={f.handle} style={rowStyle}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:f.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#141413", flexShrink:0 }}>{f.init}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:"#F1EFE8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
            <div style={{ fontSize:11, color:"#888780" }}>@{f.handle}</div>
          </div>
          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#3C1F13", color:"#F0997B", border:"0.5px solid rgba(240,153,123,0.3)" }}>{f.badge}</span>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"rgba(91,155,213,0.12)", color:"#5B9BD5", border:"0.5px solid rgba(91,155,213,0.25)" }}>{f.compat}% match</span>
          </div>
        </div>
      ))}
      <div style={{ ...sectionLabel, marginTop:20 }}>Followers · 5</div>
      {[
        { init:"S", color:"#888780", name:"Sam Rivera",   handle:"samr" },
        { init:"K", color:"#888780", name:"Kai Tanaka",   handle:"kait" },
      ].map(f => (
        <div key={f.handle} style={rowStyle}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:f.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#141413", flexShrink:0 }}>{f.init}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:"#F1EFE8" }}>{f.name}</div>
            <div style={{ fontSize:11, color:"#888780" }}>@{f.handle}</div>
          </div>
          <span style={{ fontSize:12, padding:"5px 12px", borderRadius:8, background:"#252523", color:"#888780", border:"0.5px solid rgba(255,255,255,0.1)" }}>Follow back</span>
        </div>
      ))}
    </div>
  );
}

function CompareMockup() {
  const sectionLabel = { fontSize:11, color:"#F0997B", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600, marginBottom:8 };
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"#1E1E1C", borderRadius:10, marginBottom:16, border:"0.5px solid rgba(255,255,255,0.08)" }}>
        <div style={{ width:28, height:28, borderRadius:"50%", background:"#5B9BD5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#141413" }}>A</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, color:"#F1EFE8" }}>Alex Chen</div>
          <div style={{ fontSize:11, color:"#888780" }}>@alexc · Taste Buds</div>
        </div>
        <span style={{ fontSize:13, color:"#888780" }}>▼</span>
      </div>
      <div style={{ background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"20px 16px", textAlign:"center", marginBottom:16 }}>
        <div style={{ fontSize:42, fontWeight:700, color:"#97C459", marginBottom:4 }}>87%</div>
        <div style={{ fontSize:13, color:"#C4C2BA", marginBottom:12 }}>Strong alignment — you both love bold, high-value spots</div>
        <div style={{ display:"flex", justifyContent:"center", gap:6, flexWrap:"wrap" }}>
          {["🇮🇹 Italian", "🇯🇵 Japanese"].map(c => (
            <span key={c} style={{ fontSize:12, padding:"4px 10px", borderRadius:16, background:"#252523", color:"#C4C2BA" }}>{c}</span>
          ))}
        </div>
      </div>
      <div style={sectionLabel}>Both Been</div>
      {[
        { flag:"🇮🇹", name:"Lilia",  mine:9.2, theirs:8.9 },
        { flag:"🇯🇵", name:"Raku",   mine:8.7, theirs:9.1 },
        { flag:"🍕",   name:"Lucali", mine:9.5, theirs:9.3 },
      ].map(r => (
        <div key={r.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", marginBottom:6, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:10 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:"#252523", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{r.flag}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, color:"#F1EFE8", fontWeight:500 }}>{r.name}</div>
            <div style={{ fontSize:11, color:"#888780" }}>You {r.mine} · Alex {r.theirs}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GlobalMockup() {
  const ROWS = [
    { flag:"🇮🇹", name:"Lilia",             cuisine:"Italian",        city:"NYC", bite:"9.14", label:"Exceptional",  color:"#97C459" },
    { flag:"🍕",   name:"Lucali",            cuisine:"Italian",        city:"NYC", bite:"8.82", label:"Exceptional",  color:"#97C459" },
    { flag:"🇯🇵", name:"Raku",              cuisine:"Japanese",       city:"NYC", bite:"8.47", label:"Worth It",     color:"#5B9BD5" },
    { flag:"🇮🇹", name:"Don Angie",         cuisine:"Italian",        city:"NYC", bite:"8.31", label:"Worth It",     color:"#5B9BD5" },
    { flag:"🇺🇸", name:"Ugly Bagel",        cuisine:"American",       city:"NYC", bite:"7.95", label:"Solid Pick",   color:"#EF9F27" },
    { flag:"🇺🇸", name:"Superiority Burger",cuisine:"American",       city:"NYC", bite:"7.62", label:"Solid Pick",   color:"#EF9F27" },
    { flag:"🇨🇳", name:"Xi'an Famous",      cuisine:"Chinese",        city:"NYC", bite:"7.28", label:"Decent",       color:"#888780" },
  ];
  return (
    <div>
      <div style={{ display:"flex", background:"#252523", borderRadius:10, padding:3, gap:2, marginBottom:12 }}>
        {[["restaurants","🍽 Restaurants"],["drinks","☕ Drinks"],["sweets","🥐 Sweets"]].map(([v,l])=>(
          <button key={v} style={{ flex:1, padding:"6px 0", textAlign:"center", borderRadius:8, border:"none", background:v==="restaurants"?"#3C1F13":"transparent", color:v==="restaurants"?"#F0997B":"#888780", fontSize:11, fontWeight:v==="restaurants"?700:500, cursor:"pointer" }}>{l}</button>
        ))}
      </div>
      {ROWS.map(r => (
        <div key={r.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", marginBottom:6, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:10 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:"#252523", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{r.flag}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:"#F1EFE8", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
            <div style={{ fontSize:11, color:"#888780" }}>{r.cuisine} · {r.city}</div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:r.color }}>{r.bite}</div>
            <div style={{ fontSize:10, color:r.color, opacity:0.8 }}>{r.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupsMockup() {
  const GROUPS = [
    { name:"NYC Food Crew", count:4, colors:["#5B9BD5","#97C459","#EF9F27","#F0997B"] },
    { name:"Ramen Heads",   count:2, colors:["#5B9BD5","#EF9F27"] },
  ];
  return (
    <div>
      <button style={{ width:"100%", padding:"10px", background:"transparent", color:"#F0997B", border:"1px dashed rgba(240,153,123,0.4)", borderRadius:10, fontSize:14, marginBottom:16, cursor:"pointer" }}>
        + Create Group
      </button>
      {GROUPS.map(g => (
        <div key={g.name} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", marginBottom:8, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:12, cursor:"pointer" }}>
          <div style={{ display:"flex" }}>
            {g.colors.map((c, i) => (
              <div key={i} style={{ width:28, height:28, borderRadius:"50%", background:c, border:"2px solid #1E1E1C", marginLeft:i>0?-8:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#141413" }}>
                {String.fromCharCode(65+i)}
              </div>
            ))}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, color:"#F1EFE8", fontWeight:500 }}>{g.name}</div>
            <div style={{ fontSize:11, color:"#888780" }}>{g.count} members</div>
          </div>
          <span style={{ fontSize:16, color:"#888780" }}>›</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Community sub-tab router.
 *
 * `compareTarget` lets one tab hand off a friend to Compare (e.g. "Compare with"
 * button on a friend card jumps into Compare with that friend pre-selected).
 *
 * `restaurantWeights` / `drinkWeights` / `sweetWeights` flow through to
 * GlobalTab so its mean-then-BITE leaderboard reflects the viewer's own My
 * Taste sliders. The other sub-tabs don't read weights today.
 */
export function CommunityTab({ user, restaurantWeights, drinkWeights, sweetWeights, unseenFollowers = 0, onMarkFollowersSeen, onFollowChange, externalUserLogTarget, onExternalUserLogConsumed, externalCompareTarget, onExternalCompareConsumed, onSignIn }) {
  const { t } = useLang();
  const [active, setActive] = useState("global");
  const [compareTarget, setCompareTarget] = useState(null);
  /** When set, the read-only `UserLogView` takes over the Community surface
   *  until the user taps Back. The sub-tab strip and `active` selection are
   *  preserved underneath so we land back on Friends on dismissal. */
  const [userLogTarget, setUserLogTarget] = useState(null);

  useEffect(() => {
    if (externalUserLogTarget) {
      setUserLogTarget(externalUserLogTarget);
      onExternalUserLogConsumed?.();
    }
  }, [externalUserLogTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (externalCompareTarget) {
      setCompareTarget(externalCompareTarget);
      setActive("compare");
      onExternalCompareConsumed?.();
    }
  }, [externalCompareTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  function jumpToCompare(friendProfile) {
    setCompareTarget(friendProfile);
    setActive("compare");
  }

  const hint = t[SUBS.find((s) => s.key === active)?.hintKey] || "";

  if (userLogTarget) {
    return (
      <UserLogView
        user={user}
        targetProfile={userLogTarget}
        restaurantWeights={restaurantWeights}
        onBack={() => setUserLogTarget(null)}
      />
    );
  }

  return (
    <div>
      <div style={{
        display: "flex", background: "#252523", borderRadius: 10, padding: 3,
        gap: 2, marginBottom: 12,
      }}>
        {SUBS.map((s) => {
          const on = active === s.key;
          const badge = s.key === "friends" && unseenFollowers > 0 ? unseenFollowers : 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              style={{
                flex: 1, padding: "6px 0", textAlign: "center", borderRadius: 8,
                border: "none",
                background: on ? "#3C1F13" : "transparent",
                color: on ? "#F0997B" : "#888780",
                fontSize: 11, fontWeight: on ? 700 : 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {s.icon} {t[s.labelKey] || s.key}
                {badge > 0 && (
                  <span style={{
                    minWidth: 16, height: 16, padding: "0 4px",
                    borderRadius: 8, background: "#E85A5A",
                    color: "#FFF", fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1, boxSizing: "border-box",
                  }}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "#888780", margin: "0 0 12px" }}>{hint}</p>

      {active === "global" && !user && (
        <GuestPreview message="Sign in to see the live community leaderboard" onSignIn={onSignIn}>
          <GlobalMockup />
        </GuestPreview>
      )}
      {active === "global" && user && (
        <GlobalTab
          user={user}
          restaurantWeights={restaurantWeights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
        />
      )}

      {active === "friends" && !user && (
        <GuestPreview message="Sign in to follow friends and see who's eating where" onSignIn={onSignIn}>
          <FriendsMockup />
        </GuestPreview>
      )}
      {active === "friends" && user && (
        <FriendsTab
          user={user}
          onCompareWith={jumpToCompare}
          onMarkFollowersSeen={onMarkFollowersSeen}
          onFollowChange={onFollowChange}
          onViewLog={setUserLogTarget}
        />
      )}

      {active === "compare" && !user && (
        <GuestPreview message="Sign in to compare your taste with friends" onSignIn={onSignIn}>
          <CompareMockup />
        </GuestPreview>
      )}
      {active === "compare" && user && (
        <CompareTab user={user} initialTarget={compareTarget} onClearTarget={() => setCompareTarget(null)} onFollowChange={onFollowChange} />
      )}

      {active === "groups" && !user && (
        <GuestPreview message="Sign in to create and join food groups" onSignIn={onSignIn}>
          <GroupsMockup />
        </GuestPreview>
      )}
      {active === "groups" && user && <GroupsTab user={user} />}
    </div>
  );
}
