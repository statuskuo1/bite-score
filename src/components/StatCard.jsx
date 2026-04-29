import { useState } from "react";

export function StatCard({label,val,note}) {
  const [show,setShow] = useState(false);
  return (
    <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px",position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:11,color:"#888780",letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</div>
        {note&&<div onClick={e=>{e.stopPropagation();setShow(s=>!s);}} style={{width:16,height:16,borderRadius:"50%",border:"1px solid #888780",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <span style={{fontSize:11,color:"#888780",lineHeight:1}}>i</span>
        </div>}
      </div>
      <div style={{fontSize:14,fontWeight:500,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</div>
      {show&&note&&(
        <div onClick={()=>setShow(false)} style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#2C2C2A",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"10px 12px",marginTop:4,fontSize:12,color:"#F1EFE8",lineHeight:1.6,cursor:"pointer"}}>
          {note}
        </div>
      )}
    </div>
  );
}