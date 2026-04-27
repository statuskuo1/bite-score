import { useRef } from "react";
import { MouthLogo } from "./MouthLogo.jsx";

export function LogoWithTripleTap({ onTripleTap }) {
  const taps = useRef([]);
  function handleTap() {
    const now = Date.now();
    taps.current = [...taps.current.filter(t=>now-t<800), now];
    if(taps.current.length>=3) { taps.current=[]; onTripleTap(); }
  }
  return (
    <div onClick={handleTap} style={{cursor:"pointer",flexShrink:0,position:"relative"}}>
      <MouthLogo/>
    </div>
  );
}