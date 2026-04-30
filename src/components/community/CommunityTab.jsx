import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLang } from "../../contexts/LangContext.jsx";
import { FeedTab } from "./FeedTab.jsx";
import { PeopleTab } from "./PeopleTab.jsx";
import { ExploreTab } from "./ExploreTab.jsx";
import { CompareTab } from "./CompareTab.jsx";
import { UserLogView } from "./UserLogView.jsx";

/** Top-strip sub-tabs (Compare lives at /community/compare but is intentionally
 *  not in the strip — it's reached by tapping a user → MiniProfileSheet → Compare). */
const SUBS = [
  { key: "feed", labelKey: "feedSub", hintKey: "communityHintFeed", icon: "📣" },
  { key: "people", labelKey: "peopleSub", hintKey: "communityHintPeople", icon: "👥" },
  { key: "explore", labelKey: "exploreSub", hintKey: "communityHintExplore", icon: "🔍" },
];

const DEFAULT_TAB = "feed";

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

function PeopleMockup() {
  const FRIENDS = [
    { init:"A", color:"#5B9BD5", name:"Alex Chen",    handle:"alexc",    badge:"Taste Buds", compat:91 },
    { init:"J", color:"#97C459", name:"Jordan Kim",   handle:"jordank",  badge:"Following",  compat:78 },
    { init:"M", color:"#EF9F27", name:"Maya Patel",   handle:"mayap",    badge:"Taste Buds", compat:65 },
  ];
  const rowStyle = { display:"flex", alignItems:"center", gap:10, padding:"8px 10px", marginBottom:6, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:10 };
  const sectionLabel = { fontSize:11, color:"#F0997B", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600, marginBottom:6 };
  return (
    <div>
      <div style={sectionLabel}>Taste Buds · 3</div>
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
    </div>
  );
}

function ExploreMockup() {
  const ROWS = [
    { flag:"🇮🇹", name:"Lilia",             cuisine:"Italian",        city:"NYC", bite:"9.14", label:"Exceptional",  color:"#97C459" },
    { flag:"🍕",   name:"Lucali",            cuisine:"Italian",        city:"NYC", bite:"8.82", label:"Exceptional",  color:"#97C459" },
    { flag:"🇯🇵", name:"Raku",              cuisine:"Japanese",       city:"NYC", bite:"8.47", label:"Worth It",     color:"#5B9BD5" },
    { flag:"🇮🇹", name:"Don Angie",         cuisine:"Italian",        city:"NYC", bite:"8.31", label:"Worth It",     color:"#5B9BD5" },
    { flag:"🇺🇸", name:"Ugly Bagel",        cuisine:"American",       city:"NYC", bite:"7.95", label:"Solid Pick",   color:"#EF9F27" },
  ];
  return (
    <div>
      <div style={{ display:"flex", background:"#252523", borderRadius:10, padding:3, gap:2, marginBottom:12 }}>
        {[["top-picks","⭐ Top Picks"],["global","🌐 Global"]].map(([v,l])=>(
          <button key={v} style={{ flex:1, padding:"6px 0", textAlign:"center", borderRadius:8, border:"none", background:v==="top-picks"?"#3C1F13":"transparent", color:v==="top-picks"?"#F0997B":"#888780", fontSize:11, fontWeight:v==="top-picks"?700:500, cursor:"pointer" }}>{l}</button>
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

function FeedMockup() {
  return (
    <div style={{ padding:"32px 16px", textAlign:"center", background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:12 }}>
      <div style={{ fontSize:32, marginBottom:12 }}>📣</div>
      <div style={{ fontSize:15, fontWeight:600, color:"#F1EFE8", marginBottom:6 }}>Sign in to see your Taste Buds' feed</div>
      <p style={{ fontSize:12, color:"#888780", margin:0, lineHeight:1.5 }}>Latest bites from people you mutual-follow.</p>
    </div>
  );
}

/**
 * Community sub-tab router.
 *
 * Three sub-tabs in the top strip — Feed (default), People, Explore.
 * Compare is intentionally NOT in the strip; it lives at /community/compare
 * and is reached by tapping any user → MiniProfileSheet → Compare button,
 * which calls `jumpToCompare` (sets compareTarget + navigates).
 *
 * `compareTarget` lets one tab hand off a friend to Compare. `userLogTarget`
 * (set externally by notifications, or internally by MiniProfileSheet's
 * View Log button) makes UserLogView take over the entire Community surface
 * until Back; the active sub-tab strip is preserved underneath.
 *
 * `restaurantWeights` / `drinkWeights` / `sweetWeights` flow through to
 * Explore > Global so its mean-then-BITE leaderboard reflects the viewer's
 * own My Taste sliders.
 */
export function CommunityTab({ user, restaurantWeights, drinkWeights, sweetWeights, unseenFollowers = 0, onMarkFollowersSeen, onFollowChange, externalUserLogTarget, onExternalUserLogConsumed, externalCompareTarget, onExternalCompareConsumed, onSignIn }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const topSeg = pathname.split("/")[2] || DEFAULT_TAB;
  // Compare renders at /community/compare but isn't in the strip; resolve
  // strip highlight to the default tab so nothing lights up while comparing.
  const active = SUBS.find((s) => s.key === topSeg) ? topSeg : (topSeg === "compare" ? null : DEFAULT_TAB);
  const [compareTarget, setCompareTarget] = useState(null);
  /** When set, the read-only `UserLogView` takes over the Community surface
   *  until the user taps Back. The sub-tab strip and `active` selection are
   *  preserved underneath so we land back on the same tab on dismissal. */
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
      onExternalCompareConsumed?.();
    }
  }, [externalCompareTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  function jumpToCompare(friendProfile) {
    setCompareTarget(friendProfile);
    navigate("/community/compare");
  }

  const hint = active ? (t[SUBS.find((s) => s.key === active)?.hintKey] || "") : "";

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

  // /community/compare renders CompareTab full-width without the sub-tab
  // strip — it's a focused 1:1 view, reached only via MiniProfileSheet.
  if (topSeg === "compare") {
    if (!user) {
      return (
        <GuestPreview message="Sign in to compare your taste with friends" onSignIn={onSignIn}>
          <PeopleMockup />
        </GuestPreview>
      );
    }
    return (
      <CompareTab
        user={user}
        initialTarget={compareTarget}
        onClearTarget={() => setCompareTarget(null)}
        onFollowChange={onFollowChange}
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
          // Unseen-followers badge surfaces on People (where the New
          // Followers banner lives, under People > Discover).
          const badge = s.key === "people" && unseenFollowers > 0 ? unseenFollowers : 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => navigate("/community/" + s.key)}
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

      {active === "feed" && !user && (
        <GuestPreview message="Sign in to see your Taste Buds' feed" onSignIn={onSignIn}>
          <FeedMockup />
        </GuestPreview>
      )}
      {active === "feed" && user && <FeedTab />}

      {active === "people" && !user && (
        <GuestPreview message="Sign in to follow friends and see who's eating where" onSignIn={onSignIn}>
          <PeopleMockup />
        </GuestPreview>
      )}
      {active === "people" && user && (
        <PeopleTab
          user={user}
          onCompareWith={jumpToCompare}
          onMarkFollowersSeen={onMarkFollowersSeen}
          onFollowChange={onFollowChange}
          onViewLog={setUserLogTarget}
        />
      )}

      {active === "explore" && !user && (
        <GuestPreview message="Sign in to see top picks and the live community leaderboard" onSignIn={onSignIn}>
          <ExploreMockup />
        </GuestPreview>
      )}
      {active === "explore" && user && (
        <ExploreTab
          user={user}
          restaurantWeights={restaurantWeights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
        />
      )}
    </div>
  );
}
