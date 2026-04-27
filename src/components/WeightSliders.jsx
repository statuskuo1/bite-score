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

export function WeightSliders({weights, labels, onUpdate, onReset, defaults, manualKeys, careHeadingPx}) {
  const {t} = useLang();
  const COLORS = {"taste":"#F0997B","bpb":"#5B9BD5","wait":"#97C459"};
  const keys = labels.map(([,k])=>k);
  const pair = manualKeys && manualKeys.length === 2 ? manualKeys : null;
  const usePair = pair && keys.length === 3;
  const stack = keys.length >= 3;
  const gridStyle = stack
    ? {display:"flex",flexDirection:"column",gap:12}
    : {display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12};
  function reset() {
    if(!defaults || !onReset) return;
    onReset(defaults);
  }
  function maxForKey(key) {
    if(!usePair || !pair) return 100;
    if(pair.includes(key)){
      const other = pair.find(k=>k!==key);
      return 100 - weights[other];
    }
    return 100;
  }
  return (
    <div>
      <style>{RANGE_STYLE}</style>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:careHeadingPx||11,color:"#F1EFE8",fontStyle:"italic",fontWeight:500}}>{t.howMuchCare}</span>
        {defaults&&<button type="button" onClick={reset} style={{fontSize:10,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",flexShrink:0}}>Reset</button>}
      </div>
      <div style={gridStyle}>
        {labels.map(([label,key])=>{
          const color = COLORS[key]||"#F0997B";
          const pct = weights[key];
          const maxVal = maxForKey(key);
          return (
            <div key={key} style={stack?{width:"100%"}:undefined}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:11,color:"#F1EFE8"}}>{label}</span>
                <span style={{fontSize:11,fontWeight:500,color:color}}>{pct}%</span>
              </div>
              <div style={{minHeight:44,display:"flex",alignItems:"center",padding:"2px 0"}}>
                <input
                  type="range"
                  className="bite-weight-range"
                  min={0}
                  max={maxVal}
                  step={1}
                  value={Math.min(pct,maxVal)}
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
