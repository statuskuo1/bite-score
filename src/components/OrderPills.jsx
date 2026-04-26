import { S } from "../styles/sharedStyles.js";

export function OrderPills({item, onUpdate, orderOptions}) {
  return (
    <div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6}}>
        {orderOptions.map(opt=>{
          const active=item.order===opt&&!item._customOrder;
          return <div key={opt} onClick={()=>onUpdate({...item,order:opt,_customOrder:false})} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,flexShrink:0,background:active?"#3C1F13":"#1E1E1C",border:"1px solid "+(active?"#F0997B":"rgba(255,255,255,0.1)"),color:active?"#F0997B":"#888780"}}>{opt}</div>;
        })}
        <div onClick={()=>onUpdate({...item,order:"",_customOrder:true})} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,flexShrink:0,background:item._customOrder?"#3C1F13":"#1E1E1C",border:"1px solid "+(item._customOrder?"#F0997B":"rgba(255,255,255,0.1)"),color:item._customOrder?"#F0997B":"#888780"}}>Other</div>
      </div>
      {item._customOrder&&<input value={item.order} onChange={e=>onUpdate({...item,order:e.target.value})} placeholder="e.g. Hojicha latte, Affogato..." style={S.wb}/>}
    </div>
  );
}