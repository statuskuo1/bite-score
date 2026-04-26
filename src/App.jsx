import { useState, useReducer, useRef, useEffect } from "react";
import { LangContext } from "./contexts/LangContext.jsx";
import { T } from "./translations.js";
import { supabase } from "./config/supabaseClient.js";
import { ALPHABET, CUISINE_REGIONS, FLAGS } from "./constants/cuisineConstants.js";
import { RESTAURANTS, CAFES_INIT, INIT_REST, INIT_CAFE } from "./data/initialData.js";
import { reducer } from "./state/logReducer.js";
import {
  calcBite,
  calcCafe,
  calcMaxBite,
  scoreColor,
  scoreLabel,
  tasteLabel,
} from "./utils/scoring.js";
import { S } from "./styles/sharedStyles.js";
import { LogoWithTripleTap } from "./components/LogoWithTripleTap.jsx";
import { InfoBubble } from "./components/InfoBubble.jsx";
import { RestRow } from "./components/RestRow.jsx";
import { RestForm } from "./components/RestForm.jsx";
import { CafeForm } from "./components/CafeForm.jsx";
import { CafeGroupRow } from "./components/CafeGroupRow.jsx";
import { Tooltip } from "./components/Tooltip.jsx";
import { SuggestView } from "./components/SuggestView.jsx";
import { PaletteView } from "./components/PaletteView.jsx";
import { FaqView } from "./components/FaqView.jsx";

export default function App() {
  const [st, dispatch] = useReducer(reducer, {entries:RESTAURANTS, view:"log"});
  const [cafes, setCafes] = useState(CAFES_INIT);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [faqOverrides, setFaqOverrides] = useState({});
  const waveTaps = useRef([]);
  const [welcomeOverride, setWelcomeOverride] = useState({});
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [welcomeEditVal, setWelcomeEditVal] = useState("");
  const [lang, setLang] = useState(()=>localStorage.getItem("bite_lang")||"en");
  const t = T[lang]||T.en;
  function toggleLang(){const nl=lang==="en"?"zh":"en";setLang(nl);localStorage.setItem("bite_lang",nl);}

  useEffect(()=>{
    async function load() {
      try {
      const {data:rData} = await supabase.from("restaurants").select("*").order("created_at",{ascending:true});
      const {data:cData} = await supabase.from("cafes").select("*").order("created_at",{ascending:true});
      if(rData&&rData.length>0) {
        const mapped = rData.map(r=>({
          id:r.id, name:r.name, cuisine:r.cuisine||"", cuisine2:r.cuisine2||"",
          isFusion:r.is_fusion||false, taste:+r.taste, cost:+r.cost,
          portions:+r.portions, wait:+r.wait, repeatability:+r.repeatability,
          useR:r.use_r!==false, notes:r.notes||"", letter:(r.cuisine?.[0]||"").toUpperCase()
        }));
        dispatch({type:"LOAD", entries:mapped});
      }
      if(cData&&cData.length>0) {
        const mapped = cData.map(c=>({
          id:c.id, name:c.name, category:c.category||"Coffee", order:c.order_item||"",
          taste:+c.taste, cost:+c.cost, portions:+c.portions, wait:+(c.wait||0),
          beanRegion:c.bean_region||"", milkLevel:c.milk_level||"",
          repeatability:+c.repeatability, useR:c.use_r!==false, notes:c.notes||""
        }));
        setCafes(mapped);
      }
      const {data:sData} = await supabase.from("settings").select("*");
      if(sData) {
        const ql = sData.find(s=>s.key==="questLetters");
        if(ql) setQuestL(new Set(JSON.parse(ql.value)));
        const faqOverrides={};
        sData.filter(s=>s.key.startsWith("faq_override_")).forEach(s=>{
          const idx=parseInt(s.key.replace("faq_override_",""));
          faqOverrides[idx]=s.value;
        });
        if(Object.keys(faqOverrides).length>0) setFaqOverrides(faqOverrides);
        const wo={};
        sData.filter(s=>s.key.startsWith("welcome_")).forEach(s=>{wo[s.key.replace("welcome_","")]=s.value;});
        if(Object.keys(wo).length>0) setWelcomeOverride(wo);
      }
      setDbLoaded(true);
      } catch(err) { console.error("Supabase load error:", err); setDbLoaded(true); }
    }
    load();
  },[]);

  function dismissWelcome(){
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
  const [cafeWeights, setCafeWeights] = useState({taste:70,bpb:30});
  const [cafeWErr, setCafeWErr] = useState("");
  const [wErr, setWErr] = useState("");
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

  function rebalance(current, changedKey, newVal) {
    const nv = Math.min(100, Math.max(0, Math.round(newVal)));
    const others = Object.keys(current).filter(k=>k!==changedKey);
    const remaining = 100 - nv;
    const otherSum = others.reduce((a,k)=>a+current[k],0);
    const newW = {...current,[changedKey]:nv};
    if(otherSum===0){
      const each = Math.floor(remaining/others.length);
      others.forEach((k,i)=>newW[k]=i===others.length-1?remaining-each*(others.length-1):each);
    } else {
      others.forEach(k=>newW[k]=Math.max(0,Math.round(current[k]/otherSum*remaining)));
      // fix rounding to ensure exact 100
      const diff=100-Object.values(newW).reduce((a,x)=>a+x,0);
      if(diff!==0) newW[others[0]]+=diff;
    }
    return newW;
  }

  function updW(k,v){
    const newW=rebalance(weights,k,+v);
    setWeights(newW);setWErr("");
  }

  function resetWeights(defaults){ setWeights({...defaults});setWErr(""); }

  function updCafeW(k,v){
    const newW=rebalance(cafeWeights,k,+v);
    setCafeWeights(newW);setCafeWErr("");
  }

  function resetCafeWeights(defaults){ setCafeWeights({...defaults});setCafeWErr(""); }

  const covered = new Set(st.entries.map(e=>(e.letter||e.cuisine?.[0])?.toUpperCase()));
  async function toggleQ(l){
    if(!covered.has(l)||!isAdmin)return;
    const next=new Set(questL);
    next.has(l)?next.delete(l):next.add(l);
    setQuestL(next);
    try { await supabase.from("settings").upsert({key:"questLetters",value:JSON.stringify([...next])},{onConflict:"key"}); } catch(err){ console.error("quest save threw:",err); }
  }

  const loggedC = new Set(st.entries.map(e=>e.cuisine&&e.cuisine.trim()));
  const totalCuisines = Object.values(CUISINE_REGIONS).flat().length;
  const doneCount = Object.values(CUISINE_REGIONS).flat().filter(x=>loggedC.has(x)).length;
  const totalW = +(weights.taste+weights.bpb+weights.wait).toFixed(0);

  const sortedR = [...st.entries].sort((a,b)=>{
    let d=0;
    // For each field, d>0 means a should come FIRST in descending (default ↓) order
    // i.e. d = "a is better than b"
    if(sortBy==="bite") d=(calcBite(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,weights)??0)-(calcBite(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,weights)??0);
    else if(sortBy==="taste") d=a.taste-b.taste;
    else if(sortBy==="bpb") d=(b.cost/b.portions)-(a.cost/a.portions); // lower cost = better
    else if(sortBy==="wait") d=b.wait-a.wait; // lower wait = better
    else if(sortBy==="repeat") d=a.repeatability-b.repeatability;
    // sortAsc=false (↓) = best first (d descending), sortAsc=true (↑) = worst first
    return sortAsc?d:-d;
  });

  const allCities = [...new Set(sortedR.map(e=>e.city||"NYC"))].sort();
  const filtered = sortedR.filter(e=>{
    if(tiers.size>0&&!tiers.has(scoreLabel(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights),T.en)))return false;
    if(cityFilter&&(e.city||"NYC")!==cityFilter)return false;
    if(search.trim()){const q=search.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.cuisine.toLowerCase().includes(q)||(e.city||'NYC').toLowerCase().includes(q)||(e.notes&&e.notes.toLowerCase().includes(q));}
    return true;
  });

  const DRINK_CATS = ["Coffee","Tea","Other"];
  const sortedDrinks = [...cafes].filter(e=>DRINK_CATS.includes(e.category)).sort((a,b)=>{
    let d=0;
    if(cafeSortBy==="bite") d=(calcCafe(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability)??0)-(calcCafe(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability)??0);
    else if(cafeSortBy==="taste") d=b.taste-a.taste;
    else if(cafeSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
    else if(cafeSortBy==="wait") d=a.wait-b.wait;
    else if(cafeSortBy==="repeat") d=b.repeatability-a.repeatability;
    return cafeSortAsc?-d:d;
  }).filter(e=>{
    if(cafeFilterMilk&&e.milkLevel!==cafeFilterMilk)return false;
    if(cafeFilterBean&&e.beanRegion!==cafeFilterBean)return false;
    if(cafeSearch.trim()){const q=cafeSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q);}
    return true;
  });

  const sortedSweets = [...cafes].filter(e=>e.category==="Sweets").sort((a,b)=>{
    let d=0;
    if(sweetsSortBy==="bite") d=(calcCafe(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability)??0)-(calcCafe(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability)??0);
    else if(sweetsSortBy==="taste") d=b.taste-a.taste;
    else if(sweetsSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
    else if(sweetsSortBy==="wait") d=a.wait-b.wait;
    else if(sweetsSortBy==="repeat") d=b.repeatability-a.repeatability;
    return sweetsSortAsc?-d:d;
  }).filter(e=>{
    if(sweetsSearch.trim()){const q=sweetsSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q);}
    return true;
  });

  const TIERS=[["Elite","#97C459"],["Great","#97C459"],["Good","#5B9BD5"],["Decent","#EF9F27"],["Don't bother","#A32D2D"]];
  const tabSt = (on) => ({padding:"7px 18px",borderRadius:20,border:"1.5px solid "+(on?"#F0997B":"rgba(255,255,255,0.1)"),background:on?"#3C1F13":"transparent",color:on?"#F0997B":"#888780",fontSize:13,fontWeight:on?500:400,cursor:"pointer"});

  function getDisplay(e) {
    if(sortBy==="taste"){const tv=e.taste,lbl=tasteLabel(tv,t),col=tv<=2?"#A32D2D":tv<=4?"#888780":tv<=7?"#EF9F27":tv<=8.5?"#5B9BD5":"#97C459";return{val:tv.toFixed(1),label:lbl,color:col};}
    if(sortBy==="bpb") return{val:"$"+(e.cost/e.portions).toFixed(2),label:t.perPortion,color:"#5B9BD5"};
    if(sortBy==="wait") return{val:e.wait+" min",label:t.waitLabel,color:"#888780"};
    if(sortBy==="repeat") return{val:e.useR?("⭐".repeat(e.repeatability)||"✕"):t.off,label:e.useR?(e.repeatability===3?t.mustReturnLabel:e.repeatability===2?t.wouldSeekOutLabel:e.repeatability===1?t.ifOccasionCallsLabel:t.wouldntReturnLabel):"off",color:"#EF9F27"};
    const sc=calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights);
    return{val:sc!=null?sc.toFixed(2):"—",label:scoreLabel(sc,t),color:scoreColor(sc)};
  }

  return (
    <LangContext.Provider value={{t,lang,toggleLang}}>
    <div style={{fontFamily:"var(--font-sans)",maxWidth:640,margin:"0 auto",padding:"1.25rem 1rem 8rem 1rem",background:"#141413",minHeight:"100vh",color:"#F1EFE8",overflowX:"hidden"}}>
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
          <LogoWithTripleTap onTripleTap={()=>{
            if(!isAdmin){const pw=prompt("Password:");if(pw==="nomnomNOM")setIsAdmin(true);}
            else setIsAdmin(false);
          }} isAdmin={isAdmin}/>
          <div>
            <h1 style={{fontSize:28,fontWeight:600,color:isAdmin?"#97C459":"#F0997B",margin:0,fontFamily:"'Fredoka',sans-serif",transition:"color 0.3s"}}>{lang==="zh"?"BITE Score 吃貨榜":"BITE Score"}</h1>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isAdmin&&<button onClick={()=>{setWelcomeEditVal({title:welcomeOverride[lang+"_title"]||t.welcome1,body:welcomeOverride[lang+"_body"]||t.welcome2});setEditingWelcome(true);}} style={{fontSize:10,color:"#888780",background:"none",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:4,padding:"3px 8px",cursor:"pointer"}}>Edit welcome</button>}
          <button onClick={toggleLang} style={{fontSize:11,fontWeight:500,padding:"5px 12px",borderRadius:20,border:"1.5px solid rgba(255,255,255,0.2)",background:"transparent",color:"#888780",cursor:"pointer",letterSpacing:"0.03em",flexShrink:0}}>{lang==="en"?"繁中":"EN"}</button>
        </div>
      </div>

      {((showWelcome&&!isAdmin&&dbLoaded)||isAdmin&&editingWelcome)&&(
        <div onClick={()=>{if(!isAdmin)dismissWelcome();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1E1E1C",borderRadius:16,padding:"1.5rem",maxWidth:360,width:"100%",border:"0.5px solid rgba(255,255,255,0.15)"}}>
            <div style={{fontSize:24,marginBottom:12,textAlign:"center",cursor:"default",userSelect:"none"}} onClick={()=>{
              const now=Date.now();
              waveTaps.current=[...waveTaps.current.filter(t=>now-t<800),now];
              if(waveTaps.current.length>=3){waveTaps.current=[];const pw=prompt("Password:");if(pw==="nomnomNOM"){setIsAdmin(true);dismissWelcome();}}
            }}>👋</div>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:16}}>
              {["en","zh"].map(l=>(
                <button key={l} onClick={()=>{
                  setLang(l);localStorage.setItem("bite_lang",l);
                  if(editingWelcome){
                    const T_other = l === "en" ? T.en : T.zh;
                    setWelcomeEditVal({title:welcomeOverride[l+"_title"]||T_other.welcome1,body:welcomeOverride[l+"_body"]||T_other.welcome2});
                  }
                }} style={{padding:"5px 16px",borderRadius:20,border:"1.5px solid "+(lang===l?"#F0997B":"rgba(255,255,255,0.2)"),background:lang===l?"#3C1F13":"transparent",color:lang===l?"#F0997B":"#888780",fontSize:12,fontWeight:lang===l?500:400,cursor:"pointer"}}>
                  {l==="en"?"English":"繁體中文"}
                </button>
              ))}
            </div>
            {isAdmin&&editingWelcome?(
              <div>
                <div style={{fontSize:11,color:"#888780",marginBottom:6}}>Title ({lang})</div>
                <input value={welcomeEditVal.title||""} onChange={e=>setWelcomeEditVal(p=>({...p,title:e.target.value}))} style={{width:"100%",boxSizing:"border-box",marginBottom:10,fontSize:13}}/>
                <div style={{fontSize:11,color:"#888780",marginBottom:6}}>Body ({lang})</div>
                <textarea value={welcomeEditVal.body||""} onChange={e=>setWelcomeEditVal(p=>({...p,body:e.target.value}))} rows={6} style={{width:"100%",boxSizing:"border-box",fontSize:13,lineHeight:1.6,resize:"vertical",marginBottom:12}}/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={async()=>{
                    const next={...welcomeOverride,[lang+"_title"]:welcomeEditVal.title,[lang+"_body"]:welcomeEditVal.body};
                    setWelcomeOverride(next);
                    setEditingWelcome(false);
                    try {
                      await supabase.from("settings").upsert({key:"welcome_"+lang+"_title",value:welcomeEditVal.title},{onConflict:"key"});
                      await supabase.from("settings").upsert({key:"welcome_"+lang+"_body",value:welcomeEditVal.body},{onConflict:"key"});
                    } catch(err){console.error("welcome save threw:",err);}
                  }} style={{flex:2,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:14,fontWeight:500,cursor:"pointer"}}>Save</button>
                  <button onClick={async()=>{
                    const next={...welcomeOverride};delete next[lang+"_title"];delete next[lang+"_body"];
                    setWelcomeOverride(next);setEditingWelcome(false);
                    try{await supabase.from("settings").delete().in("key",["welcome_"+lang+"_title","welcome_"+lang+"_body"]);}catch(err){}
                  }} style={{flex:1,padding:"10px",background:"transparent",color:"#A32D2D",border:"0.5px solid #A32D2D",borderRadius:8,fontSize:12,cursor:"pointer"}}>Reset</button>
                  <button onClick={()=>setEditingWelcome(false)} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:14,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16}}>
                  <p style={{fontSize:16,fontWeight:600,color:"#F1EFE8",margin:0,lineHeight:1.5,textAlign:"center"}}>{welcomeOverride[lang+"_title"]||t.welcome1}</p>
                  <InfoBubble content={welcomeOverride[lang+"_body"]?.split("\n\n")[0]||t.welcome2.split("\n\n")[0]}/>
                </div>

                {isAdmin?(
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={()=>{setWelcomeEditVal({title:welcomeOverride[lang+"_title"]||t.welcome1,body:welcomeOverride[lang+"_body"]||t.welcome2});setEditingWelcome(true);}} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:8,fontSize:13,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>setEditingWelcome(false)} style={{flex:1,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer"}}>Done</button>
                  </div>
                ):(
                  <div>
                    <div style={{borderTop:"0.5px solid rgba(255,255,255,0.08)",paddingTop:14,marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <span style={{fontSize:11,color:"#888780",fontStyle:"italic"}}>{t.howMuchCare}</span>
                        <button onClick={()=>resetWeights({taste:50,bpb:40,wait:10})} style={{fontSize:10,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline"}}>Reset</button>
                      </div>
                      {[[t.taste,"taste","#F0997B"],[t.bangBuck,"bpb","#5B9BD5"],[t.wait,"wait","#97C459"]].map(([label,key,color])=>(
                        <div key={key} style={{marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <span style={{fontSize:11,color:"#888780"}}>{label}</span>
                            <span style={{fontSize:11,fontWeight:500,color:color}}>{weights[key]}%</span>
                          </div>
                          <input type="range" min="0" max="100" step="1" value={weights[key]}
                            onChange={e=>updW(key,+e.target.value)}
                            style={{width:"100%",accentColor:color}}/>
                        </div>
                      ))}
                    </div>
                    {(welcomeOverride[lang+"_body"]||t.welcome2).split("\n\n").slice(1).map((para,i)=>(
                      <p key={i} style={{fontSize:13,color:"#888780",margin:"0 0 12px",lineHeight:1.7,textAlign:"center",whiteSpace:"pre-line"}}>{para}</p>
                    ))}
                    <div style={{fontSize:10,color:"#888780",textAlign:"right",marginBottom:10}}>Max score at these weights: <span style={{color:"#F0997B",fontWeight:500}}>{calcMaxBite(weights).toFixed(1)}</span></div>
                    <button onClick={dismissWelcome} style={{width:"100%",padding:"12px",background:"#F0997B",color:"#141413",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer"}}>{t.welcomeBtn}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:640,background:"#1A1A18",borderTop:"0.5px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-around",alignItems:"center",padding:"8px 0 max(8px,env(safe-area-inset-bottom))",zIndex:100}}>
        {[["log","📋",t.myLog],["palette","😋",t.myTaste],["add","➕",t.add],["quests","🗺️",t.quests],["faq","❓",t.faq]].map(([v,icon,label])=>(
          <button key={v} onClick={()=>{dispatch({type:"VIEW",view:v});setEditR(null);setEditC(null);window.scrollTo({top:0,behavior:"instant"});}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 8px",minWidth:56}}>
            {v==="add"?(
              <div style={{width:44,height:44,borderRadius:"50%",background:"#F0997B",border:"2px solid #F0997B",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-8,marginBottom:2}}>
                <span style={{fontSize:22,lineHeight:1,color:"#141413"}}>➕</span>
              </div>
            ):(
              <span style={{fontSize:20,lineHeight:1}}>{icon}</span>
            )}
            <span style={{fontSize:10,color:st.view===v?"#F0997B":"#888780",fontWeight:st.view===v?500:400,transition:"color 0.15s"}}>{label}</span>
            {st.view===v&&v!=="add"&&<div style={{width:4,height:4,borderRadius:"50%",background:"#F0997B",marginTop:1}}/>}
          </button>
        ))}
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
            <div style={{display:"flex",background:"#252523",borderRadius:10,padding:3,gap:2,marginBottom:isAdmin?8:0}}>
              {[["restaurants","🍽 "+t.restaurants],["drinks","☕ "+t.drinks],["sweets","🥐 "+t.sweets]].map(([v,l])=>(
                <button key={v} onClick={()=>setLogTab(v)} style={{flex:1,padding:"6px 0",textAlign:"center",borderRadius:8,border:"none",background:logTab===v?"#3C1F13":"transparent",color:logTab===v?"#F0997B":"#888780",fontSize:11,fontWeight:logTab===v?700:500,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
              ))}
            </div>
            {isAdmin&&<p style={{fontSize:12,color:"#888780",margin:0}}>{t.swipeHint}</p>}
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
                        {TIERS.map(([tier,col])=>{
                          const on=tiers.has(tier);
                          const cnt=sortedR.filter(e=>scoreLabel(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights),T.en)===tier).length;
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
                  const avgBite=grp.reduce((a,e)=>a+(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights)??0),0)/grp.length;
                  const avgTaste=grp.reduce((a,e)=>a+e.taste,0)/grp.length;
                  const avgBpb=grp.reduce((a,e)=>a+(e.cost/e.portions),0)/grp.length;
                  const avgWait=grp.reduce((a,e)=>a+e.wait,0)/grp.length;
                  const avgRepeat=grp.reduce((a,e)=>a+e.repeatability,0)/grp.length;
                  // sortVal: higher = better (for descending = best first)
                  const visits=grp.length;
                  const sortVal=sortBy==="taste"?avgTaste:sortBy==="bpb"?-avgBpb:sortBy==="wait"?-avgWait:sortBy==="repeat"?avgRepeat+(visits*0.001):avgBite;
                  return {grp, e, sortVal};
                }).sort((a,b)=>sortAsc?a.sortVal-b.sortVal:b.sortVal-a.sortVal);
                return groupArr.map(({grp,e},i)=>{
                  const visits=grp.length;
                  const display=getDisplay(e);
                  return (
                    <RestRow key={e.id} e={e} i={i} display={display} isAdmin={isAdmin} visits={visits} group={grp} weights={weights}
                      onEdit={v=>{setEditR(v||e);window.scrollTo({top:0,behavior:"smooth"});}}
                      onDelete={async id=>{ const did=id||e.id; if(isAdmin) { try { await supabase.from("restaurants").delete().eq("id",did); } catch(err){ console.error("restaurant delete threw:",err); } } dispatch({type:"DEL",id:did}); }}/>
                  );
                });
              })()}
              {sortedR.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedR.length)],[t.avgBite,(sortedR.reduce((a,e)=>a+(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights)??0),0)/sortedR.length).toFixed(2)]].map(([l,v])=>(
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
                            {["Africa","Central America","South America","Asia-Pacific","Blend"].map(b=>(
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
                  return avg(e=>calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0);
                };
                return Object.entries(groups).sort((a,b)=>cafeSortAsc?getSortVal(a[1])-getSortVal(b[1]):getSortVal(b[1])-getSortVal(a[1])).map(([name,grp])=>(
                  <CafeGroupRow key={name} group={grp} cafeSortBy={cafeSortBy} isAdmin={isAdmin} onEdit={e=>{setEditC(e);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={async id=>{ if(isAdmin) { try { await supabase.from("cafes").delete().eq("id",id); } catch(err){ console.error("cafe delete threw:",err); } } setCafes(p=>p.filter(x=>x.id!==id)); }}/>
                ));
              })()}
              {sortedDrinks.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedDrinks.length)],[t.avgBite,(sortedDrinks.reduce((a,e)=>a+(calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0),0)/sortedDrinks.length).toFixed(2)]].map(([l,v])=>(
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
                  return avg(e=>calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0);
                };
                return Object.entries(groups).sort((a,b)=>sweetsSortAsc?getSortValS(a[1])-getSortValS(b[1]):getSortValS(b[1])-getSortValS(a[1])).map(([name,grp])=>(
                  <CafeGroupRow key={name} group={grp} cafeSortBy={sweetsSortBy} isAdmin={isAdmin} onEdit={e=>{setEditC(e);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={async id=>{ if(isAdmin) { try { await supabase.from("cafes").delete().eq("id",id); } catch(err){ console.error("cafe delete threw:",err); } } setCafes(p=>p.filter(x=>x.id!==id)); }}/>
                ));
              })()}
              {sortedSweets.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedSweets.length)],[t.avgBite,(sortedSweets.reduce((a,e)=>a+(calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0),0)/sortedSweets.length).toFixed(2)]].map(([l,v])=>(
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

      {st.view==="log"&&editR&&<RestForm initial={editR} weights={weights} existingNames={st.entries.map(e=>e.name)} existingEntries={st.entries} onSave={async e=>{
        console.log("restaurant save — isAdmin:", isAdmin, "id:", e.id);
        if(isAdmin) {
          try {
            const {error} = await supabase.from("restaurants").update({
              name:e.name, cuisine:e.cuisine, cuisine2:e.cuisine2||"",
              is_fusion:e.isFusion||false, taste:e.taste, cost:e.cost,
              portions:e.portions, wait:e.wait, repeatability:e.repeatability,
              use_r:e.useR, notes:e.notes||""
            }).eq("id",e.id);
            if(error) console.error("restaurant update error:", error);
          } catch(err) { console.error("restaurant update threw:", err); }
        }
        dispatch({type:"UPD",e}); setEditR(null);
      }} onCancel={()=>{setEditR(null);window.scrollTo({top:0,behavior:"smooth"});}}/>}
      {st.view==="log"&&editC&&<CafeForm initial={editC} onSave={async entries=>{
        const e=Array.isArray(entries)?entries[0]:entries;
        console.log("cafe save — isAdmin:", isAdmin, "id:", e.id, "type:", typeof e.id);
        if(isAdmin) {
          try {
            const {error} = await supabase.from("cafes").update({
              name:e.name, category:e.category, order_item:e.order||"",
              taste:e.taste, cost:e.cost, portions:e.portions, wait:e.wait||0,
              bean_region:e.beanRegion||"", milk_level:e.milkLevel||"",
              repeatability:e.repeatability, use_r:e.useR, notes:e.notes||""
            }).eq("id",e.id);
            if(error) console.error("cafe update error:", error, "id:", e.id);
          } catch(err) { console.error("cafe update threw:", err); }
        }
        setCafes(p=>p.map(x=>x.id===e.id?{...e,id:x.id}:x)); setEditC(null);
      }} onCancel={()=>{setEditC(null);window.scrollTo({top:0,behavior:"smooth"});}} existingNames={cafes.map(e=>e.name)} existingCafes={cafes} pastOrders={cafes.map(e=>e.order).filter(Boolean)}/>}

      {/* ── Add Rating ── */}
      {st.view==="add"&&(
        <div>
          {addType==="restaurant"
            ?<RestForm initial={{...INIT_REST,city:lastCity.current}} weights={weights} existingNames={st.entries.map(e=>e.name)} existingEntries={st.entries}
                onSave={async e=>{
                  if(isAdmin) {
                    try {
                      const {data,error} = await supabase.from("restaurants").insert([{
                        name:e.name, cuisine:e.cuisine, cuisine2:e.cuisine2||"",
                        is_fusion:e.isFusion||false, taste:e.taste, cost:e.cost,
                        portions:e.portions, wait:e.wait, repeatability:e.repeatability,
                        use_r:e.useR, notes:e.notes||"", letter:(e.cuisine?.[0]||"").toUpperCase()
                      }]).select().single();
                      if(error) console.error("restaurant insert error:",error);
                      dispatch({type:"ADD",e:{...e,id:data?.id||Date.now()}});
                    } catch(err) { console.error("restaurant insert threw:",err); dispatch({type:"ADD",e:{...e,id:Date.now()}}); }
                  } else {
                    if(e.city)lastCity.current=e.city;
                    dispatch({type:"ADD",e:{...e,id:Date.now()}});
                  }
                }}
                onCancel={()=>dispatch({type:"VIEW",view:"log"})}
                addType={addType} setAddType={setAddType}
              />
            :<CafeForm initial={INIT_CAFE}
                onSave={async entries=>{
                  const arr=Array.isArray(entries)?entries:[entries];
                  if(isAdmin) {
                    try {
                      const rows = arr.map(e=>({
                        name:e.name, category:e.category, order_item:e.order||"",
                        taste:e.taste, cost:e.cost, portions:e.portions, wait:e.wait||0,
                        bean_region:e.beanRegion||"", milk_level:e.milkLevel||"",
                        repeatability:e.repeatability, use_r:e.useR, notes:e.notes||""
                      }));
                      const {data,error} = await supabase.from("cafes").insert(rows).select();
                      if(error) console.error("cafe insert error:",error);
                      setCafes(p=>[...p,...(data?data.map((c,i)=>({...arr[i],id:c.id})):arr.map(e=>({...e,id:Date.now()+Math.random()})))]);
                    } catch(err) { console.error("cafe insert threw:",err); setCafes(p=>[...p,...arr.map(e=>({...e,id:Date.now()+Math.random()}))]); }
                  } else {
                    setCafes(p=>[...p,...arr.map(e=>({...e,id:Date.now()+Math.random()}))]);
                  }
                  dispatch({type:"VIEW",view:"log"});
                  setLogTab(arr.some(e=>e.category==="Sweets")?"sweets":"drinks");
                }}
                onCancel={()=>dispatch({type:"VIEW",view:"log"})}
                addType={addType} setAddType={setAddType}
                existingNames={cafes.map(e=>e.name)}
                existingCafes={cafes}
                pastOrders={cafes.map(e=>e.order).filter(Boolean)}
              />
          }
        </div>
      )}

      {/* ── Quests ── */}
      {st.view==="quests"&&(
        <div>
          <div style={{marginBottom:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
              <span style={{fontSize:16,fontWeight:500,color:"#F1EFE8"}}>{t.aZQuest}</span>
              <span style={{fontSize:18,fontWeight:500,color:"#97C459"}}>{questL.size}<span style={{fontSize:13,fontWeight:400,color:"#888780"}}> / 26</span></span>
            </div>
            <p style={{fontSize:11,color:"#888780",margin:"0 0 10px"}}>{t.tapToToggle}</p>
            <div style={{background:"#0D0D0C",borderRadius:8,height:6,marginBottom:16,overflow:"hidden"}}>
              <div style={{height:"100%",width:((questL.size/26)*100)+"%",background:"#97C459",borderRadius:8,transition:"width 0.4s"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(36px,1fr))",gap:6}}>
              {ALPHABET.map(l=>{
                const isQ=questL.has(l),isL=covered.has(l);
                const entry=st.entries.find(e=>(e.letter||e.cuisine?.[0])?.toUpperCase()===l);
                return(
                  <div key={l} title={entry?entry.name:l} onClick={()=>toggleQ(l)}
                    style={{height:36,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,cursor:isL?"pointer":"default",transition:"all 0.15s",background:isQ?"#1A2E0A":isL?"#3C1F13":"#1E1E1C",color:isQ?"#97C459":isL?"#F0997B":"#888780",border:"0.5px solid "+(isQ?"#97C459":isL?"#D85A30":"rgba(255,255,255,0.1)")}}>
                    {l}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:16,marginTop:12}}>
              {[[t.questLegendQuest,"#97C459","#1A2E0A"],[t.questLegendLogged,"#F0997B","#3C1F13"],[t.questLegendNotYet,"#888780","#1E1E1C"]].map(([label,col,bg])=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:12,height:12,borderRadius:3,background:bg,border:"0.5px solid "+col}}/>
                  <span style={S.sm}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{borderTop:"0.5px solid rgba(255,255,255,0.1)",marginBottom:32}}/>

          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:16,fontWeight:500,color:"#F1EFE8"}}>{t.cuisineQuest}</span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18,fontWeight:500,color:"#F0997B"}}>{doneCount}<span style={{fontSize:13,fontWeight:400,color:"#888780"}}> / {totalCuisines}</span></span>
                <button onClick={()=>dispatch({type:"VIEW",view:"suggest"})} style={{fontSize:11,color:"#F0997B",background:"#3C1F13",border:"0.5px solid "+"#F0997B",borderRadius:20,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap"}}>{t.suggestRestaurant}</button>
              </div>
            </div>
            <div style={{background:"#0D0D0C",borderRadius:8,height:6,marginBottom:20,overflow:"hidden"}}>
              <div style={{height:"100%",width:((doneCount/totalCuisines)*100)+"%",background:"#F0997B",borderRadius:8,transition:"width 0.4s"}}/>
            </div>
            {Object.entries(CUISINE_REGIONS).map(([region,cuisines])=>{
              const rd=cuisines.filter(x=>loggedC.has(x)).length,pct=Math.round((rd/cuisines.length)*100);
              return(
                <div key={region} style={{marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                    <span style={S.val}>{region}</span>
                    <span style={{fontSize:12,color:rd===cuisines.length?"#97C459":"#888780"}}>{rd}/{cuisines.length}</span>
                  </div>
                  <div style={{background:"#0D0D0C",borderRadius:6,height:5,marginBottom:8,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:rd===cuisines.length?"#97C459":"#F0997B",borderRadius:6,transition:"width 0.4s"}}/>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {cuisines.map(x=>{
                      const done=loggedC.has(x);
                      const names=st.entries.filter(e=>e.cuisine&&e.cuisine.trim()===x).map(e=>e.name).join("; ");
                      return(
                        <Tooltip key={x} content={done?names:null}>
                          <span style={{fontSize:11,padding:"3px 8px",borderRadius:12,background:done?"#3C1F13":"#1E1E1C",color:done?"#F0997B":"#888780",border:"0.5px solid "+(done?"#F0997B":"rgba(255,255,255,0.1)"),fontWeight:done?500:400}}>
                            {FLAGS[x]?FLAGS[x]+" ":""}{x}
                          </span>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {st.view==="suggest"&&<SuggestView entries={st.entries} onBack={()=>dispatch({type:"VIEW",view:"quests"})}/>}
      {st.view==="palette"&&<PaletteView entries={st.entries} cafes={cafes} weights={weights} updateWeight={updW} resetWeights={resetWeights} totalW={totalW} weightError={wErr} cafeWeights={cafeWeights} updateCafeW={updCafeW} resetCafeWeights={resetCafeWeights} cafeTotalW={+(cafeWeights.taste+cafeWeights.bpb).toFixed(0)} cafeWErr={cafeWErr}/>}

      {/* ── FAQ ── */}
      {st.view==="faq"&&<FaqView isAdmin={isAdmin} faqOverrides={faqOverrides} setFaqOverrides={setFaqOverrides}/>}
    </div>
    </LangContext.Provider>
  );
}
