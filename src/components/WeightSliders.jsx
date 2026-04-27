import { useLang } from "../contexts/LangContext.jsx";

const RANGE_STYLE = `
.bite-weight-range{
  -webkit-appearance:none;
  appearance:none;
  width:100%;
  height:28px;
  background:transparent;
  cursor:pointer;
  margin:0;
  padding:0;
}
.bite-weight-range:focus{outline:none;}
.bite-weight-range::-webkit-slider-runnable-track{
  height:6px;
  background:rgba(255,255,255,0.12);
  border-radius:3px;
}
.bite-weight-range::-webkit-slider-thumb{
  -webkit-appearance:none;
  appearance:none;
  width:22px;
  height:22px;
  border-radius:50%;
  background:var(--thumb-color,#F0997B);
  border:2px solid #141413;
  margin-top:-8px;
  box-sizing:border-box;
}
.bite-weight-range::-moz-range-track{
  height:6px;
  background:rgba(255,255,255,0.12);
  border-radius:3px;
}
.bite-weight-range::-moz-range-thumb{
  width:20px;
  height:20px;
  border-radius:50%;
  background:var(--thumb-color,#F0997B);
  border:2px solid #141413;
  cursor:pointer;
}
`;

export function WeightSliders({weights, labels, onUpdate, onReset, defaults, derivedKeys = []}) {
  const {t} = useLang();
  const COLORS = {"taste":"#F0997B","bpb":"#5B9BD5","wait":"#97C459"};
  const cols = labels.length >= 3 ? "repeat(3,1fr)" : "repeat(2,1fr)";
  const derived = new Set(derivedKeys);
  const restaurantDerivedWait = derived.has("wait") && labels.some(([,k])=>k==="taste") && labels.some(([,k])=>k==="bpb");
  function reset() {
    if(!defaults || !onReset) return;
    onReset(defaults);
  }
  return (
    <div>
      <style>{RANGE_STYLE}</style>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:11,color:"#888780",fontStyle:"italic"}}>{t.howMuchCare}</span>
        {defaults&&<button type="button" onClick={reset} style={{fontSize:10,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",flexShrink:0}}>Reset</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:cols,gap:12}}>
        {labels.map(([label,key])=>{
          const color = COLORS[key]||"#F0997B";
          const pct = weights[key];
          if(derived.has(key)){
            return (
              <div key={key}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:11,color:"#888780"}}>{label}</span>
                  <span style={{fontSize:11,fontWeight:500,color:color}}>{pct}%</span>
                </div>
                <div style={{minHeight:28,display:"flex",alignItems:"center",padding:"4px 0"}} aria-hidden>
                  <div style={{width:"100%",height:8,borderRadius:4,background:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:4,minWidth:pct>0?2:0}}/>
                  </div>
                </div>
              </div>
            );
          }
          const maxVal = restaurantDerivedWait && key==="taste" ? 100 - weights.bpb
            : restaurantDerivedWait && key==="bpb" ? 100 - weights.taste
            : 100;
          return (
            <div key={key}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:11,color:"#888780"}}>{label}</span>
                <span style={{fontSize:11,fontWeight:500,color:color}}>{pct}%</span>
              </div>
              <div style={{minHeight:44,display:"flex",alignItems:"center",padding:"2px 0"}}>
                <input
                  type="range"
                  className="bite-weight-range"
                  min={0}
                  max={maxVal}
                  step={1}
                  value={pct}
                  onChange={e=>onUpdate(key,+e.target.value)}
                  style={{width:"100%",accentColor:color,"--thumb-color":color}}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
