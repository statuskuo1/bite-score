import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { WeightSliders } from "./WeightSliders.jsx";
import { calcCafe, scoreColor, tasteLabel } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";

export function DrinksPalette({cafes,cafeWeights,updateCafeW,resetCafeWeights,cafeTotalW,cafeWErr}) {
  const {t,lang} = useLang();
  const drinks = cafes.filter(e=>["Coffee","Tea","Other"].includes(e.category));
  const total = drinks.length;
  const [editingW,setEditingW] = useState(false);

  if(!total) return <p style={{color:"#888780",fontSize:14}}>{t.noDrinks}</p>;

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
  const scored=drinks.map(e=>({...e,sc:calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)})).sort((a,b)=>(b.sc??0)-(a.sc??0));
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
  const notEnoughLine = !hasEnoughData ? (drinkRoastMode ? "You want me to give you a personality read when you've logged less than 3 coffees? Log more and come back." : "Lorelai Gilmore would be disappointed in your coffee logging frequency.") : null;

  // Roast lines
  const roastPersonality=+avgT>=8?"You rate your own coffee higher than you rate most people. That's fine. Coffee is more reliable.":+avgT>=7?"You think you have good taste in coffee. You're not wrong but you're also not making it yourself, so let's not get too comfortable.":+avgT>=6?"You're drinking coffee for the ritual, not the taste. Own it.":"Your coffee taste scores are telling me you need to either raise your standards or switch to tea.";
  const roastMilkLine = !hasEnoughData||!hasMilkData ? null
    : milkMajority==="None" ? "You drink it black. Either great taste or a complicated personality. Possibly both."
    : milkMajority ? "You take "+milkMajority.toLowerCase()+" milk. One customization away from a Starbucks regular order."
    : null;
  const roastBeanLine = !hasEnoughData ? null : topBean ? "You keep going back to "+topBean[0]+" beans. At this point just move there." : null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{...S.card}}>
        <div style={{...S.lbl,marginBottom:10}}>Weights</div>
        <WeightSliders weights={cafeWeights} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"]]} onUpdate={updateCafeW} onReset={resetCafeWeights} defaults={{taste:70,bpb:30}}/>
      </div>
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
          const BEAN_COLORS={"Africa":"#97C459","Central America":"#F0997B","South America":"#EF9F27","Asia-Pacific":"#5B9BD5","Blend":"#AFA9EC","Unknown":"#888780"};
          const ALL_BEANS=["Africa","Central America","South America","Asia-Pacific","Blend","Unknown"];
          const coffeeOnly=drinks.filter(e=>e.category==="Coffee"&&e.beanRegion);
          const coffeeTotal=coffeeOnly.length;
          const bc={};coffeeOnly.forEach(e=>{bc[e.beanRegion]=(bc[e.beanRegion]||0)+1;});
          const scored2=coffeeOnly.map(e=>({...e,sc:calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)}));
          const topBeanRegion=Object.entries(bc).sort((a,b)=>b[1]-a[1])[0];
          const bestByBean=topBeanRegion?scored2.filter(e=>e.beanRegion===topBeanRegion[0]).sort((a,b)=>(b.sc??0)-(a.sc??0))[0]:null;
          const avgBiteBean=coffeeTotal?(scored2.reduce((a,e)=>a+(e.sc??0),0)/coffeeTotal).toFixed(2):"—";
          const avgTasteBean=coffeeTotal?(coffeeOnly.reduce((a,e)=>a+e.taste,0)/coffeeTotal).toFixed(1):"—";
          const avgSpendBean=coffeeTotal?"$"+(coffeeOnly.reduce((a,e)=>a+e.cost,0)/coffeeTotal).toFixed(2):"—";
          const regionsLogged=Object.keys(bc).filter(k=>k!=="Unknown"&&k!=="Blend").length;

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
                  {ALL_BEANS.filter(b=>b!=="Blend"&&b!=="Unknown").map(b=>{
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
          ["Avg BITE", (drinks.reduce((a,e)=>a+(calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0),0)/total).toFixed(2)],
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