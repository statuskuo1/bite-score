import { useRef } from "react";
import { MouthLogo } from "./MouthLogo.jsx";

export function LogoWithTripleTap({onTripleTap, isAdmin}) {
  const taps = useRef([]);
  function handleTap() {
    const now = Date.now();
    taps.current = [...taps.current.filter(t=>now-t<800), now];
    if(taps.current.length>=3) { taps.current=[]; onTripleTap(); }
  }
  return (
    <div onClick={handleTap} style={{cursor:"pointer",flexShrink:0,position:"relative"}}>
      <MouthLogo/>
      {isAdmin&&<div style={{position:"absolute",top:-3,right:-3,width:10,height:10,borderRadius:"50%",background:"#97C459",border:"1.5px solid #141413"}}/>}
    </div>
  );
}