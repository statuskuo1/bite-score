import { useLang } from "../contexts/LangContext.jsx";
import { CAFE_ORDERS, CAFE_ICONS } from "../constants/cafeCatalog.js";
import { calcCafeOutOf10, scoreColor, tasteLabel } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { FieldLabel } from "./FieldLabel.jsx";
import { OrderPills } from "./OrderPills.jsx";
import { OrderAutocomplete } from "./OrderAutocomplete.jsx";

export function CafeItemBlock({item, idx, onUpdate, onRemove, canRemove, pastOrders}) {
  const {t} = useLang();
  const orderOptions = CAFE_ORDERS[item.category];
  const score = calcCafeOutOf10(+item.taste,+item.cost,+item.portions,0,false,0);
  return (
    <div style={{marginBottom:12}}>
      {idx>0&&<div style={{borderTop:"0.5px solid rgba(255,255,255,0.1)",marginBottom:12}}/>}
      {(idx>0||canRemove)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:12,fontWeight:500,color:"#F0997B"}}>{idx>0?"Item "+(idx+1):""}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {score!=null&&<span style={{fontSize:12,color:scoreColor(score)}}>{score.toFixed(2)}</span>}
          {canRemove&&<button onClick={onRemove} style={{fontSize:18,color:"#888780",background:"none",border:"none",cursor:"pointer",lineHeight:1,padding:0}}>×</button>}
        </div>
      </div>}
      {/* Category */}
      <div style={{marginBottom:12}}>
        <FieldLabel>{t.category}</FieldLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {Object.keys(CAFE_ORDERS).map(cat=>(
            <div key={cat} onClick={()=>onUpdate({...item,category:cat,order:""})} style={{padding:"6px 4px",borderRadius:8,textAlign:"center",cursor:"pointer",background:item.category===cat?"#3C1F13":"#1E1E1C",border:"1px solid "+(item.category===cat?"#F0997B":"rgba(255,255,255,0.1)"),fontSize:11,color:item.category===cat?"#F0997B":"#888780"}}>
              <div style={{fontSize:14,marginBottom:1}}>{CAFE_ICONS[cat]}</div>
              <div>{cat}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Bean region — shown right after category for Coffee */}
      {item.category==="Coffee"&&(
        <div style={{marginBottom:12}}>
          <FieldLabel>Bean region <span style={{color:"#888780",fontWeight:400,fontSize:11}}>(optional)</span></FieldLabel>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {["Africa","Central America","South America","Asia-Pacific","Blend","Unknown"].map(b=>(
              <div key={b} onClick={()=>onUpdate({...item,beanRegion:item.beanRegion===b?"":b})} style={{padding:"6px 4px",borderRadius:8,textAlign:"center",cursor:"pointer",fontSize:11,background:item.beanRegion===b?"#3C1F13":"#1E1E1C",border:"1px solid "+(item.beanRegion===b?"#F0997B":"rgba(255,255,255,0.1)"),color:item.beanRegion===b?"#F0997B":"#888780"}}>{b}</div>
            ))}
          </div>
        </div>
      )}
      {/* Order */}
      <div style={{marginBottom:12}}>
        <FieldLabel>{t.order}</FieldLabel>
        {orderOptions ? (
          <OrderPills item={item} onUpdate={onUpdate} orderOptions={orderOptions}/>
        ) : (
          <OrderAutocomplete value={item.order} onChange={v=>onUpdate({...item,order:v,_customOrder:false})} pastOrders={pastOrders} placeholder={t.anythingMemorable}/>
        )}
      </div>
      {/* Taste */}
      <div style={{marginBottom:12}}>
        <FieldLabel>Taste — <span style={{color:"#F0997B"}}>{item.taste} · {tasteLabel(item.taste,t)}</span></FieldLabel>
        <input type="range" min="0" max="10" step="0.1" value={item.taste} onChange={e=>onUpdate({...item,taste:+e.target.value})} style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888780",marginTop:2}}><span>0 sucks</span><span>5 avg</span><span>10 incredible</span></div>
      </div>
      {/* Cost + Portions */}
      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <div style={S.f1}><FieldLabel>{t.totalCost}</FieldLabel><input type="number" value={item.cost} onChange={e=>onUpdate({...item,cost:e.target.value})} placeholder="$" style={S.wb}/></div>
        <div style={S.f1}><FieldLabel>{t.portions}</FieldLabel><input type="number" min="0.5" step="0.5" value={item.portions} onChange={e=>onUpdate({...item,portions:+e.target.value})} style={S.wb}/></div>
      </div>
      {/* Coffee/Tea extras */}
      {item.category==="Coffee"&&(
        <div style={{marginTop:10}}>
          <FieldLabel>{t.milk}</FieldLabel>
          <div style={S.row8}>
            {["None","Light","Medium","Heavy"].map(m=><div key={m} onClick={()=>onUpdate({...item,milkLevel:m})} style={{flex:1,padding:"6px",borderRadius:8,textAlign:"center",cursor:"pointer",fontSize:11,background:item.milkLevel===m?"#3C1F13":"#1E1E1C",border:"1px solid "+(item.milkLevel===m?"#F0997B":"rgba(255,255,255,0.1)"),color:item.milkLevel===m?"#F0997B":"#888780"}}>{m}</div>)}
          </div>

        </div>
      )}
    </div>
  );
}