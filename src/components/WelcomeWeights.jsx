import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { WeightSliders } from "./WeightSliders.jsx";

export function WelcomeWeights({weights, onUpdate, alwaysOpen}) {
  const {t} = useLang();
  const [open, setOpen] = useState(false);
  const isOpen = alwaysOpen || open;
  return (
    <div style={{borderTop:"0.5px solid rgba(255,255,255,0.08)",paddingTop:14,marginTop:4}}>
      {!alwaysOpen&&(
        <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",padding:0,marginBottom:open?10:0}}>
          <span style={{fontSize:12,color:"#888780"}}>Customize weights</span>
          <span style={{fontSize:11,color:"#888780"}}>{open?"▲":"▼"}</span>
        </button>
      )}
      {isOpen&&(
        <div>
          {!alwaysOpen&&<p style={{fontSize:11,color:"#888780",margin:"0 0 10px",lineHeight:1.5,textAlign:"left"}}>Default is Irene's settings (50/40/10). Drag to adjust.</p>}
          <WeightSliders weights={weights} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"],[t.wait,"wait"]]} onUpdate={onUpdate} defaults={{taste:50,bpb:40,wait:10}}/>
        </div>
      )}
    </div>
  );
}