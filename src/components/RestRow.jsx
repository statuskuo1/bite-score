import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { FLAGS } from "../constants/cuisineConstants.js";
import { calcBiteOutOf10, scoreColor, scoreLabel, tasteLabel } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { SwipeRow } from "./SwipeRow.jsx";
import { canMutateVisit, canSwipeGroup } from "../utils/rowAccess.js";

export function RestRow({ e, i, display, onEdit, onDelete, user, visits = 1, group, weights }) {
  const {t} = useLang();
  const [exp,setExp] = useState(false);
  const [showVisits,setShowVisits] = useState(false);
  const flag = FLAGS[e.cuisine]||(e.letter||e.cuisine?.[0])?.toUpperCase()||"?";
  const grp = group||[e];
  const swipeOk = canSwipeGroup(grp, user);
  return (
    <div>
      {showVisits&&(
        <div onClick={()=>setShowVisits(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.25rem"}}>
          <div onClick={ev=>ev.stopPropagation()} style={{background:"#1E1E1C",borderRadius:16,width:"100%",maxWidth:560,maxHeight:"60vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.25rem",borderBottom:"0.5px solid rgba(255,255,255,0.1)",flexShrink:0}}>
              <div>
                <div style={{fontSize:15,fontWeight:500,color:"#F1EFE8"}}>{e.name}</div>
                <div style={{fontSize:12,color:"#888780"}}>{visits} visit{visits!==1?"s":""}</div>
              </div>
              <button onClick={()=>setShowVisits(false)} style={{fontSize:22,color:"#888780",background:"none",border:"none",cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1rem 1.25rem",flex:1}}>
              {[...grp].reverse().map((v,idx)=>{
                const sc=calcBiteOutOf10(v.taste,v.cost,v.portions,v.wait,v.useR,v.repeatability,weights);
                return(
                  <div key={v.id} style={{background:"#141413",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:500,color:"#F1EFE8"}}>Visit {grp.length-idx}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:16,fontWeight:500,color:scoreColor(sc)}}>{sc!=null?sc.toFixed(2):"—"}</div>
                        {canMutateVisit(v,user)&&<button onClick={()=>{setShowVisits(false);onEdit(v);window.scrollTo({top:0,behavior:"smooth"});}} style={{fontSize:11,color:"#5B9BD5",background:"none",border:"0.5px solid #5B9BD5",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>Edit</button>}
                        {canMutateVisit(v,user)&&<button onClick={()=>{onDelete(v.id);}} style={{fontSize:11,color:"#A32D2D",background:"none",border:"0.5px solid #A32D2D",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>Delete</button>}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                      {[[t.taste,v.taste.toFixed(1)],["Cost","$"+v.cost],[t.wait,v.wait+" min"],["Repeat","⭐".repeat(v.repeatability)||"✕"]].map(([k,val])=>(
                        <div key={k}><div style={{fontSize:10,color:"#888780"}}>{k}</div><div style={S.val}>{val}</div></div>
                      ))}
                    </div>
                    {v.notes&&<div style={{marginTop:8,fontSize:11,color:"#888780",fontStyle:"italic"}}>{v.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <SwipeRow mutable={swipeOk} onEdit={()=>{ if(visits>1){setShowVisits(true);}else{onEdit(e);window.scrollTo({top:0,behavior:"smooth"});}}} onDelete={()=>onDelete(e.id)}>
        <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10}}>
          <div onClick={()=>setExp(x=>!x)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer"}}>
            <span style={{fontSize:12,color:"#888780",minWidth:18,textAlign:"right"}}>{"#"+(i+1)}</span>
            <div style={{width:36,height:36,borderRadius:8,background:"#3C1F13",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{flag}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontWeight:500,fontSize:14,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div>
                {visits>1&&<span onClick={ev=>{ev.stopPropagation();setShowVisits(true);}} style={{fontSize:10,fontWeight:500,padding:"2px 6px",borderRadius:10,background:"#2A1E05",color:"#EF9F27",border:"0.5px solid #EF9F27",flexShrink:0,cursor:"pointer"}}>{visits}×</span>}
                {e.isFusion&&<span style={{fontSize:10,fontWeight:500,padding:"2px 6px",borderRadius:10,background:"#2A1E05",color:"#EF9F27",border:"0.5px solid #EF9F27",flexShrink:0}}>{t.fusionLabel}</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:"#888780"}}>{e.cuisine}</span>
                <span style={{fontSize:10,padding:"1px 6px",borderRadius:8,background:"rgba(91,155,213,0.12)",color:"#5B9BD5",border:"0.5px solid rgba(91,155,213,0.25)"}}>📍 {e.city||"NYC"}</span>
              </div>
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
                {[[t.taste,String(e.taste)],["Cost","$"+e.cost],[t.portions,e.portions+"x"],[t.wait,e.wait+" min"],["Repeat",e.useR?("⭐".repeat(e.repeatability)||"✕"):t.off]].map(([k,v])=>(
                  <div key={k}><div style={{fontSize:10,color:"#888780"}}>{k}</div><div style={S.val}>{v}</div></div>
                ))}
              </div>
  {e.notes&&<div style={{marginTop:10,fontSize:11,color:"#888780"}}><span style={{fontWeight:500}}>Note: </span>{e.notes}</div>}
            </div>
          )}
        </div>
      </SwipeRow>
    </div>
  );
}