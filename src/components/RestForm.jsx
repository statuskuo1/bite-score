import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { FLAGS } from "../constants/cuisineConstants.js";
import { calcBiteOutOf10, scoreColor, scoreLabel, tasteLabel } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { PlacePicker } from "./PlacePicker.jsx";
import { CuisineInput } from "./CuisineInput.jsx";
import { Toggle } from "./Toggle.jsx";
import { RepeatPicker } from "./RepeatPicker.jsx";
import { SectionLabel } from "./SectionLabel.jsx";
import { FieldLabel } from "./FieldLabel.jsx";
import { FormScoreHeader } from "./FormScoreHeader.jsx";

export function RestForm({initial,onSave,onCancel,weights,addType,setAddType,existingEntries,places,onPlaceCreated}) {
  const {t} = useLang();
  const [f,setF] = useState(initial);
  const [sub,setSub] = useState(false);
  const inp = (k,v) => setF(p=>({...p,[k]:v}));
  const score = calcBiteOutOf10(+f.taste,+f.cost,+f.portions,+f.wait,f.useR,+f.repeatability,weights);
  const bg = score===null?"#2C2C2A":score>=9.5?"#1A2E0A":score>=8.5?"#1A2E0A":score>=7?"#0C2A3A":score>=4?"#2A1E05":score>=2?"#2C2C2A":"#3C1F13";
  function save() {
    if(!f.name||!f.cost||!f.city){setSub(true);return;}
    onSave({...f,placeId:f.placeId||null,taste:+f.taste,cost:+f.cost,portions:+f.portions,wait:+f.wait,repeatability:+f.repeatability});
  }
  return (
    <div style={{...S.card,marginBottom:12}}>
      <FormScoreHeader
        addType={addType}
        setAddType={setAddType}
        score={score}
        scoreColor={scoreColor(score)}
        scoreLabel={scoreLabel(score,t)}
      />
      <SectionLabel>{t.theBasics}</SectionLabel>
      <div style={{marginBottom:16}}>
        <FieldLabel>{t.city||"City"} *</FieldLabel>
        <input value={f.city||""} onChange={e=>inp("city",e.target.value)} placeholder="e.g. NYC, Tokyo, Lisbon" style={S.wb}/>
        {sub&&!f.city&&<div style={S.err}>Required</div>}
      </div>
      <div style={S.mb16}>
        <FieldLabel>{t.restaurantName}</FieldLabel>
        <PlacePicker
          kind="restaurant"
          value={f.name}
          selectedPlaceId={f.placeId||null}
          places={places||[]}
          cityHint={f.city||""}
          onPlaceCreated={onPlaceCreated}
          onChange={({name, placeId, city, cuisine: pickedCuisine, cuisine2: pickedCuisine2, isFusion: pickedFusion})=>{
            if(!placeId){
              /** Typing or "Add new" — just update name + clear pinned placeId. */
              setF(p=>({...p, name, placeId: null}));
              return;
            }
            /** Picker-provided fields (a) win for freshly-resolved Google rows
             *  that aren't in the parent `places` catalog yet, and (b) prefer
             *  `verified_*` over user-typed for catalog hits. Fall back to the
             *  catalog lookup so existing rows without verified fields still
             *  autopopulate cuisine/fusion. */
            const place=(places||[]).find(p=>p.id===placeId);
            const cuisine = pickedCuisine || place?.verifiedCuisine || place?.cuisine || "";
            const cuisine2 = pickedCuisine2 != null ? pickedCuisine2 : place?.cuisine2 || "";
            const isFusion = pickedFusion != null ? pickedFusion : !!place?.isFusion;
            const cty = city || place?.verifiedCity || place?.city || "";
            setF(p=>({
              ...p,
              name,
              placeId,
              city: cty || p.city || "",
              cuisine: cuisine || p.cuisine || "",
              letter: ((cuisine || p.cuisine || "")[0] || "").toUpperCase(),
              cuisine2,
              isFusion,
            }));
            /** Layer the user's own past-visit metadata on top for visit-level
             *  fields only (portions, wait, repeatability) — keyed by placeId
             *  so it survives casing/whitespace drift. */
            const match=(existingEntries||[]).find(e=>e.placeId===placeId);
            if(match){
              setF(p=>({
                ...p,
                portions: match.portions || 1,
                wait: 0,
                useR: match.useR !== false,
                repeatability: match.repeatability || 1,
              }));
            }
          }}
        />
        {sub&&!f.name&&<div style={S.err}>Required</div>}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={S.f1}><FieldLabel>{t.cuisine}</FieldLabel><CuisineInput value={f.cuisine} placeholder={t.cuisine} onChange={v=>{inp("cuisine",v);inp("letter",v.trim()[0]?.toUpperCase()||"");}}/></div>
        {f.letter&&<div style={{display:"flex",alignItems:"flex-end",paddingBottom:2}}><div style={{width:36,height:36,borderRadius:8,background:"#3C1F13",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{FLAGS[f.cuisine]||f.letter}</div></div>}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <Toggle on={f.isFusion} onClick={()=>inp("isFusion",!f.isFusion)}/><span style={{fontSize:13,color:"#888780"}}>{t.fusionDish}</span>
      </div>
      {f.isFusion&&<div style={S.mb16}><FieldLabel>{t.secondCuisine}</FieldLabel><CuisineInput value={f.cuisine2||""} placeholder={t.cuisine} onChange={v=>inp("cuisine2",v)}/></div>}
      <div style={S.sec}><SectionLabel>{t.scoreInputs}</SectionLabel></div>
      <div style={S.mb16}>
        <FieldLabel>Taste — <span style={{color:"#F0997B"}}>{f.taste} · {tasteLabel(f.taste,t)}</span></FieldLabel>
        <input type="range" min="0" max="10" step="0.1" value={f.taste} onChange={e=>inp("taste",e.target.value)} style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888780",marginTop:4}}><span>0 sucks</span><span>5 avg</span><span>10 incredible</span></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={S.f1}><FieldLabel>{t.totalCost}</FieldLabel><input type="number" value={f.cost} onChange={e=>inp("cost",e.target.value)} placeholder="$ e.g. 45" style={S.wb}/>{sub&&!f.cost&&<div style={S.err}>Required</div>}</div>
        <div style={S.f1}><FieldLabel>{t.portions}</FieldLabel><input type="number" min="0.5" step="0.5" value={f.portions} onChange={e=>inp("portions",e.target.value)} style={S.wb}/></div>
        <div style={S.f1}><FieldLabel>{t.waitMins}</FieldLabel><input type="number" min="0" step="1" value={f.wait} onChange={e=>inp("wait",e.target.value)} style={S.wb}/></div>
      </div>
      <div style={S.sec}><SectionLabel>{t.repeatability}</SectionLabel></div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><Toggle on={f.useR} onClick={()=>inp("useR",!f.useR)}/><span style={{fontSize:13,color:"#888780"}}>{t.includeInScore}</span></div>
      {f.useR&&<div style={S.mb16}><FieldLabel>Repeatability — <span style={{color:"#F0997B"}}>{"⭐".repeat(f.repeatability)||"✕"}</span></FieldLabel><RepeatPicker value={f.repeatability} onChange={v=>inp("repeatability",v)}/></div>}
      <div style={S.sec}><SectionLabel>{t.notes}</SectionLabel></div>
      <div style={{marginBottom:20}}><textarea value={f.notes} onChange={e=>inp("notes",e.target.value)} placeholder={t.whatMemorable} rows={3} style={{width:"100%",boxSizing:"border-box",resize:"vertical"}}/></div>
      <div style={S.row8}>
        <button onClick={onCancel} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:14,cursor:"pointer"}}>{t.cancel}</button>
        <button onClick={save} style={{flex:2,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:15,fontWeight:500,cursor:"pointer"}}>{t.save}</button>
      </div>
    </div>
  );
}
