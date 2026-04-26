import { useEffect, useRef, useState } from "react";
import { S } from "../styles/sharedStyles.js";

export function CafeNameInput({value, onChange, existingNames}) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const filtered = value.trim().length > 0
    ? [...new Set(existingNames)].filter(n => n.toLowerCase().includes(value.trim().toLowerCase()) && n.toLowerCase() !== value.trim().toLowerCase())
    : [];
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setShow(false);}
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <input value={value} onChange={e=>{onChange(e.target.value);setShow(true);}} onFocus={()=>setShow(true)} placeholder="e.g. Birch Coffee" style={S.wb}/>
      {show&&filtered.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,zIndex:100,maxHeight:160,overflowY:"auto",marginTop:4}}>
          {filtered.map(n=>(
            <div key={n} onMouseDown={()=>{onChange(n);setShow(false);}} style={{padding:"8px 12px",fontSize:13,color:"#F1EFE8",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="#2C2C2A"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
