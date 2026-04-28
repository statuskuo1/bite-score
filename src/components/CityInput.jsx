import { useState, useRef, useEffect } from "react";

/**
 * Canonical city names + alias map.
 *
 * Every key is a lowercase alias; every value is the canonical display name.
 * When a user types "nyc" or "new york" they get "New York City" stored.
 *
 * Expand as needed — this covers major US + international cities.
 */
const CITY_ALIASES = {
  // ── US ─────────────────────────────────────────────────────────────────
  "nyc":                "New York City",
  "new york":           "New York City",
  "new york city":      "New York City",
  "manhattan":          "New York City",
  "brooklyn":           "New York City",
  "queens":             "New York City",
  "bronx":              "New York City",
  "staten island":      "New York City",

  "la":                 "Los Angeles",
  "los angeles":        "Los Angeles",
  "hollywood":          "Los Angeles",
  "west hollywood":     "Los Angeles",
  "santa monica":       "Los Angeles",
  "beverly hills":      "Los Angeles",

  "sf":                 "San Francisco",
  "san francisco":      "San Francisco",
  "san fran":           "San Francisco",
  "frisco":             "San Francisco",

  "chi":                "Chicago",
  "chicago":            "Chicago",
  "chitown":            "Chicago",

  "dc":                 "Washington DC",
  "washington":         "Washington DC",
  "washington dc":      "Washington DC",
  "washington d.c.":    "Washington DC",

  "houston":            "Houston",
  "dallas":             "Dallas",
  "austin":             "Austin",
  "san antonio":        "San Antonio",

  "philly":             "Philadelphia",
  "philadelphia":       "Philadelphia",

  "phoenix":            "Phoenix",
  "san diego":          "San Diego",
  "san jose":           "San Jose",

  "boston":              "Boston",
  "seattle":            "Seattle",
  "portland":           "Portland",
  "denver":             "Denver",
  "miami":              "Miami",
  "atlanta":            "Atlanta",
  "atl":                "Atlanta",
  "detroit":            "Detroit",
  "minneapolis":        "Minneapolis",
  "nashville":          "Nashville",
  "new orleans":        "New Orleans",
  "nola":               "New Orleans",
  "las vegas":          "Las Vegas",
  "vegas":              "Las Vegas",
  "honolulu":           "Honolulu",
  "hawaii":             "Honolulu",
  "pittsburgh":         "Pittsburgh",
  "raleigh":            "Raleigh",
  "charlotte":          "Charlotte",
  "tampa":              "Tampa",
  "orlando":            "Orlando",
  "salt lake city":     "Salt Lake City",
  "slc":                "Salt Lake City",
  "columbus":           "Columbus",
  "indianapolis":       "Indianapolis",
  "indy":               "Indianapolis",
  "milwaukee":          "Milwaukee",
  "kansas city":        "Kansas City",
  "st louis":           "St. Louis",
  "st. louis":          "St. Louis",
  "baltimore":          "Baltimore",
  "richmond":           "Richmond",
  "sacramento":         "Sacramento",
  "oakland":            "Oakland",
  "jersey city":        "Jersey City",
  "hoboken":            "Hoboken",

  // ── Canada ─────────────────────────────────────────────────────────────
  "toronto":            "Toronto",
  "vancouver":          "Vancouver",
  "montreal":           "Montreal",
  "montréal":           "Montreal",
  "calgary":            "Calgary",
  "ottawa":             "Ottawa",

  // ── Mexico ─────────────────────────────────────────────────────────────
  "mexico city":        "Mexico City",
  "cdmx":               "Mexico City",
  "ciudad de mexico":   "Mexico City",
  "cancun":             "Cancún",
  "cancún":             "Cancún",
  "guadalajara":        "Guadalajara",

  // ── Europe ─────────────────────────────────────────────────────────────
  "london":             "London",
  "paris":              "Paris",
  "berlin":             "Berlin",
  "madrid":             "Madrid",
  "barcelona":          "Barcelona",
  "rome":               "Rome",
  "roma":               "Rome",
  "milan":              "Milan",
  "milano":             "Milan",
  "amsterdam":          "Amsterdam",
  "vienna":             "Vienna",
  "wien":               "Vienna",
  "prague":             "Prague",
  "praha":              "Prague",
  "lisbon":             "Lisbon",
  "lisboa":             "Lisbon",
  "copenhagen":         "Copenhagen",
  "stockholm":          "Stockholm",
  "oslo":               "Oslo",
  "helsinki":           "Helsinki",
  "dublin":             "Dublin",
  "edinburgh":          "Edinburgh",
  "munich":             "Munich",
  "münchen":            "Munich",
  "zurich":             "Zurich",
  "zürich":             "Zurich",
  "geneva":             "Geneva",
  "brussels":           "Brussels",
  "athens":             "Athens",
  "istanbul":           "Istanbul",
  "budapest":           "Budapest",
  "warsaw":             "Warsaw",
  "krakow":             "Kraków",
  "kraków":             "Kraków",

  // ── Asia ───────────────────────────────────────────────────────────────
  "tokyo":              "Tokyo",
  "osaka":              "Osaka",
  "kyoto":              "Kyoto",
  "seoul":              "Seoul",
  "busan":              "Busan",
  "beijing":            "Beijing",
  "shanghai":           "Shanghai",
  "hong kong":          "Hong Kong",
  "hk":                 "Hong Kong",
  "taipei":             "Taipei",
  "bangkok":            "Bangkok",
  "bkk":                "Bangkok",
  "singapore":          "Singapore",
  "sg":                 "Singapore",
  "kuala lumpur":       "Kuala Lumpur",
  "kl":                 "Kuala Lumpur",
  "manila":             "Manila",
  "jakarta":            "Jakarta",
  "ho chi minh":        "Ho Chi Minh City",
  "ho chi minh city":   "Ho Chi Minh City",
  "saigon":             "Ho Chi Minh City",
  "hanoi":              "Hanoi",
  "mumbai":             "Mumbai",
  "bombay":             "Mumbai",
  "delhi":              "Delhi",
  "new delhi":          "Delhi",
  "bangalore":          "Bangalore",
  "bengaluru":          "Bangalore",

  // ── Middle East ────────────────────────────────────────────────────────
  "dubai":              "Dubai",
  "abu dhabi":          "Abu Dhabi",
  "tel aviv":           "Tel Aviv",
  "jerusalem":          "Jerusalem",
  "doha":               "Doha",
  "riyadh":             "Riyadh",

  // ── Oceania ────────────────────────────────────────────────────────────
  "sydney":             "Sydney",
  "melbourne":          "Melbourne",
  "brisbane":           "Brisbane",
  "auckland":           "Auckland",

  // ── South America ──────────────────────────────────────────────────────
  "sao paulo":          "São Paulo",
  "são paulo":          "São Paulo",
  "rio":                "Rio de Janeiro",
  "rio de janeiro":     "Rio de Janeiro",
  "buenos aires":       "Buenos Aires",
  "bogota":             "Bogotá",
  "bogotá":             "Bogotá",
  "lima":               "Lima",
  "santiago":           "Santiago",
  "medellin":           "Medellín",
  "medellín":           "Medellín",

  // ── Africa ─────────────────────────────────────────────────────────────
  "cairo":              "Cairo",
  "cape town":          "Cape Town",
  "johannesburg":       "Johannesburg",
  "nairobi":            "Nairobi",
  "lagos":              "Lagos",
  "marrakech":          "Marrakech",
  "marrakesh":          "Marrakech",
  "casablanca":         "Casablanca",
  "accra":              "Accra",
};

/** Deduplicated list of canonical city names for dropdown display. */
const CANONICAL_CITIES = [...new Set(Object.values(CITY_ALIASES))].sort();

/**
 * Resolve a typed string to its canonical city name.
 * Returns the canonical name if found, otherwise returns the input trimmed.
 */
export function resolveCity(input) {
  if (!input || !input.trim()) return "";
  const key = input.trim().toLowerCase();
  return CITY_ALIASES[key] || input.trim();
}

/**
 * CityInput — autocomplete dropdown for city names with alias resolution.
 *
 * Usage mirrors CuisineInput:
 *   <CityInput value={f.city} onChange={val => inp("city", val)} placeholder="e.g. NYC, Tokyo" />
 *
 * On blur or selection, the value is normalized to the canonical name.
 */
export function CityInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);

  const q = (value || "").trim().toLowerCase();
  const filtered = q.length > 0
    ? CANONICAL_CITIES.filter(c => c.toLowerCase().includes(q))
        // Also match any alias that starts with the query
        .concat(
          Object.entries(CITY_ALIASES)
            .filter(([alias]) => alias.startsWith(q))
            .map(([, canonical]) => canonical)
        )
        // Deduplicate and cap
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 12)
    : [];

  useEffect(() => {
    function h(e) {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleBlur() {
    // Normalize on blur — small delay so click on dropdown can fire first
    setTimeout(() => {
      if (value && value.trim()) {
        const resolved = resolveCity(value);
        if (resolved !== value) onChange(resolved);
      }
    }, 200);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={value || ""}
        onChange={e => { onChange(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        onBlur={handleBlur}
        placeholder={placeholder || "e.g. NYC, Tokyo, London"}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      {show && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.15)",
          borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: "auto", marginTop: 4
        }}>
          {filtered.map(city => (
            <div
              key={city}
              onMouseDown={() => { onChange(city); setShow(false); }}
              style={{ padding: "8px 12px", fontSize: 13, color: "#F1EFE8", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#2C2C2A"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              📍 {city}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
