import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { ALL_CUISINES, FLAGS, REGION_MAP } from "../constants/cuisineConstants.js";
import { calcBite } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";

export function SuggestView({entries,onBack}) {
  const {t,lang} = useLang();
  const logged = new Set(entries.map(e=>e.cuisine&&e.cuisine.trim()));
  const untried = ALL_CUISINES.filter(x=>!logged.has(x));
  const [pick,setPick] = useState(null);
  const [search,setSearch] = useState("");
  const filt = search.trim().length>0 ? ALL_CUISINES.filter(x=>x.toLowerCase().startsWith(search.toLowerCase())) : [];

  function surprise() {
    if(!untried.length)return;
    setPick(untried[Math.floor(Math.random()*untried.length)]);
    setSearch("");
  }

  return (
    <div>
      <button onClick={onBack} style={{fontSize:12,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:20}}>{t.backToQuests}</button>
      <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"1.5rem",textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:24,marginBottom:8}}>✨</div>
        <div style={{fontSize:15,fontWeight:500,color:"#F1EFE8",marginBottom:6}}>{t.moodFor}</div>
        <div style={{fontSize:13,color:"#888780",marginBottom:16}}>{lang==="zh"?untried.length+t.cuisinesUntried:untried.length+" "+t.cuisinesUntried}</div>
        <button onClick={surprise} style={{padding:"10px 24px",borderRadius:20,background:"#F0997B",color:"#141413",border:"none",fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:16}}>{t.surpriseMe}</button>
        <div style={{fontSize:11,color:"#888780",marginBottom:8}}>{t.orSearch}</div>
        <div style={{position:"relative",maxWidth:260,margin:"0 auto",textAlign:"left"}}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPick(null);}} placeholder={t.searchPlaceholder} style={S.wb}/>
          {filt.length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,zIndex:100,maxHeight:160,overflowY:"auto",marginTop:4}}>
              {filt.map(x=>(
                <div key={x} onMouseDown={()=>{setPick(x);setSearch(x);}} style={{padding:"8px 12px",fontSize:13,color:"#F1EFE8",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#2C2C2A"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {FLAGS[x]?FLAGS[x]+" ":""}{x}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {pick&&(()=>{
        const isLogged = logged.has(pick);
        const myEntries = entries.filter(e=>e.cuisine&&e.cuisine.trim()===pick);
        return (
        <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"1.5rem"}}>
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:40,marginBottom:8}}>{FLAGS[pick]||"🍽️"}</div>
            <div style={{fontSize:11,color:"#F0997B",fontWeight:500,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:4}}>{pick}</div>
            <div style={S.sm}>{REGION_MAP[pick]||"Unknown region"}</div>
            {isLogged&&<div style={{fontSize:11,color:"#97C459",marginTop:6,fontWeight:500}}>✓ {lang==="zh"?"你已去過這個料理":"You've been here before"}</div>}
          </div>
          {isLogged&&myEntries.length>0&&(
            <div style={{marginBottom:12}}>
              {myEntries.map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:"#141413",borderRadius:8,marginBottom:6}}>
                  <span style={{fontSize:13,color:"#F1EFE8",fontWeight:500}}>{e.name}</span>
                  <span style={{fontSize:12,color:"#888780"}}>{"⭐".repeat(e.repeatability)||"✕"} · BITE {(()=>{const s=calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,null);return s!=null?s.toFixed(2):"—";})()}</span>
                </div>
              ))}
            </div>
          )}
          <a href={"https://www.google.com/maps/search/"+encodeURIComponent(pick+" restaurant New York City")} target="_blank" rel="noopener noreferrer"
            style={{display:"block",textAlign:"center",marginTop:12,fontSize:12,color:"#5B9BD5",textDecoration:"none"}}>
            📍 Find on Maps
          </a>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={surprise} style={{flex:1,padding:"9px",borderRadius:8,background:"transparent",border:"0.5px solid rgba(255,255,255,0.1)",color:"#888780",fontSize:13,cursor:"pointer"}}>{t.tryAnother}</button>
            <button onClick={()=>{setPick(null);setSearch("");}} style={{flex:1,padding:"9px",borderRadius:8,background:"#3C1F13",border:"0.5px solid #F0997B",color:"#F0997B",fontSize:13,cursor:"pointer"}}>{t.startOver}</button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
