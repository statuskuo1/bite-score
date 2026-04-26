import { useLang } from "../contexts/LangContext.jsx";

export function WeightSliders({weights, labels, onUpdate, onReset, defaults}) {
  const {t} = useLang();
  const COLORS = {"taste":"#F0997B","bpb":"#5B9BD5","wait":"#97C459"};
  const cols = labels.length >= 3 ? "repeat(3,1fr)" : "repeat(2,1fr)";
  function reset() {
    if(!defaults || !onReset) return;
    onReset(defaults);
  }
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:11,color:"#888780",fontStyle:"italic"}}>{t.howMuchCare}</span>
        {defaults&&<button onClick={reset} style={{fontSize:10,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",flexShrink:0}}>Reset</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:cols,gap:12}}>
        {labels.map(([label,key])=>(
          <div key={key}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:11,color:"#888780"}}>{label}</span>
              <span style={{fontSize:11,fontWeight:500,color:COLORS[key]||"#F0997B"}}>{weights[key]}%</span>
            </div>
            <input type="range" min="0" max="100" step="1" value={weights[key]}
              onChange={e=>onUpdate(key,+e.target.value)}
              style={{width:"100%",accentColor:COLORS[key]||"#F0997B"}}/>
          </div>
        ))}
      </div>
    </div>
  );
}