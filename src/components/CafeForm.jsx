import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { calcCafeOutOf10, cafeScoreColor, cafeScoreLabel } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { CafeNameInput } from "./CafeNameInput.jsx";
import { CafeItemBlock } from "./CafeItemBlock.jsx";
import { Toggle } from "./Toggle.jsx";
import { RepeatPicker } from "./RepeatPicker.jsx";
import { SectionLabel } from "./SectionLabel.jsx";
import { FieldLabel } from "./FieldLabel.jsx";
import { FormScoreHeader } from "./FormScoreHeader.jsx";

export function CafeForm({initial,onSave,onCancel,weights,addType,setAddType,existingNames,existingCafes,pastOrders}) {
  const {t} = useLang();
  const BEANS = ["Africa","Central America","South America","Asia-Pacific","Blend","Unknown"];
  const blankItem = () => ({category:"Coffee",order:"",taste:5,cost:"",portions:1,milkLevel:"Light",beanRegion:""});
  const [name, setName] = useState(initial.name||"");
  const [wait, setWait] = useState(initial.wait||0);
  const [useR, setUseR] = useState(initial.useR!==false);
  const [repeatability, setRepeatability] = useState(initial.repeatability||1);
  const [notes, setNotes] = useState(initial.notes||"");
  const [items, setItems] = useState([{category:initial.category||"Coffee",order:initial.order||"",taste:initial.taste||7,cost:initial.cost||"",portions:initial.portions||1,milkLevel:initial.milkLevel||"Light",beanRegion:initial.beanRegion||""}]);
  const [sub, setSub] = useState(false);

  function updateItem(idx, val) { setItems(p=>p.map((it,i)=>i===idx?val:it)); }
  function addItem() { setItems(p=>[...p,blankItem()]); }
  function removeItem(idx) { setItems(p=>p.filter((_,i)=>i!==idx)); }

  function save() {
    if(!name||items.some(it=>!it.cost)){setSub(true);return;}
    const entries = items.map((it,i)=>({
      ...(i===0&&initial.id?{id:initial.id}:{}),
      name, wait:+wait, useR, repeatability:+repeatability, notes,
      category:it.category, order:it.order, taste:+it.taste,
      cost:+it.cost, portions:+it.portions,
      milkLevel:it.milkLevel, beanRegion:it.beanRegion,
      letter:"", cuisine2:"", isFusion:false,
    }));
    onSave(entries);
  }

  const previewScore = items[0]
    ? calcCafeOutOf10(+items[0].taste, +items[0].cost, +items[0].portions, 0, false, 0, weights)
    : null;

  return (
    <div style={{...S.card,marginBottom:12}}>
      <FormScoreHeader
        addType={addType}
        setAddType={setAddType}
        score={previewScore}
        scoreColor={cafeScoreColor(previewScore)}
        scoreLabel={cafeScoreLabel(previewScore,t)}
      />

      {/* ── The basics ── */}
      <SectionLabel>{t.theBasics}</SectionLabel>
      <div style={S.mb16}>
        <FieldLabel>{t.cafeName}</FieldLabel>
        <CafeNameInput value={name} onChange={v=>{
          setName(v);
          const matches=(existingCafes||[]).filter(e=>e.name===v);
          if(matches.length>0){
            const last=matches[matches.length-1];
            setItems(p=>p.map((it,i)=>i===0?{...it,
              category:last.category||"Coffee",
              order:"",
              milkLevel:last.milkLevel||"Light",
              beanRegion:last.beanRegion||"",
              portions:last.portions||1,
              taste:5,
              cost:"",
            }:it));
          }
        }} existingNames={existingNames||[]}/>
        {sub&&!name&&<div style={S.err}>Required</div>}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={S.f1}><FieldLabel>{t.waitMins}</FieldLabel><input type="number" min="0" step="1" value={wait} onChange={e=>setWait(e.target.value)} style={S.wb}/></div>
      </div>

      {/* ── Items ── */}
      <div style={S.sec}><SectionLabel>{t.cafeItems}</SectionLabel></div>
      {items.map((item,idx)=>(
        <CafeItemBlock key={idx} item={item} idx={idx} onUpdate={val=>updateItem(idx,val)} onRemove={()=>removeItem(idx)} canRemove={items.length>1} pastOrders={pastOrders||[]}/>
      ))}
      {sub&&items.some(it=>!it.cost)&&<div style={{...S.err,marginBottom:10}}>{t.allItemsNeedCost}</div>}
      <button onClick={addItem} style={{width:"100%",padding:"9px",borderRadius:8,background:"transparent",border:"1px dashed rgba(255,255,255,0.2)",color:"#888780",fontSize:13,cursor:"pointer",marginBottom:16}}>{t.addAnotherItem}</button>

      {/* ── Repeatability ── */}
      <div style={S.sec}><SectionLabel>{t.repeatability}</SectionLabel></div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><Toggle on={useR} onClick={()=>setUseR(r=>!r)}/><span style={{fontSize:13,color:"#888780"}}>{t.includeInScore}</span></div>
      {useR&&<div style={S.mb16}><FieldLabel>Repeatability — <span style={{color:"#F0997B"}}>{"⭐".repeat(repeatability)||"✕"}</span></FieldLabel><RepeatPicker value={repeatability} onChange={setRepeatability}/></div>}

      {/* ── Notes ── */}
      <div style={S.sec}><SectionLabel>{t.notes}</SectionLabel></div>
      <div style={{marginBottom:20}}><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t.anythingMemorable} rows={2} style={{width:"100%",boxSizing:"border-box",resize:"vertical"}}/></div>
      <div style={S.row8}>
        <button onClick={onCancel} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:14,cursor:"pointer"}}>{t.cancel}</button>
        <button onClick={save} style={{flex:2,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:15,fontWeight:500,cursor:"pointer"}}>Save {items.length>1?items.length+" items":""}</button>
      </div>
    </div>
  );
}
