import { useEffect, useRef, useState } from "react";
import { ALL_CUISINES } from "../constants/cuisineConstants.js";
import { S } from "../styles/sharedStyles.js";

export function CuisineInput({value, onChange, placeholder, options, leadingOption, defaultOptions}) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const items = options || ALL_CUISINES;
  // When empty: show `defaultOptions` suggestions (if provided). When typing: filter `items`.
  const filtered = value.trim().length > 0
    ? items.filter(x => x.toLowerCase().startsWith(value.trim().toLowerCase()))
    : (defaultOptions || []);
  const hasDropdown = show && (!!leadingOption || filtered.length > 0);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setShow(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <input value={value} onChange={e=>{onChange(e.target.value);setShow(true);}} onFocus={()=>setShow(true)} placeholder={placeholder} style={S.wb}/>
      {hasDropdown && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,zIndex:100,maxHeight:180,overflowY:"auto",marginTop:4}}>
          {leadingOption && (
            <div
              onMouseDown={() => { onChange(""); setShow(false); }}
              style={{
                padding:"8px 12px", fontSize:13, cursor:"pointer",
                color: value === "" ? "#F0997B" : "#888780",
                fontWeight: value === "" ? 600 : 400,
                borderBottom: filtered.length > 0 ? "0.5px solid rgba(255,255,255,0.08)" : "none",
              }}
              onMouseEnter={e=>e.currentTarget.style.background="#2C2C2A"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >{leadingOption}</div>
          )}
          {filtered.map(x=>(
            <div key={x} onMouseDown={()=>{onChange(x);setShow(false);}} style={{padding:"8px 12px",fontSize:13,color:"#F1EFE8",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="#2C2C2A"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{x}</div>
          ))}
        </div>
      )}
    </div>
  );
}