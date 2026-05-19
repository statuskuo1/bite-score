import { useEffect, useState } from "react";
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
import { CityInput } from "./CityInput.jsx";
import { DineWithPicker } from "./DineWithPicker.jsx";
import { getCurrencyForCity, getCurrencyForCountry, CURRENCY_SYMBOLS } from "../utils/currency.js";
import { parseVisitDateInput, formatVisitDateInput } from "../utils/visitDate.js";

function maskDate(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const NOTE_PILLS = ["great service","good ambiance","bad service","cozy","loud","date night","good for groups","beautiful presentation","unique","great drinks","great desserts","overrated"];

/**
 * Inverse of the `save()` notes concat (`fav: X · avoid: Y · pill1, pill2 · free`).
 * Used to repopulate the dedicated inputs on edit so we don't dump everything
 * into the free-text textarea and lose structure on round-trip.
 */
function parseSavedNotes(notes, pillVocab) {
  if (!notes) return { favOrder: "", shouldntGet: "", pills: [], rest: "" };
  const segs = notes.split(" · ");
  let favOrder = "", shouldntGet = "";
  const leftover = [];
  for (const seg of segs) {
    if (seg.startsWith("fav: ")) favOrder = seg.slice(5).trim();
    else if (seg.startsWith("avoid: ")) shouldntGet = seg.slice(7).trim();
    else leftover.push(seg);
  }
  let pills = [], rest = "";
  if (leftover.length) {
    const tokens = leftover[0].split(",").map(s => s.trim()).filter(Boolean);
    if (tokens.length && tokens.every(tok => pillVocab.includes(tok))) {
      pills = tokens;
      rest = leftover.slice(1).join(" · ");
    } else {
      rest = leftover.join(" · ");
    }
  }
  return { favOrder, shouldntGet, pills, rest };
}

export function RestForm({initial,initialDineWith=[],onSave,onCancel,onMove,onFormChange,weights,addType,setAddType,existingEntries,existingCities,places,onPlaceCreated,user,tasteBudIds,tasteStep=0.1,onTasteStepChange}) {
  const {t} = useLang();
  const isEdit = !!initial.id;
  const [f,setF] = useState(() => {
    const base = { ...initial, visitDate: initial.visitDate || formatVisitDateInput(initial.visitedAt) || "" };
    if (!isEdit) return base;
    const parsed = parseSavedNotes(initial.notes, NOTE_PILLS);
    return {
      ...base,
      favOrder: initial.favOrder ?? parsed.favOrder,
      shouldntGet: initial.shouldntGet ?? parsed.shouldntGet,
      notes: parsed.rest,
    };
  });
  const [sub,setSub] = useState(false);
  const [portionHint,setPortionHint] = useState(false);
  const [showMoveConfirm,setShowMoveConfirm] = useState(false);
  const [dineWith,setDineWith] = useState(initialDineWith);
  const [selectedPills,setSelectedPills] = useState(() => {
    if (!isEdit) return [];
    return parseSavedNotes(initial.notes, NOTE_PILLS).pills;
  });
  useEffect(() => {
    if (!isEdit) onFormChange?.({ addType: "restaurant", f, dineWith });
  }, [f, dineWith]); // eslint-disable-line react-hooks/exhaustive-deps
  const [currencyCode, setCurrencyCode] = useState(() => initial.currency_code || getCurrencyForCity(initial.city || ""));
  const inp = (k,v) => setF(p=>({...p,[k]:v}));
  const currSymbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  const score = calcBiteOutOf10(+f.taste,+f.cost,+f.portions,+f.wait,f.useR,+f.repeatability,weights,currencyCode);
  const bg = score===null?"#2C2C2A":score>=9.5?"#1A2E0A":score>=8.5?"#1A2E0A":score>=7?"#0C2A3A":score>=4?"#2A1E05":score>=2?"#2C2C2A":"#3C1F13";
  const visitDateRaw = (f.visitDate || "").trim();
  const visitDateIso = visitDateRaw ? parseVisitDateInput(visitDateRaw) : null;
  const visitDateInvalid = !!visitDateRaw && !visitDateIso;
  const togglePill = (pill) => setSelectedPills(prev => prev.includes(pill) ? prev.filter(p=>p!==pill) : [...prev,pill]);

  function save() {
    if(!f.name||!f.cost||!f.portions||!f.city||visitDateInvalid){setSub(true);return;}
    const pillsText = selectedPills.join(", ");
    const favPart = f.favOrder?.trim() ? `fav: ${f.favOrder.trim()}` : "";
    const avoidPart = f.shouldntGet?.trim() ? `avoid: ${f.shouldntGet.trim()}` : "";
    const fullNotes = [favPart, avoidPart, pillsText, f.notes].filter(Boolean).join(" · ");
    onSave({...f,placeId:f.placeId||null,taste:+f.taste,cost:+f.cost,currency_code:currencyCode,portions:+f.portions,wait:+f.wait,repeatability:+f.repeatability,dineWith,visitedAt:visitDateIso||null,notes:fullNotes});
  }
  return (
    <div style={{...S.card,marginBottom:12}}>
      <SectionLabel>{t.theBasics}</SectionLabel>
      <FormScoreHeader
        addType={addType}
        setAddType={setAddType}
        score={score}
        scoreColor={scoreColor(score)}
        scoreLabel={scoreLabel(score,t)}
      />
      <div style={{marginBottom:16}}>
        <FieldLabel>{t.city||"City"} *</FieldLabel>
        <CityInput value={f.city||""} onChange={val=>{ inp("city",val); setCurrencyCode(getCurrencyForCity(val)); }} existingCities={existingCities} />
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
          onChange={({name, placeId, city, cuisine: pickedCuisine, cuisine2: pickedCuisine2, isFusion: pickedFusion, countryCode})=>{
            if(!placeId){
              setF(p=>({...p, name, placeId: null}));
              return;
            }
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
            const resolvedCurrency = getCurrencyForCountry(countryCode) || getCurrencyForCity(cty || "");
            setCurrencyCode(resolvedCurrency);
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

      <div style={S.mb16}>
        <FieldLabel>Visit date</FieldLabel>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input
            type="text"
            inputMode="numeric"
            value={f.visitDate || ""}
            onChange={(ev) => inp("visitDate", maskDate(ev.target.value))}
            placeholder="mm/dd/yyyy"
            style={{...S.wb,flex:1}}
          />
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              const mm = String(d.getMonth()+1).padStart(2,"0");
              const dd = String(d.getDate()).padStart(2,"0");
              inp("visitDate", `${mm}/${dd}/${d.getFullYear()}`);
            }}
            style={{flexShrink:0,padding:"8px 10px",borderRadius:8,background:"transparent",border:"0.5px solid rgba(255,255,255,0.15)",color:"#888780",fontSize:12,cursor:"pointer"}}
          >Today</button>
        </div>
        {visitDateInvalid && <div style={S.err}>Use mm/dd/yyyy</div>}
      </div>

      {user && (
        <div style={S.mb16}>
          <FieldLabel>Dined with @</FieldLabel>
          <DineWithPicker
            userId={user.id}
            tasteBudIds={tasteBudIds}
            selected={dineWith}
            onChange={setDineWith}
          />
        </div>
      )}

      <div style={S.sec}><SectionLabel>{t.scoreInputs}</SectionLabel></div>
      <div style={S.mb16}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <FieldLabel style={{margin:0}}>Taste * — <span style={{color:"#F0997B"}}>{f.taste} · {tasteLabel(f.taste,t)}</span></FieldLabel>
          {onTasteStepChange&&<div style={{display:"flex",gap:4}}>
            {[0.1,0.5].map(s=>(
              <button key={s} onClick={()=>{
                if(s!==tasteStep){
                  if(s===0.5) inp("taste",String(Math.round(+f.taste*2)/2));
                  onTasteStepChange(s===0.5);
                }
              }} style={{padding:"2px 8px",borderRadius:5,border:"none",cursor:"pointer",fontSize:11,
                background:tasteStep===s?"#F0997B":"#2C2C2A",
                color:tasteStep===s?"#141413":"#888780"}}>
                {s===0.1?"0.1":"0.5"}
              </button>
            ))}
          </div>}
        </div>
        <input type="range" min="0" max="10" step={tasteStep} value={f.taste} onChange={e=>inp("taste",e.target.value)} style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888780",marginTop:4}}><span>0 sucks</span><span>5 avg</span><span>10 incredible</span></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={S.f1}>
          <FieldLabel>{t.totalCost}</FieldLabel>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#888780",pointerEvents:"none",lineHeight:1}}>{currSymbol||"$"}</span>
            <input type="number" value={f.cost} onChange={e=>inp("cost",e.target.value)} style={{...S.wb,paddingLeft:8+(currSymbol||"$").length*8+6}}/>
          </div>
          {sub&&!f.cost&&<div style={S.err}>Required</div>}
        </div>
        <div style={S.f1}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <FieldLabel>{t.portions} *</FieldLabel>
            <button type="button" onClick={()=>setPortionHint(h=>!h)} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontSize:13,color:portionHint?"#F0997B":"#555553",lineHeight:1}}>ⓘ</button>
          </div>
          {portionHint&&<p style={{fontSize:11,color:"#888780",margin:"0 0 6px",lineHeight:1.5}}>How many meals can it feed you? e.g. big enough to take home as another meal = 2</p>}
          <input type="number" min="0.5" step="0.5" value={f.portions} onChange={e=>inp("portions",e.target.value)} style={S.wb}/>
          {sub&&!f.portions&&<div style={S.err}>Required</div>}
        </div>
        <div style={S.f1}><FieldLabel>{t.waitMins} *</FieldLabel><input type="number" min="0" step="1" value={f.wait} onChange={e=>inp("wait",e.target.value)} style={S.wb}/></div>
      </div>
      <div style={S.sec}><SectionLabel>{t.repeatability}</SectionLabel></div>
      <div style={S.mb16}><FieldLabel>Repeatability * — <span style={{color:"#F0997B"}}>{"⭐".repeat(f.repeatability)||"✕"}</span></FieldLabel><RepeatPicker value={f.repeatability} onChange={v=>inp("repeatability",v)}/></div>
      <div style={S.sec}><SectionLabel>{t.notes}</SectionLabel></div>
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <div style={S.f1}><FieldLabel>Favourite order</FieldLabel><input type="text" value={f.favOrder||""} onChange={e=>inp("favOrder",e.target.value)} placeholder="e.g. Tagliatelle" style={S.wb}/></div>
          <div style={S.f1}><FieldLabel>Shouldn't Get</FieldLabel><input type="text" value={f.shouldntGet||""} onChange={e=>inp("shouldntGet",e.target.value)} placeholder="e.g. Caesar salad" style={S.wb}/></div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
          {NOTE_PILLS.map((pill) => {
            const on = selectedPills.includes(pill);
            return (
              <button
                key={pill}
                type="button"
                onClick={() => togglePill(pill)}
                style={{padding:"4px 10px",borderRadius:20,fontSize:11,background:on?"#3C1F13":"transparent",border:"0.5px solid "+(on?"#F0997B":"rgba(255,255,255,0.15)"),color:on?"#F0997B":"#888780",cursor:"pointer"}}
              >{pill}</button>
            );
          })}
        </div>
        <textarea value={f.notes} onChange={e=>inp("notes",e.target.value)} placeholder="anything else to add?" rows={3} style={{width:"100%",boxSizing:"border-box",resize:"vertical"}}/>
      </div>
      {isEdit && onMove && (
        <div style={{marginBottom:12}}>
          {!showMoveConfirm ? (
            <button type="button" onClick={()=>setShowMoveConfirm(true)}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#888780",padding:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>
              Logged this as a restaurant? Move to café →
            </button>
          ) : (
            <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:13,color:"#F1EFE8",fontWeight:500,marginBottom:6}}>Move to café?</div>
              <div style={{fontSize:12,color:"#888780",marginBottom:initialDineWith.length>0?6:10,lineHeight:1.5}}>
                Your scores and notes will carry over. Café-specific fields (drink type, bean notes) will start blank — you can fill them in after.
              </div>
              {initialDineWith.length>0&&(
                <div style={{fontSize:12,color:"#F0997B",marginBottom:10,lineHeight:1.5}}>
                  Note: this will disconnect your log from the group dining event.
                </div>
              )}
              <div style={{display:"flex",gap:8}}>
                <button type="button" onClick={()=>setShowMoveConfirm(false)}
                  style={{flex:1,padding:"7px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:7,fontSize:13,cursor:"pointer"}}>
                  Cancel
                </button>
                <button type="button" onClick={onMove}
                  style={{flex:1,padding:"7px",background:"#3C1F13",color:"#F0997B",border:"0.5px solid rgba(240,153,123,0.3)",borderRadius:7,fontSize:13,cursor:"pointer"}}>
                  Move to café
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div style={S.row8}>
        <button onClick={onCancel} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:14,cursor:"pointer"}}>{t.cancel}</button>
        <button onClick={save} style={{flex:2,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:15,fontWeight:500,cursor:"pointer"}}>{t.save}</button>
      </div>
    </div>
  );
}
