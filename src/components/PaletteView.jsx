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

const WEIGHT_DEFAULTS = { taste: 50, bpb: 40, wait: 10 };

export function PaletteView({entries,cafes,weights,replaceRestaurantWeights,cafeWeights,updateCafeW,resetCafeWeights,cafeTotalW,cafeWErr}) {
  const {t,lang:lang_} = useLang();
  const [paletteTab,setPaletteTab] = useState("restaurants");
  const [editingW,setEditingW] = useState(false);
  const [draftW,setDraftW] = useState(()=>({...weights}));
  const [roastMode,setRoastMode] = useState(false);

  useEffect(()=>{
    if(!editingW)setDraftW({...weights});
  },[weights,editingW]);
  const total = entries.length;

  const rg={};
  entries.forEach(e=>{const r=REGION_MAP[e.cuisine]||"Other";rg[r]=(rg[r]||0)+1;});
  const sorted=Object.entries(rg).sort((a,b)=>b[1]-a[1]);
  const rows=[...sorted.slice(0,5),["Other",sorted.slice(5).reduce((a,[,n])=>a+n,0)]];
  const slices=rows.map(([region,count])=>({region,count,color:region==="Other"?"#888780":(REGION_COLORS[region]||"#888780")}));

  const topR=sorted[0]?.[0]||"Other",rCount=sorted.length;
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

  const pr0=lang_==="zh"?(topR==="East Asia"?"你的味蕾對東亞料理有種無法抗拒的吸引力——說真的，品味一流。":topR==="Western Europe"?"西歐的經典料理說到你心坎裡了。經典。":"你對"+topR+"料理有真正的好奇心。"):(topR==="East Asia"?"Your palate has a clear gravitational pull toward East Asia — and honestly, you have great taste.":topR==="Western Europe"?"Classic European dining speaks to your soul. Timeless.":"You have a genuine curiosity for "+topR+" cuisine.");
  const pr1=lang_==="zh"?(+avgT>=8?"你的標準很高，評分就是證明。你不接受普通。":+avgT>=6.5?"你欣賞品質，但不會太挑剔。一個價格合理的包子就能讓你很滿足。":"你帶著真正的好奇心吃飯。每一次踩雷都是數據。"):(+avgT>=8?"Your standards are high and your reviews reflect it. You don't do mid.":+avgT>=6.5?"You appreciate quality but you're not precious about it. A well-priced bao hits different.":"You eat with genuine curiosity. Every miss is data.");
  const pr2=lang_==="zh"?(+avgC>70?"你在乎飲食的投資。人生太短，不該浪費在難吃的食物上。":+avgC>40?"你找到了甜蜜點——品質與米其林價格之間的平衡。":"你有發掘價值的天賦。真正的 BITE 分數最大化者。"):(+avgC>70?"You invest in your meals. Life's too short for bad food at any price.":+avgC>40?"You've found the sweet spot — quality without the Michelin price tag.":"You have a gift for finding value. A true BITE Score maximizer.");
  const pr3=lang_==="zh"?(rCount>=4?"已探索 "+rCount+" 個地區，持續增加中。護照印章拿來。":"你知道自己的路，而且堅持走下去。忠誠、一致、有效率。"):(rCount>=4?""+rCount+" regions explored and counting. The passport stamps are giving.":"You know your lane and you stay in it. Loyal, consistent, efficient.");

  const topRPct=Math.round((rg[topR]||0)/total*100);
  const r0=lang_==="zh"?(topR==="East Asia"?"你的紀錄裡有 "+topRPct+"% 是東亞料理。我們懂。你想念媽媽的手藝。":topR==="Western Europe"?"有趣啊，「有文化」怎麼突然變成「我只吃法國菜」了？":""+topR+"佔了你紀錄的 "+topRPct+"%。這就是所謂的愛冒險啊。"):(topR==="East Asia"?"Girl, "+topRPct+"% of your log is East Asian food. We get it. You miss your mom's cooking.":topR==="Western Europe"?"Interesting how quickly 'cultured' becomes 'I only eat French food'.":""+topR+" is "+topRPct+"% of your log. Adventurous queen behavior right here.");
  const r1=lang_==="zh"?(+avgT>=8?"高標準還有金融公式來佐證。你就是那種人。":+avgT>=6.5?"平均口味 "+avgT+"。你給人一種「我有品味，但也能吃任何東西」的感覺。":"平均口味低於 6.5。要麼你在吃難吃的東西，要麼你在騙自己。"):(+avgT>=8?"High standards AND a finance formula to prove it. You are that girl.":+avgT>=6.5?""+avgT+" average taste. You're giving 'I have opinions but also I'll eat anything'.":"Average taste score under 6.5. Either you're eating bad food or you're lying to yourself.");
  const r2=lang_==="zh"?(+avgC>70?"每餐平均 $"+avgC+"。你看信用卡帳單的時候一定要喝點東西。":+avgC>40?"每餐平均 $"+avgC+"。不窮，但也沒在揮霍。混亂中產階級的體驗。":"每餐平均 $"+avgC+"。要麼你挖到了寶，要麼你的腸胃非常包容。"):(+avgC>70?"$"+avgC+" average per meal. You are not processing these credit card statements sober.":+avgC>40?"$"+avgC+" per meal average. Not broke, not balling. The chaotic middle class experience.":"$"+avgC+" per meal average. Either you have found hidden gems or you have a very forgiving digestive system.");
  const r3=lang_==="zh"?(rCount>=4?""+rCount+" 個地區，但有 "+topRPct+"% 是"+topR+"。所謂的多元，有點言過其實啦。":"只有 "+rCount+" 個地區。我們蓋了整個任務系統，結果就這樣用啊。"):(rCount>=4?""+rCount+" regions but "+topRPct+"% of that is "+topR+". The range is a bit of a lie bestie.":"Only "+rCount+" regions. We built an entire quest system and this is what we're doing with it.");

  const l0=pr0, l1=pr1, l2=pr2, l3=pr3;

  const pillSt = (on) => ({padding:"6px 14px",borderRadius:20,border:"1.5px solid "+(on?"#F0997B":"rgba(255,255,255,0.1)"),background:on?"#3C1F13":"transparent",color:on?"#F0997B":"#888780",fontSize:12,fontWeight:on?500:400,cursor:"pointer"});
  const btnGhost = {fontSize:11,color:"#5B9BD5",background:"none",border:"1px solid rgba(91,155,213,0.45)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:500};
  /** Hide personality / breakdown / stats only when there are no entries or committed weights don’t sum to 100 — not while editing draft (so the page doesn’t “disappear”). */
  const showRestaurantBody = total>0&&weightsOk;

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

            {(roastMode?[r0,r1,r2,r3]:[l0,l1,l2,l3]).map((l,i)=><p key={i} style={{fontSize:13,color:i===0?"#F1EFE8":"#888780",margin:"0 0 6px",lineHeight:1.65,fontWeight:i===0?500:400}}>{l}</p>)}
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
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {(()=>{
              const noteTopRated="Irene's judgement may have been clouded by bias and how underwhelming her home food has been, so this is not actually objectively #1. But let her live. She misses home 🥹";
              const noteRegions="Tap the Quests tab to explore by cuisine region!";
              const avgBiteMean = total ? meanRestaurantBiteOutOf10(entries, weights) : null;
              const avgBiteStr = avgBiteMean != null ? `${avgBiteMean.toFixed(2)}/10` : "—";
              const statRows=[[t.topCuisine,(FLAGS[topC]||"")+" "+topC],[t.topRated,topB?topB.name:"—","topRated"],[t.avgBite,avgBiteStr,"avgBite"],[t.avgTaste,avgT+"/10"],[t.avgSpend,"$"+avgC+" / meal"],[t.regionsExplored,rCount+" / "+Object.keys(CUISINE_REGIONS).length,"regions"]];
              return statRows.map(([label,val,key])=>(
                <StatCard key={label} label={label} val={val} note={key==="topRated"?noteTopRated:key==="regions"?noteRegions:key==="avgBite"?t.avgBitePaletteNote:undefined}/>
              ));
            })()}
          </div>
          </>}
        </div>
      )}

      {paletteTab==="drinks"&&<DrinksPalette cafes={cafes} cafeWeights={cafeWeights} updateCafeW={updateCafeW} resetCafeWeights={resetCafeWeights} cafeTotalW={cafeTotalW} cafeWErr={cafeWErr}/>}
      {paletteTab==="sweets"&&<SweetsPalette cafes={cafes} cafeWeights={cafeWeights} updateCafeW={updateCafeW} resetCafeWeights={resetCafeWeights}/>}
    </div>
  );
}
