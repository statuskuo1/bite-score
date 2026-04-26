import { useEffect, useRef, useState } from "react";

export function Tooltip({children,content}) {
  const [show,setShow] = useState(false);
  const [pos,setPos] = useState({top:0,left:0});
  const ref = useRef(null);
  useEffect(()=>{
    if(!show)return;
    function h(e){if(ref.current&&!ref.current.contains(e.target))setShow(false);}
    document.addEventListener("mousedown",h);document.addEventListener("touchstart",h);
    return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("touchstart",h);};
  },[show]);
  function cp(el){const r=el.getBoundingClientRect();let left=r.left+r.width/2;left=Math.max(104,Math.min(left,window.innerWidth-104));return{top:r.top-12,left};}
  return (
    <div ref={ref} style={{position:"relative",display:"inline-block"}}
      onMouseEnter={e=>{setPos(cp(e.currentTarget));setShow(true);}} onMouseLeave={()=>setShow(false)}
      onTouchEnd={e=>{e.stopPropagation();setPos(cp(e.currentTarget));setShow(s=>!s);}}>
      {children}
      {show&&content&&(
        <div style={{position:"fixed",top:pos.top,left:pos.left,transform:"translate(-50%,-100%)",background:"#2C2C2A",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#F1EFE8",zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,0.7)",width:200,lineHeight:1.6,pointerEvents:"none"}}>
          {content}
        </div>
      )}
    </div>
  );
}