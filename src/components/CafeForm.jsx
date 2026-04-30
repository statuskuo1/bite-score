import { useEffect, useRef, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { CAFE_ORDERS, CAFE_ICONS } from "../constants/cafeCatalog.js";
import { INIT_CAFE } from "../data/initialData.js";
import { calcCafeOutOf10, cafeScoreColor, cafeScoreLabel, tasteLabel } from "../utils/scoring.js";
import { S } from "../styles/sharedStyles.js";
import { PlacePicker } from "./PlacePicker.jsx";
import { OrderCombobox } from "./OrderCombobox.jsx";
import { RepeatPicker } from "./RepeatPicker.jsx";
import { SectionLabel } from "./SectionLabel.jsx";
import { FieldLabel } from "./FieldLabel.jsx";
import { FormScoreHeader } from "./FormScoreHeader.jsx";
import { BEAN_ORIGINS, BEAN_ORIGIN_GROUPS } from "../constants/coffeeConstants.js";
import { CityInput } from "./CityInput.jsx";
import { DineWithPicker } from "./DineWithPicker.jsx";
import { getCurrencyForCity, CURRENCY_SYMBOLS } from "../utils/currency.js";


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

function FlavorDropdown({ activeNotes, onToggle, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const count = activeNotes.size;

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"9px 12px", background:"#1E1E1C",
          border:"0.5px solid rgba(255,255,255,0.12)",
          borderRadius:8,
          borderBottomLeftRadius:open?0:8, borderBottomRightRadius:open?0:8,
          cursor:"pointer",
        }}
      >
        <span style={{fontSize:13, color:count===0?"#666663":"#F1EFE8"}}>
          {count===0 ? "Select flavor notes" : `${count} selected`}
        </span>
        <span style={{fontSize:10, color:"#888780", display:"inline-block", transform:open?"rotate(180deg)":"none", transition:"transform 0.15s"}}>▼</span>
      </button>

      {open && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0, zIndex:60,
          background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.12)",
          borderTop:"none", borderRadius:"0 0 8px 8px",
          display:"grid", gridTemplateColumns:"1fr 1fr",
        }}>
          {FLAVOR_NOTES.map(n => {
            const on = activeNotes.has(n.value);
            return (
              <div
                key={n.value}
                onClick={() => onToggle(n.value)}
                style={{
                  display:"flex", alignItems:"center", gap:8,
                  padding:"9px 12px", cursor:"pointer",
                  background:on?"rgba(240,153,123,0.06)":"transparent",
                  borderBottom:"0.5px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{
                  width:16, height:16, borderRadius:4, flexShrink:0,
                  border:"1.5px solid "+(on?"#F0997B":"rgba(255,255,255,0.25)"),
                  background:on?"#F0997B":"transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {on && <span style={{color:"#141413", fontSize:10, lineHeight:1, fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:13, color:on?"#F0997B":"#C8C4BC"}}>{t[n.labelKey]}</span>
              </div>
            );
          })}
        </div>
      )}

      {count > 0 && (
        <div style={{display:"flex", flexWrap:"wrap", gap:6, marginTop:8}}>
          {[...activeNotes].map(val => {
            const note = FLAVOR_NOTES.find(n => n.value === val);
            return (
              <div key={val} style={{
                display:"flex", alignItems:"center", gap:3,
                padding:"3px 6px 3px 10px", borderRadius:20,
                background:"#3C1F13", border:"1px solid rgba(240,153,123,0.35)",
              }}>
                <span style={{fontSize:12, color:"#F0997B"}}>{note ? t[note.labelKey] : val}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onToggle(val); }}
                  style={{background:"none", border:"none", cursor:"pointer", color:"rgba(240,153,123,0.7)", fontSize:15, lineHeight:1, padding:"0 2px", display:"flex", alignItems:"center"}}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const GEO_COLS = [
  [
    { label: "North America", origins: ["Hawaii"] },
    { label: "Latin America", origins: ["Brazil", "Colombia", "Central America"] },
    { label: "Other", origins: ["Blend", "Other"] },
  ],
  [
    { label: "Asia & Pacific", origins: ["Vietnam", "Indonesia", "Papua New Guinea"] },
    { label: "Africa & Middle East", origins: ["Ethiopia", "Kenya", "Yemen"] },
  ],
];

function BeanOriginDropdown({ active, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const count = active.length;

  function toggle(origin) {
    onChange(active.includes(origin) ? active.filter(x => x !== origin) : [...active, origin]);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 12px", background: "#1E1E1C",
          border: "0.5px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          borderBottomLeftRadius: open ? 0 : 8, borderBottomRightRadius: open ? 0 : 8,
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, color: count === 0 ? "#666663" : "#F1EFE8" }}>
          {count === 0 ? "Select origins" : `${count} selected`}
        </span>
        <span style={{ fontSize: 10, color: "#888780", display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0, marginLeft: 6 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60,
          background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.12)",
          borderTop: "none", borderRadius: "0 0 8px 8px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {GEO_COLS.map((col, ci) => (
              <div key={ci} style={{ borderRight: ci === 0 ? "0.5px solid rgba(255,255,255,0.08)" : "none" }}>
                {col.map((section, si) => (
                  <div key={section.label} style={{ borderTop: si > 0 ? "0.5px solid rgba(255,255,255,0.08)" : "none" }}>
                    <div style={{ padding: "6px 10px 2px", fontSize: 9, color: "#555552", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {section.label}
                    </div>
                    {section.origins.map(origin => {
                      const on = active.includes(origin);
                      return (
                        <div
                          key={origin}
                          onClick={() => toggle(origin)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "7px 10px", cursor: "pointer",
                            background: on ? "rgba(240,153,123,0.06)" : "transparent",
                            borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                            border: "1.5px solid " + (on ? "#F0997B" : "rgba(255,255,255,0.25)"),
                            background: on ? "#F0997B" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {on && <span style={{ color: "#141413", fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 12, color: on ? "#F0997B" : "#C8C4BC" }}>{origin}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {count > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {active.map(val => (
            <div key={val} style={{
              display: "flex", alignItems: "center", gap: 3,
              padding: "3px 6px 3px 10px", borderRadius: 20,
              background: "#3C1F13", border: "1px solid rgba(240,153,123,0.35)",
            }}>
              <span style={{ fontSize: 12, color: "#F0997B" }}>{val}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggle(val); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(240,153,123,0.7)", fontSize: 15, lineHeight: 1, padding: "0 2px", display: "flex", alignItems: "center" }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CafeForm({initial,initialDineWith=[],onSave,onSaveAndContinue,onCancel,onFormChange,weights,addType,setAddType,existingCafes,existingCities,places,onPlaceCreated,user,tasteBudIds}) {
  const {t} = useLang();
  const [f, setF] = useState({...INIT_CAFE, ...initial});
  const [sub, setSub] = useState(false);
  const [dineWith, setDineWith] = useState(initialDineWith);
  const [currencyCode, setCurrencyCode] = useState(() => initial.currency_code || getCurrencyForCity(initial.city || ""));
  const currSymbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  const inp = (k, v) => setF(p => ({...p, [k]: v}));
  const score = calcCafeOutOf10(+f.taste,+f.cost,+f.portions,+f.wait,f.useR,+f.repeatability,weights,currencyCode);
  const isEdit = !!initial.id;
  useEffect(() => {
    if (!isEdit) onFormChange?.({ addType: "cafe", f, dineWith });
  }, [f, dineWith]); // eslint-disable-line react-hooks/exhaustive-deps

  const cafesList = existingCafes || [];
  const activePlaceId = f.placeId || null;
  const cafeName = (f.name || "").trim().toLowerCase();
  // Past orders from this user at this specific cafe — matched by placeId when
  // available, otherwise by cafe name. Never crosses into other cafes.
  const pastOrdersAtCafe = cafeName
    ? cafesList.filter(e =>
        e.order && (
          (activePlaceId && e.placeId === activePlaceId) ||
          e.name?.trim().toLowerCase() === cafeName
        )
      ).map(e => e.order)
    : [];

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
      dineWith,
      currency_code: currencyCode,
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

  const toggleNote = (n) => {
    const cur = Array.isArray(f.flavorNotes) ? f.flavorNotes : [];
    inp("flavorNotes", cur.includes(n) ? cur.filter(x=>x!==n) : [...cur, n]);
  };
  const activeNotes = new Set(Array.isArray(f.flavorNotes) ? f.flavorNotes : []);


  return (
    <div style={{...S.card,marginBottom:12}}>
      <SectionLabel>{t.theBasics}</SectionLabel>
      <FormScoreHeader
        addType={addType}
        setAddType={setAddType}
        score={score}
        scoreColor={cafeScoreColor(score)}
        scoreLabel={cafeScoreLabel(score,t)}
      />
      <div style={{marginBottom:16}}>
        <FieldLabel>{t.city||"City"} *</FieldLabel>
        <CityInput value={f.city||""} onChange={val=>{ inp("city",val); setCurrencyCode(getCurrencyForCity(val)); }} existingCities={existingCities} />
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
                  beanRegion: (Array.isArray(p.beanRegion)&&p.beanRegion.length>0)?p.beanRegion:(Array.isArray(last.beanRegion)?last.beanRegion:[]),
                  portions: last.portions || 1,
                }));
              }
            }
          }}
        />
        {sub&&!f.name&&<div style={S.err}>Required</div>}
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
          placeholder="Select an order"
        />
      </div>

      {f.category==="Coffee" && (
        <details style={{marginBottom:16}}>
          <summary style={{cursor:"pointer",userSelect:"none",listStyle:"none",display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:20,background:"#252523",border:"1px solid rgba(255,255,255,0.12)",fontSize:13,color:"#F1EFE8",fontWeight:500,width:"fit-content"}}>
            {t.coffeeDetails}
            <span style={{fontSize:11,color:"#888780",fontWeight:400}}>({t.optional||"optional"})</span>
            <span style={{fontSize:10,color:"#888780"}}>▾</span>
          </summary>
          <div style={{marginTop:10}}>
            <FieldLabel>{t.roast}</FieldLabel>
            <div style={S.row8}>
              {ROAST_LEVELS.map(r=>(
                <div key={r.value} onClick={()=>inp("roast", f.roast===r.value?"":r.value)} style={{flex:1,padding:"6px",borderRadius:8,textAlign:"center",cursor:"pointer",fontSize:11,background:f.roast===r.value?"#3C1F13":"#1E1E1C",border:"1px solid "+(f.roast===r.value?"#F0997B":"rgba(255,255,255,0.1)"),color:f.roast===r.value?"#F0997B":"#888780"}}>{t[r.labelKey]}</div>
              ))}
            </div>
          </div>
          <TastingSlider field="acidity" label={t.acidity} leftLabel={t.acidityLow} rightLabel={t.acidityHigh}/>
          <TastingSlider field="body" label={t.body} leftLabel={t.bodyLow} rightLabel={t.bodyHigh}/>
          <TastingSlider field="sweetness" label={t.sweetness} leftLabel={t.sweetnessLow} rightLabel={t.sweetnessHigh}/>

          <div style={{marginTop:12}}>
            <FieldLabel>{t.flavorNotes}</FieldLabel>
            <FlavorDropdown activeNotes={activeNotes} onToggle={toggleNote} t={t}/>
          </div>

          <div style={{marginTop:12}}>
            <FieldLabel>{t.beanRegion}</FieldLabel>
            <BeanOriginDropdown
              active={Array.isArray(f.beanRegion) ? f.beanRegion : (f.beanRegion ? [f.beanRegion] : [])}
              onChange={v => inp("beanRegion", v)}
            />
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
        <div style={S.f1}>
          <FieldLabel>{t.totalCost}</FieldLabel>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#888780",pointerEvents:"none",lineHeight:1}}>{currSymbol||"$"}</span>
            <input type="number" value={f.cost} onChange={e=>inp("cost",e.target.value)} style={{...S.wb,paddingLeft:8+(currSymbol||"$").length*8+6}}/>
          </div>
          {sub&&!f.cost&&<div style={S.err}>Required</div>}
        </div>
        <div style={S.f1}><FieldLabel>{t.portions}</FieldLabel><input type="number" min="0.5" step="0.5" value={f.portions} onChange={e=>inp("portions",e.target.value)} style={S.wb}/></div>
        <div style={S.f1}><FieldLabel>{t.waitMins}</FieldLabel><input type="number" min="0" step="1" value={f.wait} onChange={e=>inp("wait",e.target.value)} style={S.wb}/></div>
      </div>

      <div style={S.sec}><SectionLabel>{t.repeatability}</SectionLabel></div>
      <div style={S.mb16}><FieldLabel>Repeatability — <span style={{color:"#F0997B"}}>{"⭐".repeat(f.repeatability)||"✕"}</span></FieldLabel><RepeatPicker value={f.repeatability} onChange={v=>inp("repeatability",v)}/></div>

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
