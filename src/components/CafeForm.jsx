import { useEffect, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { CAFE_ORDERS, CAFE_ICONS } from "../constants/cafeCatalog.js";
import { INIT_CAFE } from "../data/initialData.js";
import { calcCafeOutOf10, cafeScoreColor, cafeScoreLabel, tasteLabel } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { supabase } from "../config/supabaseClient.js";
import { fetchPopularOrdersForPlace } from "../utils/visitPlacesApi.js";
import { PlacePicker } from "./PlacePicker.jsx";
import { OrderCombobox } from "./OrderCombobox.jsx";
import { Toggle } from "./Toggle.jsx";
import { RepeatPicker } from "./RepeatPicker.jsx";
import { SectionLabel } from "./SectionLabel.jsx";
import { FieldLabel } from "./FieldLabel.jsx";
import { FormScoreHeader } from "./FormScoreHeader.jsx";
import { BEAN_ORIGINS } from "../constants/coffeeConstants.js";
import { CityInput } from "./CityInput.jsx";


const ROAST_LEVELS = [
  { value: "Light", labelKey: "roastLight" },
  { value: "Medium", labelKey: "roastMedium" },
  { value: "Dark", labelKey: "roastDark" },
];
const FLAVOR_NOTES = [
  { value: "Chocolate", labelKey: "flavorChocolate" },
  { value: "Fruity", labelKey: "flavorFruity" },
  { value: "Citrus", labelKey: "flavorCitrus" },
  { value: "Berry", labelKey: "flavorBerry" },
  { value: "Nutty", labelKey: "flavorNutty" },
  { value: "Floral", labelKey: "flavorFloral" },
  { value: "Caramel", labelKey: "flavorCaramel" },
  { value: "Spice", labelKey: "flavorSpice" },
  { value: "Smoky", labelKey: "flavorSmoky" },
];

export function CafeForm({initial,onSave,onSaveAndContinue,onCancel,weights,addType,setAddType,existingCafes,existingCities,places,onPlaceCreated}) {
  const {t} = useLang();
  const [f, setF] = useState({...INIT_CAFE, ...initial});
  const [sub, setSub] = useState(false);
  const inp = (k, v) => setF(p => ({...p, [k]: v}));
  const score = calcCafeOutOf10(+f.taste,+f.cost,+f.portions,+f.wait,f.useR,+f.repeatability,weights);
  const isEdit = !!initial.id;

  const cafesList = existingCafes || [];
  /** With PlacePicker, `f.placeId` is the source of truth for which place is
   *  attached. Past orders/cuisine autofill all key off that id (survives
   *  casing/whitespace drift in `name`). */
  const activePlaceId = f.placeId || null;
  const pastOrdersAtCafe = activePlaceId
    ? cafesList.filter(e => e.placeId === activePlaceId && e.order).map(e => e.order)
    : [];
  const pastOrdersForCategory = cafesList
    .filter(e => e.category === f.category && e.order)
    .map(e => e.order);

  // Tier 2: cross-user popular orders at the picked cafe. Re-fetched whenever
  // we resolve a different placeId or category. Failures are silent.
  const [popularAtCafe, setPopularAtCafe] = useState([]);
  useEffect(() => {
    if (!activePlaceId) { setPopularAtCafe([]); return; }
    let cancelled = false;
    fetchPopularOrdersForPlace(supabase, activePlaceId, f.category).then(items => {
      if (!cancelled) setPopularAtCafe(items);
    });
    return () => { cancelled = true; };
  }, [activePlaceId, f.category]);

  function buildEntry() {
    return {
      ...(isEdit ? {id: initial.id} : {}),
      placeId: f.placeId || null,
      name: f.name, city: f.city || "",
      category: f.category, order: f.order,
      taste: +f.taste, cost: +f.cost, portions: +f.portions, wait: +f.wait,
      useR: f.useR, repeatability: +f.repeatability, notes: f.notes,
      beanRegion: f.beanRegion, roast: f.roast,
      acidity: f.acidity != null ? +f.acidity : null,
      body: f.body != null ? +f.body : null,
      sweetness: f.sweetness != null ? +f.sweetness : null,
      flavorNotes: Array.isArray(f.flavorNotes) ? f.flavorNotes : [],
      letter: "", cuisine2: "", isFusion: false,
    };
  }
  function validate() {
    if (!f.name || !f.cost || !f.city) { setSub(true); return false; }
    return true;
  }
  function save() {
    if (!validate()) return;
    onSave(buildEntry());
  }
  function saveAndAddAnother() {
    if (!validate()) return;
    if (onSaveAndContinue) onSaveAndContinue(buildEntry());
    setF({...INIT_CAFE, name: f.name, city: f.city || "", placeId: f.placeId || null});
    setSub(false);
  }

  const TastingSlider = ({field, leftLabel, rightLabel, label}) => {
    const v = f[field] ?? 5;
    return (
      <div style={{marginTop:12}}>
        <FieldLabel>{label} — <span style={{color:"#F0997B"}}>{(+v).toFixed(1)}</span></FieldLabel>
        <input type="range" min="0" max="10" step="0.5" value={v} onChange={e=>inp(field, +e.target.value)} style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888780",marginTop:2}}>
          <span>{leftLabel}</span><span>{rightLabel}</span>
        </div>
      </div>
    );
  };

  const flavorNoteLabel = (val) => {
    const f = FLAVOR_NOTES.find(n=>n.value===val);
    return f ? t[f.labelKey] : val;
  };
  const toggleNote = (n) => {
    const cur = Array.isArray(f.flavorNotes) ? f.flavorNotes : [];
    inp("flavorNotes", cur.includes(n) ? cur.filter(x=>x!==n) : [...cur, n]);
  };
  const activeNotes = new Set(Array.isArray(f.flavorNotes) ? f.flavorNotes : []);
  const flavorSummary = activeNotes.size === 0
    ? t.optional ? `(${t.optional})` : "(none)"
    : [...activeNotes].map(flavorNoteLabel).join(", ");

  const selectStyle = {...S.wb, appearance:"none", WebkitAppearance:"none", MozAppearance:"none", paddingRight:28, backgroundImage:"linear-gradient(45deg, transparent 50%, #888780 50%), linear-gradient(135deg, #888780 50%, transparent 50%)", backgroundPosition:"calc(100% - 14px) 50%, calc(100% - 9px) 50%", backgroundSize:"5px 5px, 5px 5px", backgroundRepeat:"no-repeat"};

  return (
    <div style={{...S.card,marginBottom:12}}>
      <FormScoreHeader
        addType={addType}
        setAddType={setAddType}
        score={score}
        scoreColor={cafeScoreColor(score)}
        scoreLabel={cafeScoreLabel(score,t)}
      />

      <SectionLabel>{t.theBasics}</SectionLabel>
      <div style={{marginBottom:16}}>
        <FieldLabel>{t.city||"City"} *</FieldLabel>
        <CityInput value={f.city||""} onChange={val=>inp("city",val)} existingCities={existingCities} />
      </div>
      <div style={S.mb16}>
        <FieldLabel>{t.cafeName}</FieldLabel>
        <PlacePicker
          kind="cafe"
          value={f.name}
          selectedPlaceId={f.placeId||null}
          places={places||[]}
          cityHint={f.city||""}
          onPlaceCreated={onPlaceCreated}
          onChange={({name, placeId, city})=>{
            setF(p=>({
              ...p,
              name,
              placeId: placeId||null,
              ...(city ? {city} : {}),
            }));
            /** Pull autofill from the user's own past visits at this place
             *  (keyed by placeId — survives casing/whitespace drift). */
            if(placeId){
              const matches=(existingCafes||[]).filter(e=>e.placeId===placeId);
              if(matches.length>0){
                const last=matches[matches.length-1];
                setF(p=>({
                  ...p,
                  city: city || last.city || p.city || "",
                  category: p.category || last.category || "Coffee",
                  beanRegion: p.beanRegion || last.beanRegion || "",
                  portions: last.portions || 1,
                }));
              }
            }
          }}
        />
        {sub&&!f.name&&<div style={S.err}>Required</div>}
      </div>

      <div style={S.sec}><SectionLabel>{t.cafeItems}</SectionLabel></div>
      <div style={{marginBottom:16}}>
        <FieldLabel>{t.category}</FieldLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {Object.keys(CAFE_ORDERS).map(cat=>(
            <div key={cat} onClick={()=>setF(p=>({...p,category:cat,order:""}))} style={{padding:"6px 4px",borderRadius:8,textAlign:"center",cursor:"pointer",background:f.category===cat?"#3C1F13":"#1E1E1C",border:"1px solid "+(f.category===cat?"#F0997B":"rgba(255,255,255,0.1)"),fontSize:11,color:f.category===cat?"#F0997B":"#888780"}}>
              <div style={{fontSize:14,marginBottom:1}}>{CAFE_ICONS[cat]}</div>
              <div>{cat}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginBottom:16}}>
        <FieldLabel>{t.order}</FieldLabel>
        <OrderCombobox
          value={f.order}
          onChange={v=>inp("order",v)}
          presets={CAFE_ORDERS[f.category] || []}
          pastOrdersAtCafe={pastOrdersAtCafe}
          popularAtCafe={popularAtCafe}
          pastOrdersForCategory={pastOrdersForCategory}
          placeholder={t.anythingMemorable}
        />
      </div>

      {f.category==="Coffee" && (
        <details style={{marginBottom:16}}>
          <summary style={{cursor:"pointer",fontSize:12,color:"#888780",padding:"4px 0",userSelect:"none"}}>
            {t.coffeeDetails}
          </summary>
          <div style={{marginTop:10}}>
            <FieldLabel>{t.roast} <span style={{color:"#888780",fontWeight:400,fontSize:11}}>({t.optional||"optional"})</span></FieldLabel>
            <div style={S.row8}>
              {ROAST_LEVELS.map(r=>(
                <div key={r.value} onClick={()=>inp("roast", f.roast===r.value?"":r.value)} style={{flex:1,padding:"6px",borderRadius:8,textAlign:"center",cursor:"pointer",fontSize:11,background:f.roast===r.value?"#3C1F13":"#1E1E1C",border:"1px solid "+(f.roast===r.value?"#F0997B":"rgba(255,255,255,0.1)"),color:f.roast===r.value?"#F0997B":"#888780"}}>{t[r.labelKey]}</div>
              ))}
            </div>
          </div>
          <TastingSlider field="acidity" label={t.acidity} leftLabel={t.acidityLow} rightLabel={t.acidityHigh}/>
          <TastingSlider field="body" label={t.body} leftLabel={t.bodyLow} rightLabel={t.bodyHigh}/>
          <TastingSlider field="sweetness" label={t.sweetness} leftLabel={t.sweetnessLow} rightLabel={t.sweetnessHigh}/>

          <details style={{marginTop:12}}>
            <summary style={{cursor:"pointer",listStyle:"none",userSelect:"none",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderRadius:8,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)"}}>
              <span style={{fontSize:12,color:activeNotes.size?"#F1EFE8":"#888780"}}>
                <span style={{color:"#888780"}}>{t.flavorNotes}: </span>{flavorSummary}
              </span>
              <span style={{fontSize:10,color:"#888780"}}>▾</span>
            </summary>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"10px 0 4px"}}>
              {FLAVOR_NOTES.map(n=>{
                const on = activeNotes.has(n.value);
                return (
                  <div key={n.value} onClick={()=>toggleNote(n.value)} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,background:on?"#3C1F13":"#1E1E1C",border:"1px solid "+(on?"#F0997B":"rgba(255,255,255,0.1)"),color:on?"#F0997B":"#888780"}}>{t[n.labelKey]}</div>
                );
              })}
            </div>
          </details>

          <div style={{marginTop:12}}>
            <FieldLabel>{t.beanRegion} <span style={{color:"#888780",fontWeight:400,fontSize:11}}>({t.optional||"optional"})</span></FieldLabel>
            <select value={f.beanRegion||""} onChange={e=>inp("beanRegion", e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {BEAN_ORIGINS.map(b => <option key={b} value={b}>{b}</option>)}
              {f.beanRegion && !BEAN_ORIGINS.includes(f.beanRegion) && (
                <option value={f.beanRegion}>{f.beanRegion} (legacy)</option>
              )}
            </select>
          </div>
        </details>
      )}

      <div style={S.sec}><SectionLabel>{t.scoreInputs}</SectionLabel></div>
      <div style={S.mb16}>
        <FieldLabel>Taste — <span style={{color:"#F0997B"}}>{f.taste} · {tasteLabel(f.taste,t)}</span></FieldLabel>
        <input type="range" min="0" max="10" step="0.1" value={f.taste} onChange={e=>inp("taste",e.target.value)} style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888780",marginTop:4}}><span>0 sucks</span><span>5 avg</span><span>10 incredible</span></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={S.f1}><FieldLabel>{t.totalCost}</FieldLabel><input type="number" value={f.cost} onChange={e=>inp("cost",e.target.value)} placeholder="$" style={S.wb}/>{sub&&!f.cost&&<div style={S.err}>Required</div>}</div>
        <div style={S.f1}><FieldLabel>{t.portions}</FieldLabel><input type="number" min="0.5" step="0.5" value={f.portions} onChange={e=>inp("portions",e.target.value)} style={S.wb}/></div>
        <div style={S.f1}><FieldLabel>{t.waitMins}</FieldLabel><input type="number" min="0" step="1" value={f.wait} onChange={e=>inp("wait",e.target.value)} style={S.wb}/></div>
      </div>

      <div style={S.sec}><SectionLabel>{t.repeatability}</SectionLabel></div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><Toggle on={f.useR} onClick={()=>inp("useR",!f.useR)}/><span style={{fontSize:13,color:"#888780"}}>{t.includeInScore}</span></div>
      {f.useR&&<div style={S.mb16}><FieldLabel>Repeatability — <span style={{color:"#F0997B"}}>{"⭐".repeat(f.repeatability)||"✕"}</span></FieldLabel><RepeatPicker value={f.repeatability} onChange={v=>inp("repeatability",v)}/></div>}

      <div style={S.sec}><SectionLabel>{t.notes}</SectionLabel></div>
      <div style={{marginBottom:20}}><textarea value={f.notes} onChange={e=>inp("notes",e.target.value)} placeholder={t.anythingMemorable} rows={3} style={{width:"100%",boxSizing:"border-box",resize:"vertical"}}/></div>

      <div style={S.row8}>
        <button onClick={onCancel} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:14,cursor:"pointer"}}>{t.cancel}</button>
        {!isEdit && onSaveAndContinue && (
          <button onClick={saveAndAddAnother} style={{flex:2,padding:"10px",background:"transparent",color:"#F0997B",border:"1px dashed rgba(240,153,123,0.5)",borderRadius:8,fontSize:14,fontWeight:500,cursor:"pointer"}}>{t.saveAndAddAnother}</button>
        )}
        <button onClick={save} style={{flex:2,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:15,fontWeight:500,cursor:"pointer"}}>{t.save}</button>
      </div>
    </div>
  );
}
