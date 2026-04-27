import { useEffect, useRef, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";

export function SwipeRow({children,onEdit,onDelete,mutable=true}) {
  const {t} = useLang();
  const [off,setOff] = useState(0);
  const sx = useRef(null);
  const sy = useRef(null);
  const ref = useRef(null);
  const T = 160;
  const innerRef = useRef(null);
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setOff(0);}
    document.addEventListener("mousedown",h);document.addEventListener("touchstart",h);
    return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("touchstart",h);};
  },[]);
  useEffect(()=>{
    const el=innerRef.current;
    if(!el)return;
    function onTM(e){
      if(sx.current===null)return;
      const dx=e.touches[0].clientX-sx.current;
      const dy=e.touches[0].clientY-(sy.current||0);
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>5){e.preventDefault();}
    }
    el.addEventListener("touchmove",onTM,{passive:false});
    return()=>el.removeEventListener("touchmove",onTM);
  },[]);

  if (!mutable) {
    return (
      <div style={{position:"relative",overflow:"hidden",borderRadius:10,marginBottom:8}}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} style={{position:"relative",overflow:"hidden",borderRadius:10,marginBottom:8,isolation:"isolate"}}>
      <div style={{position:"absolute",right:0,top:0,bottom:0,display:"flex",alignItems:"stretch",zIndex:0}}>
        <button onClick={()=>{setOff(0);onEdit();}} style={{width:80,background:"#185FA5",color:"#F1EFE8",border:"none",fontSize:12,fontWeight:500,cursor:"pointer"}}>Edit</button>
        <button onClick={()=>{setOff(0);onDelete();}} style={{width:80,background:"#A32D2D",color:"#F1EFE8",border:"none",fontSize:12,fontWeight:500,cursor:"pointer"}}>{t.deleteLabel}</button>
      </div>
      <div
        onMouseDown={e=>{sx.current=e.clientX;sy.current=e.clientY;}}
        onMouseMove={e=>{if(sx.current===null)return;const dx=e.clientX-sx.current;if(Math.abs(dx)>5&&dx<0)setOff(Math.max(dx,-T));else if(off<0)setOff(Math.min(0,off+(e.clientX-sx.current)));}}
        onMouseUp={()=>{sx.current=null;sy.current=null;setOff(o=>o<-T/2?-T:0);}}
        onMouseLeave={()=>{if(sx.current!==null){sx.current=null;setOff(o=>o<-T/2?-T:0);}}}
        onTouchStart={e=>{sx.current=e.touches[0].clientX; sy.current=e.touches[0].clientY;}}
        onTouchMove={e=>{
          if(sx.current===null)return;
          const dx=e.touches[0].clientX-sx.current;
          const dy=e.touches[0].clientY-(sy.current||0);
          if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>5){e.preventDefault();if(dx<0)setOff(Math.max(dx,-T));else if(off<0)setOff(Math.min(0,off+dx));}
        }}
        onTouchEnd={()=>{sx.current=null;sy.current=null;setOff(o=>o<-T/2?-T:0);}}
        ref={innerRef} style={{transform:"translateX("+off+"px)",transition:sx.current===null?"transform 0.2s":"none",position:"relative",zIndex:1}}>
        {children}
      </div>
    </div>
  );
}