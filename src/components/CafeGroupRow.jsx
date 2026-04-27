import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { getCafeIcon } from "../constants/cafeCatalog.js";
import { calcCafeOutOf10, tasteLabel, tasteColor, cafeScoreColor, cafeScoreLabel } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { SwipeRow } from "./SwipeRow.jsx";
import { canMutateVisit, canSwipeGroup } from "../utils/rowAccess.js";

export function CafeGroupRow({ group, cafeSortBy, onEdit, onDelete, user, showAuthor = false }) {
  const {t,lang} = useLang();
  const [exp, setExp] = useState(false);
  const [showVisits, setShowVisits] = useState(false);
  const icon = getCafeIcon(group[0].category, group[0].order);
  const visits = group.length;

  const scores = group.map(e=>calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)).filter(s=>s!=null);
  const avgScore = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null;
  const avgTaste = group.reduce((a,e)=>a+e.taste,0)/visits;
  const avgCost = group.reduce((a,e)=>a+e.cost,0)/visits;
  const avgWait = group.reduce((a,e)=>a+e.wait,0)/visits;
  const avgRepeat = Math.round(group.reduce((a,e)=>a+e.repeatability,0)/visits);

  function getDisplay() {
    if(cafeSortBy==="taste"){const tv=avgTaste,lbl=tasteLabel(tv,t),col=tasteColor(tv);return{val:tv.toFixed(1),label:lbl,color:col};}
    if(cafeSortBy==="bpb") return{val:"$"+avgCost.toFixed(2),label:"avg/item",color:"#5B9BD5"};
    if(cafeSortBy==="wait") return{val:avgWait.toFixed(0)+" min",label:"avg wait",color:"#888780"};
    if(cafeSortBy==="repeat") return{val:"⭐".repeat(avgRepeat)||"✕",label:"avg repeat",color:"#EF9F27"};
    return{val:avgScore!=null?avgScore.toFixed(2):"—",label:cafeScoreLabel(avgScore,t),color:cafeScoreColor(avgScore)};
  }
  const display = getDisplay();
  const orders = [...new Set(group.map(e=>e.order).filter(Boolean))].join(", ");
  const swipeOk = canSwipeGroup(group, user);

  return (
    <>
      {/* Visit history modal */}
      {showVisits&&(
        <div onClick={()=>setShowVisits(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.25rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1E1E1C",borderRadius:16,width:"100%",maxWidth:560,maxHeight:"60vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.25rem",borderBottom:"0.5px solid rgba(255,255,255,0.1)",flexShrink:0}}>
              <div>
                <div style={{fontSize:15,fontWeight:500,color:"#F1EFE8"}}>{group[0].name}</div>
                <div style={{fontSize:12,color:"#888780"}}>{visits} visit{visits!==1?"s":""}</div>
              </div>
              <button onClick={()=>setShowVisits(false)} style={{fontSize:22,color:"#888780",background:"none",border:"none",cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1rem 1.25rem",flex:1}}>
              {[...group].reverse().map((e,i)=>{
                const sc = calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability);
                return (
                  <div key={e.id} style={{background:"#141413",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:500,color:"#F1EFE8"}}>{lang==="zh"?t.visitLabel+(visits-i)+t.visitsLabel:"Visit "+(visits-i)}{e.order?" · "+e.order:""}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:16,fontWeight:500,color:cafeScoreColor(sc)}}>{sc!=null?sc.toFixed(2):"—"}</div>
                        {canMutateVisit(e,user)&&<button onClick={()=>{setShowVisits(false);onEdit(e);}} style={{fontSize:11,color:"#5B9BD5",background:"none",border:"0.5px solid #5B9BD5",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>{t.editWeights}</button>}
                        {canMutateVisit(e,user)&&<button onClick={()=>onDelete(e.id)} style={{fontSize:11,color:"#A32D2D",background:"none",border:"0.5px solid #A32D2D",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>{t.deleteLabel}</button>}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                      {[[t.taste,e.taste.toFixed(1)],["Cost","$"+e.cost],[t.wait,e.wait+" min"],["Repeat","⭐".repeat(e.repeatability)||"✕"]].map(([k,v])=>(
                        <div key={k}><div style={{fontSize:10,color:"#888780"}}>{k}</div><div style={{fontSize:13,fontWeight:500,color:"#F1EFE8"}}>{v}</div></div>
                      ))}
                    </div>
                    {e.notes&&<div style={{marginTop:8,fontSize:11,color:"#888780",fontStyle:"italic"}}>{e.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <SwipeRow mutable={swipeOk} onEdit={()=>onEdit(group[group.length-1])} onDelete={()=>onDelete(group[group.length-1].id)}>
        <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10}}>
          <div onClick={()=>setExp(x=>!x)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer"}}>
            <span style={{fontSize:12,color:"#888780",minWidth:18,textAlign:"right"}}></span>
            <div style={{width:36,height:36,borderRadius:8,background:"#3C1F13",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontWeight:500,fontSize:14,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{group[0].name}</div>
                {visits>1&&(
                  <span onClick={e=>{e.stopPropagation();setShowVisits(true);}} style={{fontSize:10,fontWeight:500,padding:"2px 6px",borderRadius:10,background:"#2A1E05",color:"#EF9F27",border:"0.5px solid #EF9F27",flexShrink:0,cursor:"pointer"}}>{visits}×</span>
                )}
              </div>
              <div style={{fontSize:12,color:"#888780",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{orders||group[0].category}</div>
              {showAuthor && group[0].authorDisplayName && (
                <div style={{fontSize:11,color:"#97C459",marginTop:2}}>{t.loggedBy} {group[0].authorDisplayName}</div>
              )}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:500,color:display.color}}>{display.val}</div>
              <div style={{fontSize:11,color:display.color}}>{display.label}</div>
            </div>
            <div style={{fontSize:10,color:"#888780",marginLeft:2}}>{exp?"▲":"▼"}</div>
          </div>
          {exp&&(
            <div style={{padding:"0 14px 12px 70px",borderTop:"0.5px solid rgba(255,255,255,0.07)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:10}}>
                {[[t.taste,avgTaste.toFixed(1)],["Cost","$"+avgCost.toFixed(2)],[t.wait,avgWait.toFixed(0)+" min"],["Repeat","⭐".repeat(avgRepeat)||"✕"],["Score",avgScore!=null?avgScore.toFixed(2):"—"],["Visits",String(visits)]].map(([k,v])=>(
                  <div key={k}><div style={{fontSize:10,color:"#888780"}}>{k}</div><div style={S.val}>{v}</div></div>
                ))}
              </div>
              {group[group.length-1].notes&&<div style={{marginTop:10,fontSize:11,color:"#888780"}}><span style={{fontWeight:500}}>Note: </span>{group[group.length-1].notes}</div>}
            </div>
          )}
        </div>
      </SwipeRow>
    </>
  );
}
