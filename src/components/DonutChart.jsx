import { useState } from "react";

export function DonutChart({slices,total}) {
  const [hov,setHov] = useState(null);
  const S=180,CX=90,CY=90,R=78,RI=50;
  let ang = -Math.PI/2;
  const paths = slices.filter(s=>s.count>0).map(s=>{
    const frac=s.count/total,sw=frac*2*Math.PI,a1=ang+0.025,a2=ang+sw-0.025;
    ang+=sw;if(a2<=a1)return null;
    const c1=Math.cos(a1),s1=Math.sin(a1),c2=Math.cos(a2),s2=Math.sin(a2),lg=sw>Math.PI?1:0;
    const d="M "+(CX+R*c1)+" "+(CY+R*s1)+" A "+R+" "+R+" 0 "+lg+" 1 "+(CX+R*c2)+" "+(CY+R*s2)+" L "+(CX+RI*c2)+" "+(CY+RI*s2)+" A "+RI+" "+RI+" 0 "+lg+" 0 "+(CX+RI*c1)+" "+(CY+RI*s1)+" Z";
    return {...s,d,frac,mid:a1+(a2-a1)/2};
  }).filter(Boolean);
  const active = hov?paths.find(s=>s.region===hov):null;
  function splitL(n){if(n.length<=13)return[n];const b=n.lastIndexOf(" ",13);if(b<=3)return[n.slice(0,13),n.slice(13)];return[n.slice(0,b),n.slice(b+1)];}
  return (
    <svg width={S} height={S} viewBox={"0 0 "+S+" "+S} style={{flexShrink:0,overflow:"visible"}}>
      {paths.map(s=>{
        const ih=hov===s.region,tx=ih?Math.cos(s.mid)*4:0,ty=ih?Math.sin(s.mid)*4:0;
        return <path key={s.region} d={s.d} fill={s.color} opacity={hov&&!ih?0.35:1}
          style={{transform:"translate("+tx+"px,"+ty+"px)",transformOrigin:CX+"px "+CY+"px",transition:"all 0.15s",cursor:"pointer"}}
          onMouseEnter={()=>setHov(s.region)} onMouseLeave={()=>setHov(null)}/>;
      })}
      {active?(()=>{const ls=splitL(active.region),h=ls.length*13,y=CY-h/2+6;return(
        <g>
          <text x={CX} y={y-14} textAnchor="middle" fill={active.color} fontSize={14} fontWeight="600">{Math.round(active.frac*100)}%</text>
          {ls.map((l,i)=><text key={i} x={CX} y={y+i*13} textAnchor="middle" fill={"#F1EFE8"} fontSize={9}>{l}</text>)}
          <text x={CX} y={y+h+6} textAnchor="middle" fill={"#888780"} fontSize={9}>{active.count} {active.count===1?"place":"places"}</text>
        </g>
      );})():(
        <g>
          <text x={CX} y={CY-4} textAnchor="middle" fill={"#F1EFE8"} fontSize={22} fontWeight="500">{total}</text>
          <text x={CX} y={CY+13} textAnchor="middle" fill={"#888780"} fontSize={10}>places</text>
        </g>
      )}
    </svg>
  );
}
