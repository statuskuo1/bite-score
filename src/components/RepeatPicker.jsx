import { useLang } from "../contexts/LangContext.jsx";

export function RepeatPicker({value,onChange}) {
  const {t} = useLang();
  const opts = [[0,"✕",t.wouldntReturn],[1,"⭐",t.ifOccasionCalls],[2,"⭐⭐",t.wouldSeekOut],[3,"⭐⭐⭐",t.mustReturn]];
  return (
    <div style={{display:"flex",gap:8,marginTop:6}}>
      {opts.map(([v,stars,desc])=>(
        <div key={v} onClick={()=>onChange(v)} style={{flex:1,padding:"8px 6px",borderRadius:8,textAlign:"center",cursor:"pointer",background:value===v?"#3C1F13":"#141413",border:"1px solid "+(value===v?"#F0997B":"rgba(255,255,255,0.1)")}}>
          <div style={{fontSize:16,marginBottom:2}}>{stars}</div>
          <div style={{fontSize:9,color:value===v?"#F0997B":"#888780",lineHeight:1.3}}>{desc}</div>
        </div>
      ))}
    </div>
  );
}