import { useEffect, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { FLAGS, REGION_MAP, CUISINE_REGIONS, REGION_COLORS } from "../constants/cuisineConstants.js";
import { calcBiteOutOf10, meanRestaurantBiteOutOf10 } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { DonutChart } from "./DonutChart.jsx";
import { DrinksPalette } from "./DrinksPalette.jsx";
import { SweetsPalette } from "./SweetsPalette.jsx";
import { WeightSliders } from "./WeightSliders.jsx";
import { StatCard } from "./StatCard.jsx";
import { CuisineQuestModal } from "./CuisineQuestModal.jsx";
import { getQuestMetrics } from "../utils/questMetrics.js";
import { getRestaurantPersonality } from "../utils/tastePersonality.js";

const WEIGHT_DEFAULTS = { taste: 50, bpb: 40, wait: 10 };

export function PaletteView({
  entries,
  cafes,
  weights,
  replaceRestaurantWeights,
  drinkWeights,
  replaceDrinkWeights,
  sweetWeights,
  replaceSweetWeights,
  questL,
  toggleQ,
  onOpenSuggest,
}) {
  const {t} = useLang();
  const [paletteTab,setPaletteTab] = useState("restaurants");
  const [editingW,setEditingW] = useState(false);
  const [draftW,setDraftW] = useState(()=>({...weights}));
  const [roastMode,setRoastMode] = useState(false);
  const [questSheetOpen,setQuestSheetOpen] = useState(false);

  useEffect(()=>{
    if(!editingW)setDraftW({...weights});
  },[weights,editingW]);
  const total = entries.length;

  const rg={};
  entries.forEach(e=>{const r=REGION_MAP[e.cuisine]||"Other";rg[r]=(rg[r]||0)+1;});
  const sorted=Object.entries(rg).sort((a,b)=>b[1]-a[1]);
  const rows=[...sorted.slice(0,5),["Other",sorted.slice(5).reduce((a,[,n])=>a+n,0)]];
  const slices=rows.map(([region,count])=>({region,count,color:region==="Other"?"#888780":(REGION_COLORS[region]||"#888780")}));

  const rCount=sorted.length;
  const cc={};entries.forEach(e=>{cc[e.cuisine]=(cc[e.cuisine]||0)+1;});
  const topC=Object.entries(cc).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
  const restaurantWeightsSum = weights.taste + weights.bpb + weights.wait;
  const weightsOk = restaurantWeightsSum === 100;
  const draftSum = draftW.taste + draftW.bpb + draftW.wait;
  const draftOk = draftSum === 100;

  function draftUpd(k,v){
    const nv = Math.round(Math.min(100,Math.max(0,+v)));
    setDraftW(w=>({...w,[k]:nv}));
  }
  function saveRestaurantWeights(){
    if(!draftOk)return;
    replaceRestaurantWeights(draftW);
    setEditingW(false);
  }
  const avgT=total?(entries.reduce((a,e)=>a+e.taste,0)/total).toFixed(1):"0";
  const avgC=total?(entries.reduce((a,e)=>a+e.cost,0)/total).toFixed(0):"0";
  const groupedEntries = Object.values(entries.reduce((acc,e)=>{if(!acc[e.name])acc[e.name]=[];acc[e.name].push(e);return acc;},{}));
  const topB = groupedEntries.map(grp=>({name:grp[0].name,avg:grp.reduce((a,e)=>a+(calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights)??0),0)/grp.length})).sort((a,b)=>b.avg-a.avg)[0];

  const personality = getRestaurantPersonality(entries, weights);

  const btnGhost = {fontSize:11,color:"#5B9BD5",background:"none",border:"1px solid rgba(91,155,213,0.45)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:500};
  /** Hide personality / breakdown / stats only when there are no entries or committed weights don’t sum to 100 — not while editing draft (so the page doesn’t “disappear”). */
  const showRestaurantBody = total>0&&weightsOk;
  const questMetrics = getQuestMetrics(entries, questL);
  const summaryRight = t.questSummaryRight
    .replace("{done}", String(questMetrics.doneCount))
    .replace("{total}", String(questMetrics.totalCuisines))
    .replace("{letters}", String(questMetrics.letterQuestSize));
  const summaryBarPct = Math.min(100, Math.round(questMetrics.combinedProgress * 100));

  return (
    <div>
      <div style={{display:"flex",background:"#252523",borderRadius:10,padding:3,gap:2,marginBottom:20}}>
        {[["restaurants","🍽 "+t.restaurants],["drinks","☕ "+t.drinks],["sweets","🥐 "+t.sweets]].map(([v,l])=>(
          <button key={v} onClick={()=>setPaletteTab(v)} style={{flex:1,padding:"6px 0",textAlign:"center",borderRadius:8,border:"none",background:paletteTab===v?"#3C1F13":"transparent",color:paletteTab===v?"#F0997B":"#888780",fontSize:11,fontWeight:paletteTab===v?500:400,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
        ))}
      </div>

      {paletteTab==="restaurants"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{...S.card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{...S.lbl,marginBottom:0}}>{t.weights}</div>
              {!editingW?(
                <button type="button" onClick={()=>{setDraftW({...weights});setEditingW(true);}} style={btnGhost}>{t.editWeights}</button>
              ):(
                <button type="button" onClick={()=>setEditingW(false)} style={{...btnGhost,color:"#888780",borderColor:"rgba(255,255,255,0.15)"}}>{t.cancel}</button>
              )}
            </div>
            {editingW?(
              <>
                <WeightSliders weights={draftW} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"],[t.wait,"wait"]]} onUpdate={draftUpd} onReset={()=>setDraftW({...WEIGHT_DEFAULTS})} defaults={WEIGHT_DEFAULTS}/>
                <div style={{fontSize:11,color:draftOk?"#97C459":"#EF9F27",textAlign:"center",marginTop:8}}>
                  {t.weightsTotal}: {draftSum}/100
                </div>
                {!draftOk&&(
                  <div style={{fontSize:10,color:"#F1EFE8",textAlign:"center",marginTop:4}}>{t.weightsSumTo100}</div>
                )}
                <button type="button" disabled={!draftOk} onClick={saveRestaurantWeights} style={{width:"100%",marginTop:10,padding:"10px",borderRadius:8,border:"none",fontSize:14,fontWeight:500,cursor:draftOk?"pointer":"not-allowed",background:draftOk?"#F0997B":"#5A4A43",color:draftOk?"#141413":"#AFA8A3",opacity:draftOk?1:0.85}}>{t.weightsSave}</button>
              </>
            ):(
              <>
                <p style={{fontSize:13,color:"#F1EFE8",margin:0,lineHeight:1.5}}>
                  {t.taste} <span style={{fontWeight:600,color:"#F0997B"}}>{weights.taste}%</span>
                  {" · "}{t.bangBuck} <span style={{fontWeight:600,color:"#5B9BD5"}}>{weights.bpb}%</span>
                  {" · "}{t.wait} <span style={{fontWeight:600,color:"#97C459"}}>{weights.wait}%</span>
                </p>
                {!weightsOk&&(
                  <div style={{fontSize:10,color:"#F1EFE8",textAlign:"center",marginTop:8}}>{t.weightsSumTo100}</div>
                )}
              </>
            )}
          </div>
          {!total?<p style={{color:"#888780",fontSize:14}}>{t.noEntriesYet}</p>:showRestaurantBody&&<>
          <div style={{...S.card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{...S.lbl,marginBottom:0}}>{t.tastePalette}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div onClick={()=>setRoastMode(r=>!r)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",background:roastMode?"#2A1E05":"#1A2E0A",border:"1px solid "+(roastMode?"#EF9F27":"#97C459"),borderRadius:20,padding:"4px 10px"}}>
                  <span style={{fontSize:11,color:roastMode?"#EF9F27":"#97C459",fontWeight:500}}>{roastMode?t.roastMe:t.prVersion}</span>
                </div>

              </div>
            </div>

            {personality.hasEnoughData ? (
              <>
                <p style={{fontSize:13,color:"#F0997B",margin:"0 0 4px",lineHeight:1.4,fontWeight:600,letterSpacing:"0.01em"}}>
                  {roastMode?personality.archetype.roastTitle:personality.archetype.title}
                </p>
                <p style={{fontSize:13,color:"#F1EFE8",margin:"0 0 10px",lineHeight:1.65,fontWeight:500}}>
                  {roastMode?personality.archetype.roastBlurb:personality.archetype.blurb}
                </p>
                {personality.bullets.map((b)=>(
                  <p key={b.key} style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>
                    {roastMode?b.roast:b.text}
                  </p>
                ))}
              </>
            ) : (
              <p style={{fontSize:13,color:"#888780",margin:0,lineHeight:1.65,fontStyle:"italic"}}>{t.tastePersonalityLocked}</p>
            )}
          </div>
          <div style={{...S.card}}>
            <div style={{...S.lbl,marginBottom:14}}>{t.cuisineBreakdown}</div>
            <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
              <DonutChart slices={slices} total={total}/>
              <div style={{flex:1,minWidth:140}}>
                {slices.map(s=>{const d=s.count===0;return(
                  <div key={s.region} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{width:8,height:8,borderRadius:2,background:d?"#333330":s.color,flexShrink:0}}/>
                    <span style={{fontSize:12,color:d?"#444441":"#888780",flex:1}}>{s.region}</span>
                    <span style={{fontSize:12,color:d?"#444441":"#F1EFE8",fontWeight:500}}>{s.count}</span>
                    <span style={{fontSize:11,color:d?"#444441":"#888780",width:34,textAlign:"right"}}>{d?"0%":Math.round(s.count/total*100)+"%"}</span>
                  </div>
                );})}
              </div>
            </div>
            <button
              type="button"
              onClick={()=>setQuestSheetOpen(true)}
              style={{
                width:"100%",
                marginTop:14,
                padding:"12px 0 0",
                border:"none",
                borderTop:"0.5px solid rgba(255,255,255,0.1)",
                background:"transparent",
                cursor:"pointer",
                textAlign:"left",
              }}
            >
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                <span style={{fontSize:13,color:"#F1EFE8",fontWeight:500,flexShrink:0}}>{t.cuisineQuestsSection}</span>
                <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1,justifyContent:"flex-end"}}>
                  <span style={{fontSize:12,color:"#97C459",fontWeight:500,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{summaryRight}</span>
                  <span style={{fontSize:15,color:"#97C459",lineHeight:1,flexShrink:0}} aria-hidden>›</span>
                </div>
              </div>
              <div style={{height:3,background:"#252523",borderRadius:2,marginTop:10,overflow:"hidden"}}>
                <div style={{height:"100%",width:summaryBarPct+"%",background:"#97C459",borderRadius:2,transition:"width 0.35s ease"}}/>
              </div>
            </button>
          </div>
          <CuisineQuestModal
            open={questSheetOpen}
            onClose={()=>setQuestSheetOpen(false)}
            entries={entries}
            questL={questL}
            toggleQ={toggleQ}
            onOpenSuggest={onOpenSuggest}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
            {(() => {
              const avgBiteMean = total ? meanRestaurantBiteOutOf10(entries, weights) : null;
              const avgBiteStr = avgBiteMean != null ? `${avgBiteMean.toFixed(2)}/10` : "—";
              const statRows = [
                [t.topCuisine, (FLAGS[topC] || "") + " " + topC],
                [t.topRated, topB ? topB.name : "—"],
                [t.avgBite, avgBiteStr, "avgBite"],
                [t.avgTaste, avgT + "/10"],
                [t.avgSpend, "$" + avgC + " / meal"],
                [t.regionsExplored, rCount + " / " + Object.keys(CUISINE_REGIONS).length],
              ];
              return statRows.map(([label, val, key]) => (
                <StatCard
                  key={label}
                  label={label}
                  val={val}
                  note={key === "avgBite" ? t.avgBitePaletteNote : undefined}
                />
              ));
            })()}
          </div>
          </>}
        </div>
      )}

      {paletteTab==="drinks"&&<DrinksPalette cafes={cafes} drinkWeights={drinkWeights} replaceDrinkWeights={replaceDrinkWeights}/>}
      {paletteTab==="sweets"&&<SweetsPalette cafes={cafes} sweetWeights={sweetWeights} replaceSweetWeights={replaceSweetWeights}/>}
    </div>
  );
}
