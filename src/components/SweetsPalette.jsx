import { useEffect, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { calcCafeOutOf10, CAFE_WEIGHT_DEFAULTS } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { WeightSliders } from "./WeightSliders.jsx";
import { toUSD, fromUSD, CURRENCY_SYMBOLS } from "../utils/currency.js";

const btnGhost = {fontSize:11,color:"#5B9BD5",background:"none",border:"1px solid rgba(91,155,213,0.45)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:500};

export function SweetsPalette({cafes, sweetWeights, replaceSweetWeights, homeCurrency="USD"}) {
  const {t,lang} = useLang();
  const sweets = cafes.filter(e=>e.category==="Sweets");
  const total = sweets.length;

  const [editingW,setEditingW] = useState(false);
  const [draftW,setDraftW] = useState(()=>({...sweetWeights}));
  const [sweetsRoastMode, setSweetsRoastMode] = useState(false);
  useEffect(()=>{if(!editingW)setDraftW({...sweetWeights});},[sweetWeights,editingW]);
  const draftSum = draftW.taste + draftW.bpb + draftW.wait;
  const draftOk = draftSum === 100;
  const liveSum = sweetWeights.taste + sweetWeights.bpb + sweetWeights.wait;
  const liveOk = liveSum === 100;
  function draftUpd(k,v){
    const nv = Math.round(Math.min(100,Math.max(0,+v)));
    setDraftW(w=>({...w,[k]:nv}));
  }
  function saveSweetWeights(){
    if(!draftOk)return;
    replaceSweetWeights(draftW);
    setEditingW(false);
  }

  const weightsCard = (
    <div style={{...S.card}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{...S.lbl,marginBottom:0}}>{t.weights}</div>
        {!editingW
          ? <button type="button" onClick={()=>{setDraftW({...sweetWeights});setEditingW(true);}} style={btnGhost}>{t.editWeights}</button>
          : <button type="button" onClick={()=>setEditingW(false)} style={{...btnGhost,color:"#888780",borderColor:"rgba(255,255,255,0.15)"}}>{t.cancel}</button>}
      </div>
      {editingW?(
        <>
          <WeightSliders weights={draftW} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"],[t.wait,"wait"]]} onUpdate={draftUpd} onReset={()=>setDraftW({...CAFE_WEIGHT_DEFAULTS})} defaults={CAFE_WEIGHT_DEFAULTS}/>
          <div style={{fontSize:11,color:draftOk?"#97C459":"#EF9F27",textAlign:"center",marginTop:8}}>{t.weightsTotal}: {draftSum}/100</div>
          {!draftOk&&<div style={{fontSize:11,color:"#F1EFE8",textAlign:"center",marginTop:4}}>{t.weightsSumTo100}</div>}
          <button type="button" disabled={!draftOk} onClick={saveSweetWeights} style={{width:"100%",marginTop:10,padding:"10px",borderRadius:8,border:"none",fontSize:14,fontWeight:500,cursor:draftOk?"pointer":"not-allowed",background:draftOk?"#F0997B":"#5A4A43",color:draftOk?"#141413":"#AFA8A3",opacity:draftOk?1:0.85}}>{t.weightsSave}</button>
        </>
      ):(
        <>
          <p style={{fontSize:13,color:"#F1EFE8",margin:0,lineHeight:1.5}}>
            {t.taste} <span style={{fontWeight:600,color:"#F0997B"}}>{sweetWeights.taste}%</span>
            {" · "}{t.bangBuck} <span style={{fontWeight:600,color:"#5B9BD5"}}>{sweetWeights.bpb}%</span>
            {" · "}{t.wait} <span style={{fontWeight:600,color:"#97C459"}}>{sweetWeights.wait}%</span>
          </p>
          {!liveOk&&<div style={{fontSize:11,color:"#F1EFE8",textAlign:"center",marginTop:8}}>{t.weightsSumTo100}</div>}
        </>
      )}
    </div>
  );

  if(!total) return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {weightsCard}
      <p style={{color:"#888780",fontSize:14}}>{t.noSweets}</p>
    </div>
  );

  const scored = [...sweets].map(e=>({...e,sc:calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,sweetWeights)})).sort((a,b)=>(b.sc??0)-(a.sc??0));
  const avgT=(sweets.reduce((a,e)=>a+e.taste,0)/total).toFixed(1);
  const mustReturn=sweets.filter(e=>e.repeatability===3).length;
  const mustReturnPct=Math.round(mustReturn/total*100);

  // Order type breakdown
  const orderCounts={};sweets.forEach(e=>{const k=e.order||"Other";orderCounts[k]=(orderCounts[k]||0)+1;});
  const orderEntries=Object.entries(orderCounts).sort((a,b)=>b[1]-a[1]);
  const topOrder=orderEntries[0];

  // Underrated = high BITE but not #1 taste
  const byBite=[...scored];
  const byTaste=[...sweets].sort((a,b)=>b.taste-a.taste);
  const underrated=byBite.find(e=>e.id!==byTaste[0]?.id);

  // PR lines
  const personality=+avgT>=8?"You have elite taste in pastries. Literally.":+avgT>=7?"You know a good croissant when you eat one.":+avgT>=6?"You are adventurous, for better or worse.":"You are either very picky or very unlucky.";
  const mustReturnLine=mustReturnPct>=50?"More than half your sweets visits ended in ⭐⭐⭐. Your standards are high and your bakeries know it.":mustReturnPct>0?mustReturnPct+"% of your sweets visits ended in ⭐⭐⭐.":"You haven't given ⭐⭐⭐ to a single sweet yet. Tough crowd.";
  const topOrderLine=topOrder?(topOrder[1]>1?"Your go-to: "+topOrder[0]+", ordered "+topOrder[1]+" times so far.":"You've been branching out — no single order dominates yet."):null;

  // Roast lines
  const roastPersonality=+avgT>=8?"Avg taste "+avgT+"/10 on pastries. This isn't Bake Off, sweetie. Nobody handed you a clipboard. You picked it up.":+avgT>=7?"Avg taste "+avgT+"/10. You think a croissant is \"acceptable\" — the architectural marvel of European breakfast — and you graded it like it owed you money.":+avgT>=6?"Avg taste "+avgT+"/10. If it has flour and went near an oven, you'll eat it. You don't have a sweet tooth, you have a structural opening in your face.":"Avg taste "+avgT+"/10. Your sweets log is a cry for help written in buttercream. Step away from the bakery.";
  const roastMustReturnLine=mustReturnPct>=50?mustReturnPct+"% of your sweets got ⭐⭐⭐. The bar isn't on the floor — the bar is buried under it.":mustReturnPct>0?"Only "+mustReturnPct+"% earned ⭐⭐⭐. Every pastry chef in the city is having a stress dream about you specifically.":"Zero ⭐⭐⭐ on any sweet. You are the after-school-special antagonist for an entire generation of bakers.";
  const roastTopOrderLine=topOrder?(topOrder[1]>1?topOrder[0]+" ordered "+topOrder[1]+" times. That's not a favorite, that's a brain rotation glitch. Reboot.":"Still no go-to. You wander bakeries like a ghost with no unfinished business."):null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {weightsCard}
      <div style={{...S.card}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{...S.lbl,marginBottom:0}}>{t.sweetsPersonality}</div>
          <div onClick={()=>setSweetsRoastMode(r=>!r)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",background:sweetsRoastMode?"#2A1E05":"#1A2E0A",border:"1px solid "+(sweetsRoastMode?"#EF9F27":"#97C459"),borderRadius:20,padding:"4px 10px"}}>
            <span style={{fontSize:11,color:sweetsRoastMode?"#EF9F27":"#97C459",fontWeight:500}}>{sweetsRoastMode?t.roastMe:t.prVersion}</span>
          </div>
        </div>
        <p style={{fontSize:13,color:"#F1EFE8",margin:"0 0 6px",lineHeight:1.65,fontWeight:500}}>{sweetsRoastMode?roastPersonality:personality}</p>
        {topOrderLine&&<p style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>{sweetsRoastMode?roastTopOrderLine:topOrderLine}</p>}
        <p style={{fontSize:13,color:"#888780",margin:0,lineHeight:1.65}}>{sweetsRoastMode?roastMustReturnLine:mustReturnLine}</p>
      </div>

      <div style={{...S.card}}>
        <div style={{...S.lbl,marginBottom:14}}>Sweets breakdown</div>
        {(()=>{
          // Map free-text orders to canonical types
          const TYPE_MAP=[
            ["Croissant",["croissant"]],
            ["Pain au Chocolat",["pain au choc","chocolate croissant"]],
            ["Danish",["danish"]],
            ["Tart",["tart","nata","natas","custard"]],
            ["Soft Serve",["soft serve","softserve","soft-serve"]],
            ["Ice Cream",["ice cream","gelato","sorbet"]],
            ["Muffin",["muffin"]],
            ["Cookie",["cookie"]],
            ["Scone",["scone"]],
            ["Cake",["cake","slice"]],
            ["Brownie",["brownie"]],
            ["Parfait",["parfait"]],
          ];
          function classify(order) {
            if(!order) return "Other";
            const low=order.toLowerCase();
            for(const [type,keywords] of TYPE_MAP) {
              if(keywords.some(k=>low.includes(k))) return type;
            }
            return "Other";
          }
          const TYPE_COLORS={"Croissant":"#F0997B","Pain au Chocolat":"#D85A30","Danish":"#EF9F27","Tart":"#97C459","Soft Serve":"#9FE1CB","Ice Cream":"#5B9BD5","Muffin":"#AFA9EC","Cookie":"#FAC775","Scone":"#F5C4B3","Cake":"#E24B4A","Brownie":"#7F77DD","Parfait":"#1D9E75","Other":"#888780"};
          const typeCounts={};sweets.forEach(e=>{const k=classify(e.order);typeCounts[k]=(typeCounts[k]||0)+1;});
          const typeEntries=Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]);
          const topType=typeEntries[0];
          const best2=scored[0];
          const avgBiteSweets=total?(sweets.reduce((a,e)=>a+(calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,sweetWeights,e.currency_code||"USD")??0),0)/total).toFixed(2):"—";
          const sym = CURRENCY_SYMBOLS[homeCurrency] || homeCurrency;
          const avgCostSweetsUSD=total?sweets.reduce((a,e)=>a+(toUSD(e.cost,e.currency_code||"USD")/(e.portions||1)),0)/total:null;
          const avgCostSweets=avgCostSweetsUSD!=null?sym+fromUSD(avgCostSweetsUSD,homeCurrency).toFixed(2):"—";

          const S2=160,CX2=80,CY2=80,R2=68,RI2=44;
          let ang2=-Math.PI/2;
          const paths2=typeEntries.map(([b,count])=>{
            const frac=count/total,sw=frac*2*Math.PI;
            const a1=ang2+0.03,a2=ang2+sw-0.03; ang2+=sw;
            if(a2<=a1)return null;
            const c1=Math.cos(a1),s1=Math.sin(a1),c2=Math.cos(a2),s2=Math.sin(a2),lg=sw>Math.PI?1:0;
            return {b,count,frac,color:TYPE_COLORS[b]||"#888780",
              d:"M "+(CX2+R2*c1)+" "+(CY2+R2*s1)+" A "+R2+" "+R2+" 0 "+lg+" 1 "+(CX2+R2*c2)+" "+(CY2+R2*s2)+" L "+(CX2+RI2*c2)+" "+(CY2+RI2*s2)+" A "+RI2+" "+RI2+" 0 "+lg+" 0 "+(CX2+RI2*c1)+" "+(CY2+RI2*s1)+" Z"};
          }).filter(Boolean);

          return (
            <div>
              <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:16}}>
                <svg width={S2} height={S2} viewBox={"0 0 "+S2+" "+S2} style={{flexShrink:0}}>
                  {paths2.map(p=><path key={p.b} d={p.d} fill={p.color}/>)}
                  <text x={CX2} y={CY2-4} textAnchor="middle" fill="#F1EFE8" fontSize={20} fontWeight="500">{total}</text>
                  <text x={CX2} y={CY2+12} textAnchor="middle" fill="#888780" fontSize={9}>sweets</text>
                </svg>
                <div style={{flex:1}}>
                  {typeEntries.map(([b,count])=>(
                    <div key={b} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                      <div style={{width:8,height:8,borderRadius:2,background:TYPE_COLORS[b]||"#888780",flexShrink:0}}/>
                      <span style={{fontSize:12,color:"#888780",flex:1}}>{b}</span>
                      <span style={{fontSize:12,color:"#F1EFE8",fontWeight:500}}>{count}</span>
                      <span style={{fontSize:11,color:"#888780",width:34,textAlign:"right"}}>{Math.round(count/total*100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                {[
                  ["Top type", topType?topType[0]:"—"],
                  ["Top rated", best2?best2.name+(best2.order?" · "+best2.order:""):"—"],
                  ["Avg BITE", avgBiteSweets],
                  [t.avgTaste, avgT+"/10"],
                  ["Avg spend", avgCostSweets],
                  [t.totalSweets, String(total)],
                ].map(([label,val])=>(
                  <div key={label} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:11,color:"#888780",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:13,fontWeight:500,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}