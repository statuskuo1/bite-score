import { useEffect, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { WeightSliders } from "./WeightSliders.jsx";
import { calcCafeOutOf10, tasteLabel, CAFE_WEIGHT_DEFAULTS } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { BEAN_REGIONS, BEAN_REGION_COLORS, regionOf } from "../constants/coffeeConstants.js";

const btnGhost = {fontSize:11,color:"#5B9BD5",background:"none",border:"1px solid rgba(91,155,213,0.45)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:500};

export function DrinksPalette({cafes,drinkWeights,replaceDrinkWeights}) {
  const {t,lang} = useLang();
  const drinks = cafes.filter(e=>["Coffee","Tea","Other"].includes(e.category));
  const total = drinks.length;
  const [editingW,setEditingW] = useState(false);
  const [draftW,setDraftW] = useState(()=>({...drinkWeights}));
  useEffect(()=>{if(!editingW)setDraftW({...drinkWeights});},[drinkWeights,editingW]);
  const draftSum = draftW.taste + draftW.bpb + draftW.wait;
  const draftOk = draftSum === 100;
  const liveSum = drinkWeights.taste + drinkWeights.bpb + drinkWeights.wait;
  const liveOk = liveSum === 100;
  function draftUpd(k,v){
    const nv = Math.round(Math.min(100,Math.max(0,+v)));
    setDraftW(w=>({...w,[k]:nv}));
  }
  function saveDrinkWeights(){
    if(!draftOk)return;
    replaceDrinkWeights(draftW);
    setEditingW(false);
  }

  const weightsCard = (
    <div style={{...S.card}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{...S.lbl,marginBottom:0}}>{t.weights}</div>
        {!editingW
          ? <button type="button" onClick={()=>{setDraftW({...drinkWeights});setEditingW(true);}} style={btnGhost}>{t.editWeights}</button>
          : <button type="button" onClick={()=>setEditingW(false)} style={{...btnGhost,color:"#888780",borderColor:"rgba(255,255,255,0.15)"}}>{t.cancel}</button>}
      </div>
      {editingW?(
        <>
          <WeightSliders weights={draftW} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"],[t.wait,"wait"]]} onUpdate={draftUpd} onReset={()=>setDraftW({...CAFE_WEIGHT_DEFAULTS})} defaults={CAFE_WEIGHT_DEFAULTS}/>
          <div style={{fontSize:11,color:draftOk?"#97C459":"#EF9F27",textAlign:"center",marginTop:8}}>{t.weightsTotal}: {draftSum}/100</div>
          {!draftOk&&<div style={{fontSize:10,color:"#F1EFE8",textAlign:"center",marginTop:4}}>{t.weightsSumTo100}</div>}
          <button type="button" disabled={!draftOk} onClick={saveDrinkWeights} style={{width:"100%",marginTop:10,padding:"10px",borderRadius:8,border:"none",fontSize:14,fontWeight:500,cursor:draftOk?"pointer":"not-allowed",background:draftOk?"#F0997B":"#5A4A43",color:draftOk?"#141413":"#AFA8A3",opacity:draftOk?1:0.85}}>{t.weightsSave}</button>
        </>
      ):(
        <>
          <p style={{fontSize:13,color:"#F1EFE8",margin:0,lineHeight:1.5}}>
            {t.taste} <span style={{fontWeight:600,color:"#F0997B"}}>{drinkWeights.taste}%</span>
            {" · "}{t.bangBuck} <span style={{fontWeight:600,color:"#5B9BD5"}}>{drinkWeights.bpb}%</span>
            {" · "}{t.wait} <span style={{fontWeight:600,color:"#97C459"}}>{drinkWeights.wait}%</span>
          </p>
          {!liveOk&&<div style={{fontSize:10,color:"#F1EFE8",textAlign:"center",marginTop:8}}>{t.weightsSumTo100}</div>}
        </>
      )}
    </div>
  );

  if(!total) return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {weightsCard}
      <p style={{color:"#888780",fontSize:14}}>{t.noDrinks}</p>
    </div>
  );

  const avgT=(drinks.reduce((a,e)=>a+e.taste,0)/total).toFixed(1);
  const avgC=(drinks.reduce((a,e)=>a+e.cost,0)/total).toFixed(2);

  const orderCounts={};drinks.forEach(e=>{const k=e.order||e.category;orderCounts[k]=(orderCounts[k]||0)+1;});
  const topOrder=Object.entries(orderCounts).sort((a,b)=>b[1]-a[1])[0];
  // Only count entries where milkLevel was actually logged
  const drinksWithMilk=drinks.filter(e=>e.milkLevel&&e.milkLevel.trim()!=="");
  const milkCounts={};drinksWithMilk.forEach(e=>{milkCounts[e.milkLevel]=(milkCounts[e.milkLevel]||0)+1;});
  const milkEntries=Object.entries(milkCounts).sort((a,b)=>b[1]-a[1]);
  const topMilk=milkEntries[0]; // most common logged milk level
  const noneCount=milkCounts["None"]||0; // only actual "None" selections, not blanks
  const beanCounts={};drinks.forEach(e=>{if(e.beanRegion)beanCounts[e.beanRegion]=(beanCounts[e.beanRegion]||0)+1;});
  const beanEntries=Object.entries(beanCounts).sort((a,b)=>b[1]-a[1]);
  const topBean=beanEntries[0];
  const scored=drinks.map(e=>({...e,sc:calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,drinkWeights)})).sort((a,b)=>(b.sc??0)-(a.sc??0));
  const best=scored[0];

  const hasEnoughData = total >= 3;
  const [drinkRoastMode, setDrinkRoastMode] = useState(false);

  // Only derive milk line if enough logged milk data exists
  const hasMilkData = drinksWithMilk.length >= 3;
  const milkMajority = topMilk && topMilk[1] >= 2 ? topMilk[0] : null; // needs at least 2 entries

  // PR lines — only use data we actually have
  const personality=+avgT>=8?"You have high standards in a cup.":+avgT>=7?"You know what good coffee tastes like.":+avgT>=6?"You're still finding your go-to.":"Lorelai Gilmore would be disappointed in your coffee consumption.";
  const milkLine = !hasEnoughData||!hasMilkData ? null
    : milkMajority==="None" ? "You take your drinks black."
    : milkMajority ? "You lean "+milkMajority.toLowerCase()+" milk."
    : null;
  const beanLine = !hasEnoughData ? null : topBean ? "Your beans tend to come from "+topBean[0]+"." : null;
  const notEnoughLine = !hasEnoughData ? (drinkRoastMode ? "Three coffees minimum. I can't read tea leaves out of two espressos and a vibe." : "Lorelai Gilmore would be disappointed in your coffee logging frequency.") : null;

  // Roast lines
  const roastPersonality=+avgT>=8?"Avg taste "+avgT+"/10. You're not a coffee drinker, you're a hostage with Stockholm syndrome and a ceramic mug.":+avgT>=7?"Avg taste "+avgT+"/10. You think you have good taste in coffee — sir, ma'am, you're paying someone seven dollars to boil bean water for you.":+avgT>=6?"Avg taste "+avgT+"/10. You're not drinking coffee, you're performing a 14-step morning sacrament to a bean god who doesn't even know your name.":"Avg taste "+avgT+"/10. The bean has done nothing to deserve this. Switch to tea before someone calls a barista intervention.";
  const roastMilkLine = !hasEnoughData||!hasMilkData ? null
    : milkMajority==="None" ? "You drink it black. Either you've transcended the dairy industrial complex or you're held together with caffeine and unresolved trauma."
    : milkMajority ? "You take "+milkMajority.toLowerCase()+" milk. One pump of vanilla away from being a name baristas know on sight."
    : null;
  const roastBeanLine = !hasEnoughData ? null : topBean ? topBean[0]+" beans, again. At this point you're not loyal, you're geographically obsessed. Buy a plane ticket." : null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {weightsCard}
      <div style={{...S.card}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{...S.lbl,marginBottom:0}}>{t.coffeePersonality}</div>
          <div onClick={()=>setDrinkRoastMode(r=>!r)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",background:drinkRoastMode?"#2A1E05":"#1A2E0A",border:"1px solid "+(drinkRoastMode?"#EF9F27":"#97C459"),borderRadius:20,padding:"4px 10px"}}>
            <span style={{fontSize:11,color:drinkRoastMode?"#EF9F27":"#97C459",fontWeight:500}}>{drinkRoastMode?t.roastMe:t.prVersion}</span>
          </div>
        </div>
        <p style={{fontSize:13,color:"#F1EFE8",margin:"0 0 6px",lineHeight:1.65,fontWeight:500}}>{drinkRoastMode?roastPersonality:personality}</p>
        {(drinkRoastMode?roastMilkLine:milkLine)&&<p style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>{drinkRoastMode?roastMilkLine:milkLine}</p>}
        {(drinkRoastMode?roastBeanLine:beanLine)&&<p style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>{drinkRoastMode?roastBeanLine:beanLine}</p>}
        {topOrder&&hasEnoughData&&<p style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>Your go-to order: <span style={{color:"#F1EFE8",fontWeight:500}}>{topOrder[0]}</span>.</p>}
        {notEnoughLine&&<p style={{fontSize:13,color:"#888780",margin:0,lineHeight:1.65,fontStyle:"italic"}}>{notEnoughLine}</p>}
      </div>

      <div style={{...S.card}}>
        <div style={{...S.lbl,marginBottom:14}}>Bean breakdown</div>
        {(()=>{
          const BEAN_COLORS=BEAN_REGION_COLORS;
          const ALL_BEANS=BEAN_REGIONS;
          const coffeeOnly=drinks.filter(e=>e.category==="Coffee"&&e.beanRegion);
          const coffeeTotal=coffeeOnly.length;
          const bc={};coffeeOnly.forEach(e=>{const r=regionOf(e.beanRegion);bc[r]=(bc[r]||0)+1;});
          const scored2=coffeeOnly.map(e=>({...e,sc:calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,drinkWeights)}));
          const topBeanRegion=Object.entries(bc).sort((a,b)=>b[1]-a[1])[0];
          const bestByBean=topBeanRegion?scored2.filter(e=>regionOf(e.beanRegion)===topBeanRegion[0]).sort((a,b)=>(b.sc??0)-(a.sc??0))[0]:null;
          const avgBiteBean=coffeeTotal?(scored2.reduce((a,e)=>a+(e.sc??0),0)/coffeeTotal).toFixed(2):"—";
          const avgTasteBean=coffeeTotal?(coffeeOnly.reduce((a,e)=>a+e.taste,0)/coffeeTotal).toFixed(1):"—";
          const avgSpendBean=coffeeTotal?"$"+(coffeeOnly.reduce((a,e)=>a+e.cost,0)/coffeeTotal).toFixed(2):"—";
          const regionsLogged=Object.keys(bc).filter(k=>k!=="Other"&&k!=="Blend").length;

          // Simple donut
          const S2=160,CX2=80,CY2=80,R2=68,RI2=44;
          let ang2=-Math.PI/2;
          const paths2=coffeeTotal>0?ALL_BEANS.filter(b=>bc[b]>0).map(b=>{
            const count=bc[b],frac=count/coffeeTotal,sw=frac*2*Math.PI;
            const a1=ang2+0.03,a2=ang2+sw-0.03; ang2+=sw;
            if(a2<=a1)return null;
            const c1=Math.cos(a1),s1=Math.sin(a1),c2=Math.cos(a2),s2=Math.sin(a2),lg=sw>Math.PI?1:0;
            return {b,count,frac,color:BEAN_COLORS[b]||"#888780",
              d:"M "+(CX2+R2*c1)+" "+(CY2+R2*s1)+" A "+R2+" "+R2+" 0 "+lg+" 1 "+(CX2+R2*c2)+" "+(CY2+R2*s2)+" L "+(CX2+RI2*c2)+" "+(CY2+RI2*s2)+" A "+RI2+" "+RI2+" 0 "+lg+" 0 "+(CX2+RI2*c1)+" "+(CY2+RI2*s1)+" Z"};
          }).filter(Boolean):[];

          // Grey ring for empty state
          // Full circle paths for empty state
          const emptyRingOuter="M "+(CX2+R2)+" "+CY2+" A "+R2+" "+R2+" 0 1 1 "+(CX2+R2-0.001)+" "+(CY2-0.001)+" Z";
          const emptyRingD="M "+(CX2+R2)+" "+CY2+" A "+R2+" "+R2+" 0 1 1 "+(CX2-R2)+" "+CY2+" A "+R2+" "+R2+" 0 1 1 "+(CX2+R2)+" "+CY2+" M "+(CX2+RI2)+" "+CY2+" A "+RI2+" "+RI2+" 0 1 0 "+(CX2-RI2)+" "+CY2+" A "+RI2+" "+RI2+" 0 1 0 "+(CX2+RI2)+" "+CY2+" Z";

          return (
            <div>
              <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:16}}>
                <svg width={S2} height={S2} viewBox={"0 0 "+S2+" "+S2} style={{flexShrink:0}}>
                  {paths2.length>0
                    ? paths2.map(p=><path key={p.b} d={p.d} fill={p.color}/>)
                    : <><circle cx={CX2} cy={CY2} r={R2} fill="#2C2C2A"/><circle cx={CX2} cy={CY2} r={RI2} fill="#141413"/></>
                  }
                  <text x={CX2} y={CY2-4} textAnchor="middle" fill={coffeeTotal?"#F1EFE8":"#444441"} fontSize={20} fontWeight="500">{coffeeTotal||"?"}</text>
                  <text x={CX2} y={CY2+12} textAnchor="middle" fill="#888780" fontSize={9}>{coffeeTotal?"coffees":"log origin"}</text>
                </svg>
                <div style={{flex:1}}>
                  {ALL_BEANS.filter(b=>b!=="Blend"&&b!=="Other").map(b=>{
                    const count=bc[b]||0;
                    const hasData=count>0;
                    return (
                    <div key={b} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                      <div style={{width:8,height:8,borderRadius:2,background:hasData?(BEAN_COLORS[b]||"#888780"):"#2C2C2A",flexShrink:0}}/>
                      <span style={{fontSize:12,color:hasData?"#888780":"#444441",flex:1}}>{b}</span>
                      <span style={{fontSize:12,color:hasData?"#F1EFE8":"#444441",fontWeight:500}}>{hasData?count:0}</span>
                      <span style={{fontSize:11,color:"#444441",width:30,textAlign:"right"}}>{hasData?Math.round(count/coffeeTotal*100)+"%":"0%"}</span>
                    </div>
                  );})}
                </div>
              </div>

            </div>
          );
        })()}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
        {[
          [t.bestDrink, best?best.name+(best.order?" ("+best.order+")":""):"—"],
          ["Top rated", best?best.name:"—"],
          ["Avg BITE", (drinks.reduce((a,e)=>a+(calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,drinkWeights)??0),0)/total).toFixed(2)],
          [t.avgTaste, avgT+"/10"],
          [t.avgCost, "$"+avgC],
          [t.totalDrinks, String(total)],
        ].map(([label,val])=>(
          <div key={label} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:10,color:"#888780",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
            <div style={{fontSize:13,fontWeight:500,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}