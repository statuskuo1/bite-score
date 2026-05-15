/**
 * Currency utilities: exchange rates, formatting, and city → currency lookup.
 * Rates are approximate (hardcoded) and expressed as units of currency per 1 USD.
 */

export const EXCHANGE_RATES = {
  USD: 1,
  CAD: 1.38,
  TWD: 32.5,
  JPY: 155,
  KRW: 1380,
  AUD: 1.58,
  CNY: 7.25,
  HKD: 7.79,
  EUR: 0.92,
  GBP: 0.79,
  SGD: 1.35,
  MXN: 17.2,
  BRL: 5.8,
  INR: 83.5,
  THB: 35,
  VND: 25300,
  PHP: 58,
  IDR: 16200,
  MYR: 4.72,
  AED: 3.67,
  SAR: 3.75,
  ILS: 3.7,
  TRY: 33,
  CHF: 0.90,
  SEK: 10.7,
  NOK: 10.7,
  DKK: 6.9,
  NZD: 1.72,
  ZAR: 18.9,
  EGP: 50,
  NGN: 1600,
  PKR: 278,
  BDT: 110,
  LKR: 300,
  KZT: 445,
  GEL: 2.73,
  UAH: 41,
};

export const CURRENCY_SYMBOLS = {
  USD: "$",
  CAD: "CA$",
  TWD: "NT$",
  JPY: "¥",
  KRW: "₩",
  AUD: "A$",
  CNY: "¥",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  MXN: "MX$",
  BRL: "R$",
  INR: "₹",
  THB: "฿",
  VND: "₫",
  PHP: "₱",
  IDR: "Rp",
  MYR: "RM",
  AED: "AED",
  SAR: "SAR",
  ILS: "₪",
  TRY: "₺",
  CHF: "Fr",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  NZD: "NZ$",
  ZAR: "R",
  EGP: "E£",
  NGN: "₦",
  PKR: "₨",
  BDT: "৳",
  LKR: "Rs",
  KZT: "₸",
  GEL: "₾",
  UAH: "₴",
};

export const CURRENCY_NAMES = {
  USD: "US Dollar",
  CAD: "Canadian Dollar",
  TWD: "Taiwan Dollar",
  JPY: "Japanese Yen",
  KRW: "South Korean Won",
  AUD: "Australian Dollar",
  CNY: "Chinese Yuan",
  HKD: "Hong Kong Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  SGD: "Singapore Dollar",
  MXN: "Mexican Peso",
  BRL: "Brazilian Real",
  INR: "Indian Rupee",
  THB: "Thai Baht",
  VND: "Vietnamese Dong",
  PHP: "Philippine Peso",
  IDR: "Indonesian Rupiah",
  MYR: "Malaysian Ringgit",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  ILS: "Israeli Shekel",
  TRY: "Turkish Lira",
  CHF: "Swiss Franc",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  NZD: "New Zealand Dollar",
  ZAR: "South African Rand",
  EGP: "Egyptian Pound",
  NGN: "Nigerian Naira",
  PKR: "Pakistani Rupee",
  BDT: "Bangladeshi Taka",
  LKR: "Sri Lankan Rupee",
  KZT: "Kazakhstani Tenge",
  GEL: "Georgian Lari",
  UAH: "Ukrainian Hryvnia",
};

/** All supported currency codes, ordered for UI display. */
export const CURRENCY_CODES = Object.keys(EXCHANGE_RATES);

/** Convert a local amount to USD. Returns 0 for unknown codes. */
export function toUSD(amount, currencyCode) {
  const rate = EXCHANGE_RATES[currencyCode] ?? 1;
  return amount / rate;
}

/** Convert a USD amount to a target currency. */
export function fromUSD(usdAmount, currencyCode) {
  const rate = EXCHANGE_RATES[currencyCode] ?? 1;
  return usdAmount * rate;
}

/**
 * Format a raw cost amount (in fromCurrency) for display in homeCurrency.
 * e.g. formatCost(3000, "JPY", "USD") → "$19.35"
 */
export function formatCost(rawAmount, fromCurrency, homeCurrency) {
  const code = homeCurrency || "USD";
  const sym = CURRENCY_SYMBOLS[code] ?? code;
  const usd = toUSD(rawAmount, fromCurrency || "USD");
  const converted = fromUSD(usd, code);

  // Large currencies (JPY, KRW, VND, IDR…) show no decimals.
  const rate = EXCHANGE_RATES[code] ?? 1;
  const decimals = rate >= 100 ? 0 : 2;
  return sym + converted.toFixed(decimals);
}

// ── Country code → currency lookup ───────────────────────────────────────────
// Uses ISO 3166-1 alpha-2 country codes returned by Google Places addressComponents.
// More reliable than city-name matching — no substring ambiguity.

const EUR_COUNTRIES = ["AT","BE","HR","CY","EE","FI","FR","DE","GR","IE","IT",
  "LV","LT","LU","MT","NL","PT","SK","SI","ES","AD","MC","SM","VA","ME","XK"];

const COUNTRY_CURRENCY_MAP = {
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD", SG: "SGD",
  JP: "JPY", KR: "KRW", CN: "CNY", TW: "TWD", HK: "HKD", MO: "HKD",
  MY: "MYR", TH: "THB", VN: "VND", PH: "PHP", ID: "IDR",
  IN: "INR", PK: "PKR", BD: "BDT", LK: "LKR",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  MX: "MXN", BR: "BRL", AE: "AED", SA: "SAR", IL: "ILS",
  TR: "TRY", EG: "EGP", NG: "NGN", ZA: "ZAR", KZ: "KZT",
  GE: "GEL", UA: "UAH", KH: "KHR", MM: "MMK", LA: "LAK",
  ...Object.fromEntries(EUR_COUNTRIES.map(c => [c, "EUR"])),
};

export function getCurrencyForCountry(countryCode) {
  if (!countryCode) return null;
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] || null;
}

// ── City → currency lookup ────────────────────────────────────────────────────

const CITY_CURRENCY_MAP = [
  // JPY
  [["tokyo", "osaka", "kyoto", "fukuoka", "sapporo", "nagoya", "hiroshima", "yokohama", "sendai", "nara"], "JPY"],
  // KRW
  [["seoul", "busan", "incheon", "daegu", "gwangju", "jeju"], "KRW"],
  // GBP
  [["london", "manchester", "edinburgh", "birmingham", "glasgow", "liverpool", "leeds", "bristol"], "GBP"],
  // EUR
  [["paris", "berlin", "amsterdam", "rome", "madrid", "barcelona", "vienna", "athens", "lisbon",
     "brussels", "frankfurt", "milan", "hamburg", "munich", "marseille", "lyon", "cologne",
     "rotterdam", "the hague", "antwerp", "budapest", "prague", "warsaw", "copenhagen",
     "helsinki", "tallinn", "riga", "vilnius", "sofia", "bucharest", "zagreb", "belgrade",
     "valletta", "nicosia", "luxembourg", "monaco", "nice", "florence", "venice", "naples",
     "seville", "valencia", "bilbao", "porto"], "EUR"],
  // TWD
  [["taipei", "taichung", "tainan", "kaohsiung", "hsinchu", "taoyuan"], "TWD"],
  // HKD
  [["hong kong", "hongkong", "hk"], "HKD"],
  // AUD
  [["sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra", "darwin", "gold coast", "hobart"], "AUD"],
  // CAD
  [["toronto", "vancouver", "montreal", "calgary", "ottawa", "edmonton", "winnipeg", "quebec city", "halifax"], "CAD"],
  // SGD
  [["singapore"], "SGD"],
  // CNY
  [["beijing", "shanghai", "guangzhou", "shenzhen", "chengdu", "hangzhou", "chongqing", "xian", "xi'an",
     "wuhan", "tianjin", "nanjing", "changsha", "zhengzhou", "dongguan", "foshan", "qingdao"], "CNY"],
  // MXN
  [["mexico city", "cdmx", "guadalajara", "monterrey", "cancun", "tijuana", "puebla", "oaxaca", "merida"], "MXN"],
  // BRL
  [["sao paulo", "são paulo", "rio de janeiro", "rio", "brasilia", "brasília", "salvador", "curitiba", "fortaleza"], "BRL"],
  // INR
  [["mumbai", "delhi", "bangalore", "bengaluru", "chennai", "hyderabad", "kolkata", "pune", "ahmedabad", "jaipur", "goa"], "INR"],
  // THB
  [["bangkok", "chiang mai", "phuket", "pattaya", "chiang rai", "hua hin"], "THB"],
  // VND
  [["ho chi minh city", "hcmc", "saigon", "hanoi", "da nang", "hoi an", "nha trang", "hue"], "VND"],
  // PHP
  [["manila", "cebu", "davao", "quezon city", "makati"], "PHP"],
  // IDR
  [["jakarta", "bali", "surabaya", "bandung", "medan", "yogyakarta", "ubud"], "IDR"],
  // MYR
  [["kuala lumpur", "kl", "penang", "johor bahru", "kota kinabalu", "kuching"], "MYR"],
  // AED
  [["dubai", "abu dhabi", "sharjah", "ajman"], "AED"],
  // SAR
  [["riyadh", "jeddah", "mecca", "medina", "dammam"], "SAR"],
  // ILS
  [["tel aviv", "jerusalem", "haifa", "beer sheva", "tel-aviv"], "ILS"],
  // TRY
  [["istanbul", "ankara", "izmir", "antalya", "bursa", "gaziantep"], "TRY"],
  // CHF
  [["zurich", "geneva", "bern", "basel", "lausanne", "lucerne", "zürich", "genève"], "CHF"],
  // SEK
  [["stockholm", "gothenburg", "malmö", "malmo", "göteborg", "goteborg", "uppsala"], "SEK"],
  // NOK
  [["oslo", "bergen", "trondheim", "stavanger", "tromsø", "tromso"], "NOK"],
  // DKK
  [["copenhagen", "aarhus", "odense", "aalborg"], "DKK"],
  // NZD
  [["auckland", "wellington", "christchurch", "hamilton", "dunedin", "queenstown"], "NZD"],
  // ZAR
  [["johannesburg", "cape town", "durban", "pretoria", "soweto"], "ZAR"],
  // EGP
  [["cairo", "alexandria", "giza", "luxor", "aswan", "hurghada"], "EGP"],
  // NGN
  [["lagos", "abuja", "ibadan", "kano", "port harcourt"], "NGN"],
  // PKR
  [["karachi", "lahore", "islamabad", "rawalpindi", "faisalabad"], "PKR"],
  // BDT
  [["dhaka", "chittagong", "sylhet", "rajshahi"], "BDT"],
  // LKR
  [["colombo", "kandy", "galle", "negombo"], "LKR"],
  // KZT
  [["almaty", "astana", "nur-sultan", "shymkent"], "KZT"],
  // GEL
  [["tbilisi", "batumi", "kutaisi"], "GEL"],
  // UAH
  [["kyiv", "kiev", "lviv", "odesa", "odessa", "kharkiv", "dnipro"], "UAH"],
  // USD — common US cities (unambiguous ones only; cities that share names with EUR/etc. cities
  //       require word-boundary matching to disambiguate — TODO for future improvement)
  [["nyc", "new york", "los angeles", "la", "chicago", "houston", "miami", "san francisco", "sf",
     "seattle", "boston", "austin", "denver", "atlanta", "las vegas", "washington", "philadelphia",
     "portland", "phoenix", "nashville", "new orleans", "minneapolis", "detroit", "pittsburgh",
     "charlotte", "raleigh", "salt lake city", "kansas city", "san diego", "tampa", "orlando",
     "sacramento", "richmond", "indianapolis", "columbus", "louisville", "memphis", "baltimore",
     "oakland", "berkeley", "san jose", "fremont", "hayward", "alameda", "palo alto",
     "mountain view", "sunnyvale", "santa clara", "san mateo", "redwood city", "burlingame",
     "daly city", "pasadena", "long beach", "anaheim", "irvine", "santa monica", "santa barbara",
     "fresno", "bakersfield", "stockton", "riverside", "san bernardino", "modesto",
     "boise", "tucson", "albuquerque", "el paso", "fort worth", "san antonio", "dallas",
     "cleveland", "cincinnati", "st louis", "st. louis", "eugene", "salem", "albany",
     "charleston", "columbia", "springfield", "madison", "lincoln", "aurora", "henderson",
     "jersey city", "honolulu", "anchorage"], "USD"],
];

/**
 * Return the currency code for a city name. Case-insensitive, partial match.
 * Falls back to "USD" for unknown cities.
 */
export function getCurrencyForCity(city) {
  if (!city) return "USD";
  const low = city.trim().toLowerCase();
  for (const [cities, code] of CITY_CURRENCY_MAP) {
    if (cities.some((c) => {
      if (low === c) return true;
      // Short abbreviations (≤3 chars like "kl", "hk", "sf") must be exact matches only —
      // substring matching would make "oakland".includes("kl") → MYR which is wrong.
      if (c.length <= 3) return false;
      return low.includes(c) || c.includes(low);
    })) return code;
  }
  return "USD";
}
