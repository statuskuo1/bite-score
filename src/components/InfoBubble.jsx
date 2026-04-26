import { useEffect, useRef, useState } from "react";

export function InfoBubble({content}) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    if(!show) return;
    function h(e){if(ref.current&&!ref.current.contains(e.target))setShow(false);}
    document.addEventListener("mousedown",h);
    document.addEventListener("touchstart",h);
    return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("touchstart",h);};
  },[show]);
  return (
    <div ref={ref} style={{position:"relative",display:"inline-flex",flexShrink:0}}>
      <div onClick={e=>{e.stopPropagation();setShow(s=>!s);}} style={{width:18,height:18,borderRadius:"50%",background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,color:"#888780",fontWeight:600,flexShrink:0}}>i</div>
      {show&&(
        <div style={{position:"absolute",top:24,left:"50%",transform:"translateX(-50%)",background:"#2C2C2A",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#F1EFE8",zIndex:999,width:240,lineHeight:1.6,boxShadow:"0 4px 16px rgba(0,0,0,0.7)"}}>
          {content}
        </div>
      )}
    </div>
  );
}