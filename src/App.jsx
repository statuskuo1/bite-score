import { useState, useReducer, useRef, useEffect, useCallback } from "react";
import { LangContext } from "./contexts/LangContext.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import { T } from "./translations.js";
import { supabase } from "./config/supabaseClient.js";
import { canMutateVisit } from "./utils/rowAccess.js";
import {
  fetchRestaurantVisitsJoined,
  fetchCafeVisitsJoined,
  fetchAllRestaurantPlaces,
  fetchAllCafePlaces,
  ensureRestaurantPlace,
  ensureCafePlace,
  restaurantVisitInsertPayload,
  restaurantVisitUpdatePayload,
  cafeVisitInsertPayload,
  cafeVisitUpdatePayload,
  mapRestaurantVisitRow,
  mapCafeVisitRow,
  RESTAURANT_VISIT_SELECT,
  CAFE_VISIT_SELECT,
} from "./utils/visitPlacesApi.js";
import { INIT_REST, INIT_CAFE } from "./data/initialData.js";
import { reducer } from "./state/logReducer.js";
import {
  calcBiteOutOf10,
  meanRestaurantBiteOutOf10,
  calcCafeOutOf10,
  scoreColor,
  scoreLabel,
  tasteColor,
  tasteLabel,
} from "./utils/scoring.js";
import { rating010FilterRows } from "./constants/ratingTiers0to10.js";
import { BEAN_REGIONS, regionOf } from "./constants/coffeeConstants.js";
import { S } from "./styles/sharedStyles.js";
import { MouthLogo } from "./components/MouthLogo.jsx";
import { InfoBubble } from "./components/InfoBubble.jsx";
import { RestRow } from "./components/RestRow.jsx";
import { RestForm } from "./components/RestForm.jsx";
import { CafeForm } from "./components/CafeForm.jsx";
import { CafeGroupRow } from "./components/CafeGroupRow.jsx";
import { SuggestView } from "./components/SuggestView.jsx";
import { PaletteView } from "./components/PaletteView.jsx";
import { FaqView } from "./components/FaqView.jsx";
import { AuthModal } from "./components/AuthModal.jsx";
import { ResetPasswordModal } from "./components/ResetPasswordModal.jsx";
import { WeightSliders } from "./components/WeightSliders.jsx";
import { CommunityTab } from "./components/community/CommunityTab.jsx";
import { countUnseenFollowers, markFollowersSeen } from "./utils/followsApi.js";

/** Drops optional paragraphs from welcome body (DB or defaults): play-mode aside; sign-in/cloud disclaimer (EN+ZH) so languages stay aligned when overrides differ. */
function omitPlayWelcomeAside(body) {
  if (!body) return body;
  const drop = (p) =>
    p.includes("Play around! Nothing saves permanently") ||
    p.includes("Sign in to sync your ratings to the cloud") ||
    p.includes("登入後，你的評分會同步到雲端");
  return body.split("\n\n").filter((p) => !drop(p)).join("\n\n");
}

export default function App() {
  const { user, authReady, username } = useAuth();
  const [st, dispatch] = useReducer(reducer, { entries: [], view: "log" });
  const [cafes, setCafes] = useState([]);
  /** Shared cross-user catalog for PlacePicker. Loaded once on auth boot. */
  const [restaurantPlaces, setRestaurantPlaces] = useState([]);
  const [cafePlaces, setCafePlaces] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [faqOverrides, setFaqOverrides] = useState({});
  const [welcomeOverride, setWelcomeOverride] = useState({});
  /** Unseen-followers count drives the red badge on the Community tab in the
   *  bottom nav. Refreshed on auth + after every follow/unfollow action; the
   *  Friends sub-tab additionally calls markFollowersSeen on mount to clear it. */
  const [unseenFollowers, setUnseenFollowers] = useState(0);
  /** Mandarin localization is temporarily stashed while EN gets polish.
   *  `T.zh` and components' `lang === "zh"` branches are intentionally preserved
   *  so reviving = restore lang state + UI toggles. See
   *  docs/decisions/2026-04-28-stash-mandarin-localization.md. */
  const lang = "en";
  const t = T.en;
  const needsAuth = authReady && !user;

  useEffect(() => {
    if (user) setShowAuthModal(false);
  }, [user]);

  useEffect(() => {
    if (authReady && !user) setShowAuthModal(true);
  }, [authReady, user]);

  const refreshUnseenFollowers = useCallback(async () => {
    if (!user?.id) { setUnseenFollowers(0); return; }
    const n = await countUnseenFollowers(supabase, user.id);
    setUnseenFollowers(n);
  }, [user?.id]);

  /** Friends sub-tab calls this when it mounts; we stamp the seen-at and
   *  immediately recount so the badge clears without needing to wait for the
   *  next refresh trigger. */
  const handleMarkFollowersSeen = useCallback(async () => {
    if (!user?.id) return;
    await markFollowersSeen(supabase, user.id);
    await refreshUnseenFollowers();
  }, [user?.id, refreshUnseenFollowers]);

  useEffect(() => { refreshUnseenFollowers(); }, [refreshUnseenFollowers]);

  /** Bundled `translations.js` by default. Supabase `welcome_*` only when hosting sets `VITE_WELCOME_USE_SUPABASE=true` (opt-in). */
  const welcomeUseDbCopy = import.meta.env.VITE_WELCOME_USE_SUPABASE === 'true';
  const welcomeTitleDisplay = (welcomeUseDbCopy && welcomeOverride[lang+"_title"]) || t.welcome1;
  const welcomeBodyDisplay = omitPlayWelcomeAside((welcomeUseDbCopy && welcomeOverride[lang+"_body"]) || t.welcome2);

  function dismissWelcome() {
    setShowWelcome(false);
  }
  const [editR, setEditR] = useState(null);
  const [editC, setEditC] = useState(null);
  const [logTab, setLogTab] = useState("restaurants");
  const [addType, setAddType] = useState("restaurant");
  const [sortBy, setSortBy] = useState("bite");
  const [sortAsc, setSortAsc] = useState(false);
  const [tiers, setTiers] = useState(new Set());
  const [cityFilter, setCityFilter] = useState("");
  const lastCity = useRef("NYC");
  const [showFilter, setShowFilter] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [weights, setWeights] = useState({taste:50,bpb:40,wait:10});
  const restaurantWeightsSum = weights.taste + weights.bpb + weights.wait;
  const canProceedWelcome = restaurantWeightsSum === 100;
  const [drinkWeights, setDrinkWeights] = useState({taste:70,bpb:20,wait:10});
  const [sweetWeights, setSweetWeights] = useState({taste:70,bpb:20,wait:10});
  const [questL, setQuestL] = useState(new Set(["T","M","S","U","C","D","Y","K"]));
  const [cafeSortBy, setCafeSortBy] = useState("bite");
  const [cafeSortAsc, setCafeSortAsc] = useState(false);
  const [cafeFilterMilk, setCafeFilterMilk] = useState("");
  const [cafeFilterBean, setCafeFilterBean] = useState("");
  const [showCafeFilter, setShowCafeFilter] = useState(false);
  const [cafeSearch, setCafeSearch] = useState("");
  const [showCafeSearch, setShowCafeSearch] = useState(false);
  const [sweetsSearch, setSweetsSearch] = useState("");
  const [showSweetsSearch, setShowSweetsSearch] = useState(false);
  const [sweetsSortBy, setSweetsSortBy] = useState("bite");
  const [sweetsSortAsc, setSweetsSortAsc] = useState(false);
  const fRef = useRef(null);
  const sRef = useRef(null);
  const cfRef = useRef(null);
  const csRef = useRef(null);
  const ssRef = useRef(null);

  useEffect(()=>{
    function h(e){
      if(fRef.current&&!fRef.current.contains(e.target))setShowFilter(false);
      if(sRef.current&&!sRef.current.contains(e.target))setShowSearch(false);
      if(cfRef.current&&!cfRef.current.contains(e.target))setShowCafeFilter(false);
      if(csRef.current&&!csRef.current.contains(e.target))setShowCafeSearch(false);
      if(ssRef.current&&!ssRef.current.contains(e.target))setShowSweetsSearch(false);
    }
    document.addEventListener("mousedown",h);document.addEventListener("touchstart",h);
    return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("touchstart",h);};
  },[]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    async function load() {
      try {
        if (!user) {
          dispatch({ type: "LOAD", entries: [] });
          setCafes([]);
          setRestaurantPlaces([]);
          setCafePlaces([]);
        } else {
          if (import.meta.env.DEV) {
            console.log("[BITE] AuthContext user at load()", {
              id: user.id,
              email: user.email,
            });
          }
          dispatch({ type: "LOAD", entries: [] });
          setCafes([]);
          // Profile sync is owned by AuthContext; we just read visits here.
          // Shared `*_places` catalog is read in parallel for the PlacePicker
          // typeahead — RLS allows authenticated SELECT on all rows.
          const [entries, cafeRows, rPlaces, cPlaces] = await Promise.all([
            fetchRestaurantVisitsJoined(supabase, user.id),
            fetchCafeVisitsJoined(supabase, user.id),
            fetchAllRestaurantPlaces(supabase),
            fetchAllCafePlaces(supabase),
          ]);
          if (import.meta.env.DEV) {
            console.log("[BITE] load() fetched rows", {
              restaurantEntryCount: entries.length,
              cafeRowCount: cafeRows.length,
              restaurantPlaceCount: rPlaces.length,
              cafePlaceCount: cPlaces.length,
              cancelled,
            });
          }
          if (cancelled) return;
          dispatch({ type: "LOAD", entries });
          setCafes(cafeRows);
          setRestaurantPlaces(rPlaces);
          setCafePlaces(cPlaces);
          if (import.meta.env.DEV) {
            console.log("[BITE] reducer LOAD applied", { entriesLength: entries.length });
          }
        }

        const { data: sData, error: settingsErr } = await supabase.from("settings").select("*");
        if (settingsErr) console.warn("[BITE] settings:", settingsErr.message);
        if (cancelled) return;
        if (sData) {
          let questHandled = false;
          if (user) {
            try {
              const raw = localStorage.getItem(`bite_questLetters_${user.id}`);
              if (raw) {
                setQuestL(new Set(JSON.parse(raw)));
                questHandled = true;
              }
            } catch (e) {
              console.error("quest letters localStorage:", e);
            }
          }
          if (!questHandled) {
            const ql = sData.find((s) => s.key === "questLetters");
            if (ql) setQuestL(new Set(JSON.parse(ql.value)));
          }
          const faqOverrides = {};
          sData.filter((s) => s.key.startsWith("faq_override_")).forEach((s) => {
            const idx = parseInt(s.key.replace("faq_override_", ""), 10);
            faqOverrides[idx] = s.value;
          });
          if (Object.keys(faqOverrides).length > 0) setFaqOverrides(faqOverrides);
          const wo = {};
          sData.filter((s) => s.key.startsWith("welcome_")).forEach((s) => {
            wo[s.key.replace("welcome_", "")] = s.value;
          });
          if (Object.keys(wo).length > 0) setWelcomeOverride(wo);
        }
      } catch (err) {
        console.error("Supabase load error:", err);
      } finally {
        // Always clear loading shell (React StrictMode can cancel an in-flight load; the next run completes).
        setDbLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authReady, user?.id]);

  /** Each slider 0–100; BITE uses relative mix (see `restaurantWeightRatios` in scoring). */
  function updW(k, v) {
    const nv = Math.round(Math.min(100, Math.max(0, +v)));
    setWeights((w) => ({ ...w, [k]: nv }));
  }

  function resetWeights(defaults) {
    setWeights({ ...defaults });
  }

  function replaceRestaurantWeights(next) {
    setWeights({
      taste: Math.round(Math.min(100, Math.max(0, Number(next.taste) || 0))),
      bpb: Math.round(Math.min(100, Math.max(0, Number(next.bpb) || 0))),
      wait: Math.round(Math.min(100, Math.max(0, Number(next.wait) || 0))),
    });
  }

  /** Drinks / sweets weights: same edit-then-Save pattern as restaurants (see PaletteView). */
  function clampWeights(next) {
    return {
      taste: Math.round(Math.min(100, Math.max(0, Number(next.taste) || 0))),
      bpb:   Math.round(Math.min(100, Math.max(0, Number(next.bpb)   || 0))),
      wait:  Math.round(Math.min(100, Math.max(0, Number(next.wait)  || 0))),
    };
  }
  function replaceDrinkWeights(next){ setDrinkWeights(clampWeights(next)); }
  function replaceSweetWeights(next){ setSweetWeights(clampWeights(next)); }

  function toggleQ(l) {
    const letterCovered = new Set(st.entries.map((e) => (e.letter || e.cuisine?.[0])?.toUpperCase()));
    if (!letterCovered.has(l) || !user) return;
    const next = new Set(questL);
    next.has(l) ? next.delete(l) : next.add(l);
    setQuestL(next);
    try {
      localStorage.setItem(`bite_questLetters_${user.id}`, JSON.stringify([...next]));
    } catch (err) {
      console.error("quest letters save:", err);
    }
  }

  const sortedR = [...st.entries].sort((a,b)=>{
    let d=0;
    // For each field, d>0 means a should come FIRST in descending (default ↓) order
    // i.e. d = "a is better than b"
    if(sortBy==="bite") d=(calcBiteOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,weights)??0)-(calcBiteOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,weights)??0);
    else if(sortBy==="taste") d=a.taste-b.taste;
    else if(sortBy==="bpb") d=(b.cost/b.portions)-(a.cost/a.portions); // lower cost = better
    else if(sortBy==="wait") d=b.wait-a.wait; // lower wait = better
    else if(sortBy==="repeat") d=a.repeatability-b.repeatability;
    // sortAsc=false (↓) = best first (d descending), sortAsc=true (↑) = worst first
    return sortAsc?d:-d;
  });

  const allCities = [...new Set(sortedR.map(e=>e.city||"NYC"))].sort();
  const filtered = sortedR.filter(e=>{
    if(tiers.size>0&&!tiers.has(scoreLabel(calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights),t)))return false;
    if(cityFilter&&(e.city||"NYC")!==cityFilter)return false;
    if(search.trim()){const q=search.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.cuisine.toLowerCase().includes(q)||(e.city||'NYC').toLowerCase().includes(q)||(e.notes&&e.notes.toLowerCase().includes(q));}
    return true;
  });

  const DRINK_CATS = ["Coffee","Tea","Other"];
  const sortedDrinks = [...cafes].filter(e=>DRINK_CATS.includes(e.category)).sort((a,b)=>{
    let d=0;
    if(cafeSortBy==="bite") d=(calcCafeOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,drinkWeights)??0)-(calcCafeOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,drinkWeights)??0);
    else if(cafeSortBy==="taste") d=b.taste-a.taste;
    else if(cafeSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
    else if(cafeSortBy==="wait") d=a.wait-b.wait;
    else if(cafeSortBy==="repeat") d=b.repeatability-a.repeatability;
    return cafeSortAsc?-d:d;
  }).filter(e=>{
    if(cafeFilterMilk&&e.milkLevel!==cafeFilterMilk)return false;
    if(cafeFilterBean&&regionOf(e.beanRegion)!==cafeFilterBean)return false;
    if(cafeSearch.trim()){const q=cafeSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q);}
    return true;
  });

  const sortedSweets = [...cafes].filter(e=>e.category==="Sweets").sort((a,b)=>{
    let d=0;
    if(sweetsSortBy==="bite") d=(calcCafeOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,sweetWeights)??0)-(calcCafeOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,sweetWeights)??0);
    else if(sweetsSortBy==="taste") d=b.taste-a.taste;
    else if(sweetsSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
    else if(sweetsSortBy==="wait") d=a.wait-b.wait;
    else if(sweetsSortBy==="repeat") d=b.repeatability-a.repeatability;
    return sweetsSortAsc?-d:d;
  }).filter(e=>{
    if(sweetsSearch.trim()){const q=sweetsSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q);}
    return true;
  });

  const tierFilterRows = rating010FilterRows(t);
  const tabSt = (on) => ({padding:"7px 18px",borderRadius:20,border:"1.5px solid "+(on?"#F0997B":"rgba(255,255,255,0.1)"),background:on?"#3C1F13":"transparent",color:on?"#F0997B":"#888780",fontSize:13,fontWeight:on?500:400,cursor:"pointer"});

  function getDisplay(e) {
    if(sortBy==="taste"){const tv=e.taste,lbl=tasteLabel(tv,t),col=tasteColor(tv);return{val:tv.toFixed(1),label:lbl,color:col};}
    if(sortBy==="bpb") return{val:"$"+(e.cost/e.portions).toFixed(2),label:t.perPortion,color:"#5B9BD5"};
    if(sortBy==="wait") return{val:e.wait+" min",label:t.waitLabel,color:"#888780"};
    if(sortBy==="repeat") return{val:e.useR?("⭐".repeat(e.repeatability)||"✕"):t.off,label:e.useR?(e.repeatability===3?t.mustReturnLabel:e.repeatability===2?t.wouldSeekOutLabel:e.repeatability===1?t.ifOccasionCallsLabel:t.wouldntReturnLabel):"off",color:"#EF9F27"};
    const sc=calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights);
    return{val:sc!=null?sc.toFixed(2):"—",label:scoreLabel(sc,t),color:scoreColor(sc)};
  }

  /** Keep the local PlacePicker catalog warm: any time `ensure*Place` resolves a
   *  placeId we don't yet know about (newly inserted, or matched via ilike to a
   *  row we hadn't loaded), append it so the dropdown reflects reality without
   *  a full refetch. When the row is already present, merge any **new** fields
   *  in (e.g. verified_* fields freshly populated by `places-resolve` arriving
   *  for a row we already had under a different lookup) — but never overwrite
   *  existing non-empty values, so user-typed fallbacks aren't clobbered by
   *  empty Google data. */
  function upsertPlace(setter, placeId, fields) {
    setter((cur) => {
      const idx = cur.findIndex((p) => p.id === placeId);
      if (idx === -1) return [...cur, { id: placeId, ...fields }];
      const existing = cur[idx];
      const merged = { ...existing };
      for (const [k, v] of Object.entries(fields || {})) {
        if (v == null || v === "") continue;
        if (merged[k] == null || merged[k] === "") merged[k] = v;
      }
      const next = cur.slice();
      next[idx] = merged;
      return next;
    });
  }

  async function insertCafeEntry(entry) {
    if (!user) return;
    try {
      const placeId = await ensureCafePlace(supabase, {
        placeId: entry.placeId || null,
        name: entry.name,
        city: entry.city || "",
      });
      upsertPlace(setCafePlaces, placeId, {
        name: entry.name,
        city: entry.city || "",
      });
      const { data, error } = await supabase
        .from("cafe_visits")
        .insert([cafeVisitInsertPayload(placeId, user.id, entry)])
        .select(CAFE_VISIT_SELECT);
      if (error) console.error("cafe insert error:", error);
      const mapped = (data || []).map((row) => mapCafeVisitRow(row));
      setCafes((p) => [...p, ...mapped]);
    } catch (err) {
      console.error("cafe insert threw:", err);
    }
  }

  return (
    <LangContext.Provider value={{t,lang}}>
    <div style={{fontFamily:"var(--font-sans)",maxWidth:640,margin:"0 auto",padding:user?"1.25rem 1rem max(8rem, env(safe-area-inset-bottom)) 1rem":"1.25rem 1rem 2rem 1rem",background:"#141413",minHeight:"100vh",color:"#F1EFE8",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap');
        input,select,textarea{background:#252523!important;color:#F1EFE8!important;border:1px solid rgba(255,255,255,0.2)!important;border-radius:8px;padding:9px 12px;}
        input:focus,textarea:focus{border-color:#F0997B!important;outline:none;}
        input::placeholder,textarea::placeholder{color:#666663!important;}
        input[type=range]{accent-color:#F0997B;padding:0;border:none!important;background:transparent!important;}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}
      `}</style>

      <div style={{marginBottom:"1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{ flexShrink: 0, position: "relative" }}>
            <MouthLogo />
          </div>
          <div>
            <h1 style={{fontSize:28,fontWeight:600,color:"#F0997B",margin:0,fontFamily:"'Fredoka',sans-serif"}}>BITE Score</h1>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button type="button" onClick={()=>setShowAuthModal(true)} style={{fontSize:11,fontWeight:500,padding:"5px 12px",borderRadius:20,border:"1.5px solid rgba(255,255,255,0.2)",background:user?"#3C1F13":"transparent",color:user?"#F0997B":"#888780",cursor:"pointer",letterSpacing:"0.03em",flexShrink:0,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={user?.email||t.signIn}>{user?(username||user.email?.split("@")[0]||t.account):t.signIn}</button>
        </div>
      </div>

      {!authReady && (
        <p style={{ fontSize: 14, color: "#888780", margin: "8px 0 0" }}>
          Connecting…
        </p>
      )}

      {needsAuth && (
        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 20, fontWeight: 600, color: "#F1EFE8", margin: "0 0 12px", lineHeight: 1.35 }}>{t.signInGateTitle}</p>
          <p style={{ fontSize: 14, color: "#888780", margin: "0 0 22px", lineHeight: 1.65 }}>{t.signInGateBody}</p>
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 12,
              border: "none",
              background: "#F0997B",
              color: "#141413",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.signInGateButton}
          </button>
        </div>
      )}

      {user && showWelcome && dbLoaded && (
        <div onClick={()=>dismissWelcome()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1E1E1C",borderRadius:16,padding:"1.5rem",maxWidth:360,width:"100%",border:"0.5px solid rgba(255,255,255,0.15)"}}>
            <div style={{fontSize:24,marginBottom:12,textAlign:"center",cursor:"default",userSelect:"none"}}>👋</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16}}>
              <p style={{fontSize:16,fontWeight:600,color:"#F1EFE8",margin:0,lineHeight:1.5,textAlign:"center"}}>{welcomeTitleDisplay}</p>
              <InfoBubble content={welcomeBodyDisplay.split("\n\n")[0]||""}/>
            </div>
            <div style={{borderTop:"0.5px solid rgba(255,255,255,0.08)",paddingTop:14,marginBottom:14}}>
              <WeightSliders weights={weights} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"],[t.wait,"wait"]]} onUpdate={updW} onReset={resetWeights} defaults={{taste:50,bpb:40,wait:10}} careHeadingPx={15}/>
              <div style={{fontSize:12,color:canProceedWelcome?"#97C459":"#EF9F27",textAlign:"center",marginTop:8}}>
                {t.weightsTotal}: {restaurantWeightsSum}/100
              </div>
              {!canProceedWelcome&&(
                <div style={{fontSize:11,color:"#F1EFE8",textAlign:"center",marginTop:4}}>
                  {t.weightsSumTo100}
                </div>
              )}
            </div>
            {welcomeBodyDisplay.split("\n\n").slice(1).map((para,i)=>(
              <p key={i} style={{fontSize:13,color:"#F1EFE8",margin:"0 0 12px",lineHeight:1.7,textAlign:"center",whiteSpace:"pre-line"}}>{para}</p>
            ))}
            <button type="button" disabled={!canProceedWelcome} onClick={dismissWelcome} style={{width:"100%",padding:"12px",background:canProceedWelcome?"#F0997B":"#5A4A43",color:canProceedWelcome?"#141413":"#AFA8A3",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:canProceedWelcome?"pointer":"not-allowed",opacity:canProceedWelcome?1:0.85}}>{t.welcomeBtn}</button>
          </div>
        </div>
      )}

      {user && (
      <>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:640,background:"#1A1A18",borderTop:"0.5px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-around",alignItems:"center",padding:"8px 0 max(8px,env(safe-area-inset-bottom))",zIndex:100}}>
        {[["log","📋",t.myLog],["palette","😋",t.myTaste],["add","➕",t.add],["community","🌐",t.communityTab],["faq","❓",t.faq]].map(([v,icon,label])=>{
          const badge = v==="community" && unseenFollowers > 0 ? unseenFollowers : 0;
          return (
            <button key={v} onClick={()=>{dispatch({type:"VIEW",view:v});setEditR(null);setEditC(null);window.scrollTo({top:0,behavior:"instant"});}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 8px",minWidth:56}}>
              {v==="add"?(
                <div style={{width:44,height:44,borderRadius:"50%",background:"#F0997B",border:"2px solid #F0997B",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-8,marginBottom:2}}>
                  <span style={{fontSize:22,lineHeight:1,color:"#141413"}}>➕</span>
                </div>
              ):(
                <span style={{fontSize:20,lineHeight:1,position:"relative",display:"inline-block"}}>
                  {icon}
                  {badge>0 && (
                    <span style={{position:"absolute",top:-4,right:-10,minWidth:16,height:16,padding:"0 4px",borderRadius:8,background:"#E85A5A",color:"#FFF",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxSizing:"border-box",border:"1.5px solid #1A1A18"}}>
                      {badge>99 ? "99+" : badge}
                    </span>
                  )}
                </span>
              )}
              <span style={{fontSize:10,color:st.view===v?"#F0997B":"#888780",fontWeight:st.view===v?500:400,transition:"color 0.15s"}}>{label}</span>
              {st.view===v&&v!=="add"&&<div style={{width:4,height:4,borderRadius:"50%",background:"#F0997B",marginTop:1}}/>}
            </button>
          );
        })}
      </div>

      {/* ── My Log ── */}
      {st.view==="log"&&!editR&&!editC&&!dbLoaded&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
          {[1,2,3,4,5].map(i=>(
            <div key={i} style={{background:"#1E1E1C",borderRadius:10,height:62,opacity:0.4+i*0.08,animation:"pulse 1.2s ease-in-out infinite"}}/>
          ))}
        </div>
      )}
      {st.view==="log"&&!editR&&!editC&&dbLoaded&&(
        <div>
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",background:"#252523",borderRadius:10,padding:3,gap:2,marginBottom:8}}>
              {[["restaurants","🍽 "+t.restaurants],["drinks","☕ "+t.drinks],["sweets","🥐 "+t.sweets]].map(([v,l])=>(
                <button key={v} onClick={()=>setLogTab(v)} style={{flex:1,padding:"6px 0",textAlign:"center",borderRadius:8,border:"none",background:logTab===v?"#3C1F13":"transparent",color:logTab===v?"#F0997B":"#888780",fontSize:11,fontWeight:logTab===v?700:500,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
              ))}
            </div>
            {user&&<p style={{fontSize:12,color:"#888780",margin:0}}>{t.swipeHint}</p>}
          </div>
          <div style={{borderBottom:"0.5px solid rgba(255,255,255,0.08)",marginBottom:12}}/>

          {logTab==="restaurants"&&(
            <div>

              {allCities.length>1&&(
                <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",scrollbarWidth:"none",marginBottom:8,paddingBottom:2}}>
                  <div onClick={()=>setCityFilter("")} style={{padding:"4px 12px",borderRadius:16,fontSize:11,cursor:"pointer",flexShrink:0,background:!cityFilter?"#3C1F13":"transparent",color:!cityFilter?"#F0997B":"#888780",border:"1px solid "+(!cityFilter?"#F0997B":"rgba(255,255,255,0.1)")}}>All</div>
                  {allCities.map(city=>(
                    <div key={city} onClick={()=>setCityFilter(city===cityFilter?"":city)} style={{padding:"4px 12px",borderRadius:16,fontSize:11,cursor:"pointer",flexShrink:0,background:cityFilter===city?"rgba(91,155,213,0.15)":"transparent",color:cityFilter===city?"#5B9BD5":"#888780",border:"1px solid "+(cityFilter===city?"rgba(91,155,213,0.5)":"rgba(255,255,255,0.1)")}}>📍 {city}</div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:2}}>
                  {[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat",t.repeatability]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSortBy(v)} style={{padding:"5px 12px",borderRadius:16,border:"1px solid "+(sortBy===v?"#F0997B":"rgba(255,255,255,0.1)"),background:sortBy===v?"#3C1F13":"transparent",color:sortBy===v?"#F0997B":"#888780",fontSize:12,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <div ref={sRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowSearch(s=>!s)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showSearch||search?"#F0997B":"rgba(255,255,255,0.1)"),background:showSearch||search?"#3C1F13":"transparent",color:showSearch||search?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                    {showSearch&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 10px",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,width:200}}>
                        <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.searchPlaceholder} style={{width:"100%",boxSizing:"border-box",fontSize:12}}/>
                        {search&&<button onClick={()=>setSearch("")} style={{fontSize:11,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:"4px 0 0",display:"block"}}>{t.clear}</button>}
                      </div>
                    )}
                  </div>
                  <div ref={fRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowFilter(f=>!f)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showFilter||tiers.size>0?"#F0997B":"rgba(255,255,255,0.1)"),background:showFilter||tiers.size>0?"#3C1F13":"transparent",color:showFilter||tiers.size>0?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 2h12l-4.5 5.5V12L5.5 10.5V7.5L1 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                    </button>
                    {showFilter&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,overflow:"hidden",minWidth:180,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50}}>
                        <div style={{padding:"6px 10px",borderBottom:"0.5px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={S.sm}>{t.filterByTier}</span>
                          {tiers.size>0&&<button onClick={()=>setTiers(new Set())} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:0}}>{t.clear}</button>}
                        </div>
                        {tierFilterRows.map(([tier,col])=>{
                          const on=tiers.has(tier);
                          const cnt=sortedR.filter(e=>scoreLabel(calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights),t)===tier).length;
                          return(
                            <div key={tier} onClick={()=>setTiers(p=>{const n=new Set(p);on?n.delete(tier):n.add(tier);return n;})} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:"0.5px solid rgba(255,255,255,0.1)",cursor:"pointer",background:on?"rgba(255,255,255,0.03)":"transparent"}}>
                              <div style={{width:13,height:13,borderRadius:3,border:"1.5px solid "+(on?col:"rgba(255,255,255,0.1)"),background:on?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<span style={{color:"#141413",fontSize:9,fontWeight:700,lineHeight:1}}>✓</span>}</div>
                              <span style={{flex:1,fontSize:12,color:on?col:"#F1EFE8",fontWeight:on?500:400}}>{tier}</span>
                              <span style={S.sm}>{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setSortAsc(a=>!a)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+"#F0997B",background:"#3C1F13",color:"#F0997B",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{sortAsc?"↑":"↓"}</button>
                </div>
              </div>
              {filtered.length===0&&<p style={{color:"#888780",fontSize:14}}>{t.noEntries}</p>}
              {(()=>{
                const groups={};
                filtered.forEach(e=>{const k=e.name;if(!groups[k])groups[k]=[];groups[k].push(e);});
                const groupArr=Object.values(groups).map(grp=>{
                  const e=grp[grp.length-1];
                  const biteVals=grp.map(e=>calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights)).filter(v=>v!=null);
                  const avgBite=biteVals.length?biteVals.reduce((a,b)=>a+b,0)/biteVals.length:0;
                  const avgTaste=grp.reduce((a,e)=>a+e.taste,0)/grp.length;
                  const avgBpb=grp.reduce((a,e)=>a+(e.cost/e.portions),0)/grp.length;
                  const avgWait=grp.reduce((a,e)=>a+e.wait,0)/grp.length;
                  const avgRepeat=grp.reduce((a,e)=>a+e.repeatability,0)/grp.length;
                  // sortVal: higher = better (for descending = best first)
                  const visits=grp.length;
                  const sortVal=sortBy==="taste"?avgTaste:sortBy==="bpb"?-avgBpb:sortBy==="wait"?-avgWait:sortBy==="repeat"?avgRepeat+(visits*0.001):avgBite;
                  return {grp, e, sortVal};
                }).sort((a,b)=>sortAsc?a.sortVal-b.sortVal:b.sortVal-a.sortVal);
                return groupArr.map(({grp,e})=>{
                  const visits=grp.length;
                  const display=getDisplay(e);
                  return (
                    <RestRow key={e.id} e={e} display={display} user={user} visits={visits} group={grp} weights={weights}
                      onEdit={v=>{setEditR(v||e);window.scrollTo({top:0,behavior:"smooth"});}}
                      onDelete={async id=>{
                        const did=id||e.id;
                        const row=st.entries.find(x=>x.id===did);
                        if(!canMutateVisit(row,user))return;
                        try{await supabase.from("restaurant_visits").delete().eq("id",did);}catch(err){console.error("restaurant delete threw:",err);}
                        dispatch({type:"DEL",id:did});
                      }}/>
                  );
                });
              })()}
              {sortedR.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedR.length)],[t.avgBite,(()=>{const m=meanRestaurantBiteOutOf10(sortedR,weights);return m!=null?`${m.toFixed(2)}/10`:"—";})()]].map(([l,v])=>(
                    <div key={l} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={S.sm}>{l}</div>
                      <div style={{fontSize:20,fontWeight:500,color:"#F1EFE8"}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {logTab==="drinks"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:2}}>
                  {[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat","Repeat"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setCafeSortBy(v)} style={{padding:"5px 12px",borderRadius:16,border:"1px solid "+(cafeSortBy===v?"#F0997B":"rgba(255,255,255,0.1)"),background:cafeSortBy===v?"#3C1F13":"transparent",color:cafeSortBy===v?"#F0997B":"#888780",fontSize:12,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <div ref={csRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowCafeSearch(s=>!s)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showCafeSearch||cafeSearch?"#F0997B":"rgba(255,255,255,0.1)"),background:showCafeSearch||cafeSearch?"#3C1F13":"transparent",color:showCafeSearch||cafeSearch?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                    {showCafeSearch&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 10px",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,width:200}}>
                        <input autoFocus value={cafeSearch} onChange={e=>setCafeSearch(e.target.value)} placeholder={t.searchPlaceholder} style={{width:"100%",boxSizing:"border-box",fontSize:12}}/>
                        {cafeSearch&&<button onClick={()=>setCafeSearch("")} style={{fontSize:11,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:"4px 0 0",display:"block"}}>{t.clear}</button>}
                      </div>
                    )}
                  </div>
                  <div ref={cfRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowCafeFilter(f=>!f)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showCafeFilter||cafeFilterMilk||cafeFilterBean?"#F0997B":"rgba(255,255,255,0.1)"),background:showCafeFilter||cafeFilterMilk||cafeFilterBean?"#3C1F13":"transparent",color:showCafeFilter||cafeFilterMilk||cafeFilterBean?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 2h12l-4.5 5.5V12L5.5 10.5V7.5L1 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                    </button>
                    {showCafeFilter&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,overflow:"hidden",minWidth:200,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,padding:"10px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <span style={S.sm}>Filter</span>
                          {(cafeFilterMilk||cafeFilterBean)&&<button onClick={()=>{setCafeFilterMilk("");setCafeFilterBean("");}} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:0}}>{t.clear}</button>}
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:10,color:"#888780",marginBottom:6}}>{t.milk}</div>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                            {["None","Light","Medium","Heavy"].map(m=>(
                              <div key={m} onClick={()=>setCafeFilterMilk(cafeFilterMilk===m?"":m)} style={{padding:"4px 8px",borderRadius:12,cursor:"pointer",fontSize:11,background:cafeFilterMilk===m?"#3C1F13":"#141413",border:"1px solid "+(cafeFilterMilk===m?"#F0997B":"rgba(255,255,255,0.1)"),color:cafeFilterMilk===m?"#F0997B":"#888780"}}>{m}</div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:"#888780",marginBottom:6}}>{t.beanOrigin}</div>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                            {BEAN_REGIONS.filter(b=>b!=="Other").map(b=>(
                              <div key={b} onClick={()=>setCafeFilterBean(cafeFilterBean===b?"":b)} style={{padding:"4px 8px",borderRadius:12,cursor:"pointer",fontSize:11,background:cafeFilterBean===b?"#3C1F13":"#141413",border:"1px solid "+(cafeFilterBean===b?"#F0997B":"rgba(255,255,255,0.1)"),color:cafeFilterBean===b?"#F0997B":"#888780"}}>{b}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setCafeSortAsc(a=>!a)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid #F0997B",background:"#3C1F13",color:"#F0997B",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{cafeSortAsc?"↑":"↓"}</button>
                </div>
              </div>
              {!sortedDrinks.length&&<p style={{color:"#888780",fontSize:14}}>{t.noDrinks}</p>}
              {(()=>{
                const groups={};
                sortedDrinks.forEach(e=>{const k=e.name;if(!groups[k])groups[k]=[];groups[k].push(e);});
                const getSortVal=(grp)=>{
                  const avg=(fn)=>grp.reduce((a,e)=>a+fn(e),0)/grp.length;
                  if(cafeSortBy==="taste") return avg(e=>e.taste);
                  if(cafeSortBy==="bpb") return -avg(e=>e.cost/e.portions);
                  if(cafeSortBy==="wait") return -avg(e=>e.wait);
                  if(cafeSortBy==="repeat") return avg(e=>e.repeatability)+(grp.length*0.001);
                  return avg(e=>calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,drinkWeights)??0);
                };
                return Object.entries(groups).sort((a,b)=>cafeSortAsc?getSortVal(a[1])-getSortVal(b[1]):getSortVal(b[1])-getSortVal(a[1])).map(([name,grp])=>(
                  <CafeGroupRow key={name} group={grp} cafeSortBy={cafeSortBy} weights={drinkWeights} user={user} onEdit={e=>{setEditC(e);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={async id=>{
                        const row=cafes.find(x=>x.id===id);
                        if(!canMutateVisit(row,user))return;
                        try{await supabase.from("cafe_visits").delete().eq("id",id);}catch(err){console.error("cafe delete threw:",err);}
                        setCafes(p=>p.filter(x=>x.id!==id));
                      }}/>
                ));
              })()}
              {sortedDrinks.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedDrinks.length)],[t.avgBite,(sortedDrinks.reduce((a,e)=>a+(calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,drinkWeights)??0),0)/sortedDrinks.length).toFixed(2)]].map(([l,v])=>(
                    <div key={l} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={S.sm}>{l}</div>
                      <div style={{fontSize:20,fontWeight:500,color:"#F1EFE8"}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {logTab==="sweets"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:2}}>
                  {[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat","Repeat"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSweetsSortBy(v)} style={{padding:"5px 12px",borderRadius:16,border:"1px solid "+(sweetsSortBy===v?"#F0997B":"rgba(255,255,255,0.1)"),background:sweetsSortBy===v?"#3C1F13":"transparent",color:sweetsSortBy===v?"#F0997B":"#888780",fontSize:12,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <div ref={ssRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowSweetsSearch(s=>!s)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showSweetsSearch||sweetsSearch?"#F0997B":"rgba(255,255,255,0.1)"),background:showSweetsSearch||sweetsSearch?"#3C1F13":"transparent",color:showSweetsSearch||sweetsSearch?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                    {showSweetsSearch&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 10px",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,width:200}}>
                        <input autoFocus value={sweetsSearch} onChange={e=>setSweetsSearch(e.target.value)} placeholder={t.searchPlaceholder} style={{width:"100%",boxSizing:"border-box",fontSize:12}}/>
                        {sweetsSearch&&<button onClick={()=>setSweetsSearch("")} style={{fontSize:11,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:"4px 0 0",display:"block"}}>{t.clear}</button>}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setSweetsSortAsc(a=>!a)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid #F0997B",background:"#3C1F13",color:"#F0997B",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{sweetsSortAsc?"↑":"↓"}</button>
                </div>
              </div>
              {!sortedSweets.length&&<p style={{color:"#888780",fontSize:14}}>{t.noSweets}</p>}
              {(()=>{
                const groups={};
                sortedSweets.forEach(e=>{const k=e.name;if(!groups[k])groups[k]=[];groups[k].push(e);});
                const getSortValS=(grp)=>{
                  const avg=(fn)=>grp.reduce((a,e)=>a+fn(e),0)/grp.length;
                  if(sweetsSortBy==="taste") return avg(e=>e.taste);
                  if(sweetsSortBy==="bpb") return -avg(e=>e.cost/e.portions);
                  if(sweetsSortBy==="wait") return -avg(e=>e.wait);
                  if(sweetsSortBy==="repeat") return avg(e=>e.repeatability)+(grp.length*0.001);
                  return avg(e=>calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,sweetWeights)??0);
                };
                return Object.entries(groups).sort((a,b)=>sweetsSortAsc?getSortValS(a[1])-getSortValS(b[1]):getSortValS(b[1])-getSortValS(a[1])).map(([name,grp])=>(
                  <CafeGroupRow key={name} group={grp} cafeSortBy={sweetsSortBy} weights={sweetWeights} user={user} onEdit={e=>{setEditC(e);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={async id=>{
                        const row=cafes.find(x=>x.id===id);
                        if(!canMutateVisit(row,user))return;
                        try{await supabase.from("cafe_visits").delete().eq("id",id);}catch(err){console.error("cafe delete threw:",err);}
                        setCafes(p=>p.filter(x=>x.id!==id));
                      }}/>
                ));
              })()}
              {sortedSweets.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedSweets.length)],[t.avgBite,(sortedSweets.reduce((a,e)=>a+(calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,sweetWeights)??0),0)/sortedSweets.length).toFixed(2)]].map(([l,v])=>(
                    <div key={l} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={S.sm}>{l}</div>
                      <div style={{fontSize:20,fontWeight:500,color:"#F1EFE8"}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {st.view==="community"&&dbLoaded&&(
        <CommunityTab
          user={user}
          restaurantWeights={weights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
          unseenFollowers={unseenFollowers}
          onMarkFollowersSeen={handleMarkFollowersSeen}
          onFollowChange={refreshUnseenFollowers}
        />
      )}

      {st.view==="log"&&editR&&<RestForm initial={editR} weights={weights} existingEntries={st.entries} places={restaurantPlaces}
        onPlaceCreated={(p)=>upsertPlace(setRestaurantPlaces, p.id, p)}
        onSave={async e=>{
        let resolvedPlaceId = e.placeId;
        if(canMutateVisit(e,user)) {
          try {
            resolvedPlaceId = await ensureRestaurantPlace(supabase, {
              placeId: e.placeId || null,
              name: e.name,
              cuisine: e.cuisine,
              cuisine2: e.cuisine2 || "",
              isFusion: e.isFusion || false,
              city: e.city || "",
            });
            upsertPlace(setRestaurantPlaces, resolvedPlaceId, {
              name: e.name,
              city: e.city || "",
              cuisine: e.cuisine || "",
              cuisine2: e.cuisine2 || "",
              isFusion: !!e.isFusion,
            });
            const { error } = await supabase
              .from("restaurant_visits")
              .update(restaurantVisitUpdatePayload(resolvedPlaceId, e))
              .eq("id", e.id);
            if (error) console.error("restaurant update error:", error);
          } catch (err) {
            console.error("restaurant update threw:", err);
          }
        }
        dispatch({ type: "UPD", e: { ...e, placeId: resolvedPlaceId, ownerId: e.ownerId ?? user?.id ?? null } });
        setEditR(null);
      }} onCancel={()=>{setEditR(null);window.scrollTo({top:0,behavior:"smooth"});}}/>}
      {st.view==="log"&&editC&&<CafeForm initial={editC} weights={editC?.category==="Sweets"?sweetWeights:drinkWeights}
        onPlaceCreated={(p)=>upsertPlace(setCafePlaces, p.id, p)}
        onSave={async e=>{
        if (e.city) lastCity.current = e.city;
        let resolvedPlaceId = e.placeId;
        if(canMutateVisit(e,user)) {
          try {
            resolvedPlaceId = await ensureCafePlace(supabase, {
              placeId: e.placeId || null,
              name: e.name,
              city: e.city || "",
            });
            upsertPlace(setCafePlaces, resolvedPlaceId, {
              name: e.name,
              city: e.city || "",
            });
            const { error } = await supabase
              .from("cafe_visits")
              .update(cafeVisitUpdatePayload(resolvedPlaceId, e))
              .eq("id", e.id);
            if (error) console.error("cafe update error:", error, "id:", e.id);
          } catch (err) {
            console.error("cafe update threw:", err);
          }
        }
        setCafes(p=>p.map(x=>x.id===e.id?{...e,id:x.id,placeId:resolvedPlaceId??x.placeId,ownerId:e.ownerId??user?.id??x.ownerId}:x)); setEditC(null);
      }} onCancel={()=>{setEditC(null);window.scrollTo({top:0,behavior:"smooth"});}} existingCafes={cafes} places={cafePlaces}/>}

      {/* ── Add Rating ── */}
      {st.view==="add"&&(
        <div>
          {addType==="restaurant"
            ?<RestForm initial={{...INIT_REST,city:lastCity.current}} weights={weights} existingEntries={st.entries} places={restaurantPlaces}
                onPlaceCreated={(p)=>upsertPlace(setRestaurantPlaces, p.id, p)}
                onSave={async e=>{
                  if (e.city) lastCity.current = e.city;
                  if (!user) return;
                  try {
                    const placeId = await ensureRestaurantPlace(supabase, {
                      placeId: e.placeId || null,
                      name: e.name,
                      cuisine: e.cuisine,
                      cuisine2: e.cuisine2 || "",
                      isFusion: e.isFusion || false,
                      city: e.city || "",
                    });
                    upsertPlace(setRestaurantPlaces, placeId, {
                      name: e.name,
                      city: e.city || "",
                      cuisine: e.cuisine || "",
                      cuisine2: e.cuisine2 || "",
                      isFusion: !!e.isFusion,
                    });
                    const { data, error } = await supabase
                      .from("restaurant_visits")
                      .insert([restaurantVisitInsertPayload(placeId, user.id, e)])
                      .select(RESTAURANT_VISIT_SELECT)
                      .single();
                    if (error) console.error("restaurant insert error:", error);
                    if (data)
                      dispatch({
                        type: "ADD",
                        e: mapRestaurantVisitRow(data),
                      });
                  } catch (err) {
                    console.error("restaurant insert threw:", err);
                  }
                }}
                onCancel={()=>dispatch({type:"VIEW",view:"log"})}
                addType={addType} setAddType={setAddType}
              />
            :<CafeForm initial={{...INIT_CAFE,city:lastCity.current}} weights={drinkWeights}
                onPlaceCreated={(p)=>upsertPlace(setCafePlaces, p.id, p)}
                onSave={async e=>{
                  if (e.city) lastCity.current = e.city;
                  await insertCafeEntry(e);
                  dispatch({type:"VIEW",view:"log"});
                  setLogTab(e.category==="Sweets"?"sweets":"drinks");
                }}
                onSaveAndContinue={async e=>{
                  if (e.city) lastCity.current = e.city;
                  await insertCafeEntry(e);
                  window.scrollTo({top:0,behavior:"smooth"});
                }}
                onCancel={()=>dispatch({type:"VIEW",view:"log"})}
                addType={addType} setAddType={setAddType}
                existingCafes={cafes}
                places={cafePlaces}
              />
          }
        </div>
      )}

      {st.view==="suggest"&&<SuggestView entries={st.entries} weights={weights} onBack={()=>dispatch({type:"VIEW",view:"palette"})}/>}
      {st.view==="palette"&&(
        <PaletteView
          entries={st.entries}
          cafes={cafes}
          weights={weights}
          replaceRestaurantWeights={replaceRestaurantWeights}
          drinkWeights={drinkWeights}
          replaceDrinkWeights={replaceDrinkWeights}
          sweetWeights={sweetWeights}
          replaceSweetWeights={replaceSweetWeights}
          questL={questL}
          toggleQ={toggleQ}
          onOpenSuggest={()=>dispatch({type:"VIEW",view:"suggest"})}
        />
      )}

      {/* ── FAQ ── */}
      {st.view==="faq"&&<FaqView faqOverrides={faqOverrides}/>}

      </>
      )}

      <AuthModal open={showAuthModal} onClose={()=>setShowAuthModal(false)} />
      <ResetPasswordModal />
    </div>
    </LangContext.Provider>
  );
}
