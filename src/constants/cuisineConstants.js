export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const CUISINE_REGIONS = {
  "East Asia":["Chinese","Cantonese","Sichuan","Shanghainese","Hunanese","Japanese","Korean","Taiwanese","Mongolian","Tibetan"],
  "Southeast Asia":["Thai","Vietnamese","Filipino","Indonesian","Malaysian","Singaporean","Burmese","Cambodian","Laotian","Bruneian"],
  "South Asia":["Indian","Pakistani","Bangladeshi","Sri Lankan","Nepali","Maldivian","Bhutanese"],
  "Central Asia":["Kazakh","Uzbek","Kyrgyz","Tajik","Turkmen","Afghan"],
  "Middle East":["Lebanese","Turkish","Iranian","Israeli","Syrian","Iraqi","Jordanian","Saudi","Yemeni","Omani","Emirati","Kuwaiti","Palestinian"],
  "North Africa":["Egyptian","Moroccan","Tunisian","Algerian","Libyan"],
  "West Africa":["Nigerian","Ghanaian","Senegalese","Ivorian","Cameroonian","Malian","Guinean"],
  "East Africa":["Ethiopian","Eritrean","Kenyan","Tanzanian","Ugandan","Somali","Rwandan"],
  "Southern Africa":["South African","Zimbabwean","Mozambican","Zambian","Botswanan"],
  "Western Europe":["French","Italian","Spanish","Portuguese","Greek","British","Irish","Belgian","Dutch","Swiss"],
  "Central Europe":["German","Austrian","Polish","Czech","Slovak","Hungarian","Romanian","Bulgarian"],
  "Northern Europe":["Swedish","Norwegian","Danish","Finnish","Icelandic","Estonian","Latvian","Lithuanian"],
  "Eastern Europe":["Russian","Ukrainian","Georgian","Armenian","Azerbaijani","Belarusian","Moldovan"],
  "North America":["American","Canadian","Mexican","Cajun","Soul Food","Tex-Mex","Hawaiian"],
  "Central America & Caribbean":["Guatemalan","Cuban","Puerto Rican","Jamaican","Haitian","Dominican","Trinidadian","Belizean","Costa Rican"],
  "South America":["Brazilian","Peruvian","Argentine","Colombian","Venezuelan","Chilean","Ecuadorian","Bolivian","Uruguayan","Paraguayan"],
  "Oceania":["Australian","New Zealander","Fijian","Samoan","Tongan","Papua New Guinean"],
};

export const ALL_CUISINES = [...new Set(Object.values(CUISINE_REGIONS).flat())].sort();

export const REGION_MAP = {};
Object.entries(CUISINE_REGIONS).forEach(([r,cs]) => cs.forEach(c => { REGION_MAP[c] = r; }));

export const FLAGS = {
  "Japanese":"🇯🇵","Korean":"🇰🇷","Chinese":"🇨🇳","Cantonese":"🇨🇳","Sichuan":"🇨🇳","Shanghainese":"🇨🇳","Hunanese":"🇨🇳","Taiwanese":"🇹🇼","Mongolian":"🇲🇳","Tibetan":"🇨🇳",
  "Thai":"🇹🇭","Vietnamese":"🇻🇳","Filipino":"🇵🇭","Indonesian":"🇮🇩","Malaysian":"🇲🇾","Singaporean":"🇸🇬","Burmese":"🇲🇲","Cambodian":"🇰🇭","Laotian":"🇱🇦","Bruneian":"🇧🇳",
  "Indian":"🇮🇳","Pakistani":"🇵🇰","Bangladeshi":"🇧🇩","Sri Lankan":"🇱🇰","Nepali":"🇳🇵","Maldivian":"🇲🇻","Bhutanese":"🇧🇹",
  "Kazakh":"🇰🇿","Uzbek":"🇺🇿","Kyrgyz":"🇰🇬","Tajik":"🇹🇯","Turkmen":"🇹🇲","Afghan":"🇦🇫",
  "Lebanese":"🇱🇧","Turkish":"🇹🇷","Iranian":"🇮🇷","Israeli":"🇮🇱","Syrian":"🇸🇾","Iraqi":"🇮🇶","Jordanian":"🇯🇴","Saudi":"🇸🇦","Yemeni":"🇾🇪","Omani":"🇴🇲","Emirati":"🇦🇪","Kuwaiti":"🇰🇼","Palestinian":"🇵🇸",
  "Egyptian":"🇪🇬","Moroccan":"🇲🇦","Tunisian":"🇹🇳","Algerian":"🇩🇿","Libyan":"🇱🇾",
  "Nigerian":"🇳🇬","Ghanaian":"🇬🇭","Senegalese":"🇸🇳","Ivorian":"🇨🇮","Cameroonian":"🇨🇲","Malian":"🇲🇱","Guinean":"🇬🇳",
  "Ethiopian":"🇪🇹","Eritrean":"🇪🇷","Kenyan":"🇰🇪","Tanzanian":"🇹🇿","Ugandan":"🇺🇬","Somali":"🇸🇴","Rwandan":"🇷🇼",
  "South African":"🇿🇦","Zimbabwean":"🇿🇼","Mozambican":"🇲🇿","Zambian":"🇿🇲","Botswanan":"🇧🇼",
  "French":"🇫🇷","Italian":"🇮🇹","Spanish":"🇪🇸","Portuguese":"🇵🇹","Greek":"🇬🇷","British":"🇬🇧","Irish":"🇮🇪","Belgian":"🇧🇪","Dutch":"🇳🇱","Swiss":"🇨🇭",
  "German":"🇩🇪","Austrian":"🇦🇹","Polish":"🇵🇱","Czech":"🇨🇿","Slovak":"🇸🇰","Hungarian":"🇭🇺","Romanian":"🇷🇴","Bulgarian":"🇧🇬",
  "Swedish":"🇸🇪","Norwegian":"🇳🇴","Danish":"🇩🇰","Finnish":"🇫🇮","Icelandic":"🇮🇸","Estonian":"🇪🇪","Latvian":"🇱🇻","Lithuanian":"🇱🇹",
  "Russian":"🇷🇺","Ukrainian":"🇺🇦","Georgian":"🇬🇪","Armenian":"🇦🇲","Azerbaijani":"🇦🇿","Belarusian":"🇧🇾","Moldovan":"🇲🇩",
  "American":"🇺🇸","Canadian":"🇨🇦","Mexican":"🇲🇽","Cajun":"🇺🇸","Soul Food":"🇺🇸","Tex-Mex":"🇺🇸","Hawaiian":"🇺🇸",
  "Guatemalan":"🇬🇹","Cuban":"🇨🇺","Puerto Rican":"🇵🇷","Jamaican":"🇯🇲","Haitian":"🇭🇹","Dominican":"🇩🇴","Trinidadian":"🇹🇹","Belizean":"🇧🇿","Costa Rican":"🇨🇷",
  "Brazilian":"🇧🇷","Peruvian":"🇵🇪","Argentine":"🇦🇷","Colombian":"🇨🇴","Venezuelan":"🇻🇪","Chilean":"🇨🇱","Ecuadorian":"🇪🇨","Bolivian":"🇧🇴","Uruguayan":"🇺🇾","Paraguayan":"🇵🇾",
  "Australian":"🇦🇺","New Zealander":"🇳🇿","Fijian":"🇫🇯","Samoan":"🇼🇸","Tongan":"🇹🇴","Papua New Guinean":"🇵🇬",
};

export const CITY_EMOJI = {
  "NYC":"🗽","New York":"🗽","New York City":"🗽",
  "Tokyo":"🗼","Kyoto":"⛩️","Osaka":"🏯",
  "Paris":"🗼","London":"🎡","Rome":"🏛️","Barcelona":"🥘",
  "Lisbon":"🇵🇹","Porto":"🇵🇹",
  "Seoul":"🇰🇷","Taipei":"🇹🇼","Hong Kong":"🇭🇰","Shanghai":"🇨🇳","Beijing":"🇨🇳",
  "Bangkok":"🇹🇭","Singapore":"🇸🇬","Bali":"🇮🇩","Kuala Lumpur":"🇲🇾",
  "Sydney":"🦘","Melbourne":"🇦🇺",
  "Mexico City":"🇲🇽","Buenos Aires":"🇦🇷","São Paulo":"🇧🇷",
  "Dubai":"🇦🇪","Istanbul":"🇹🇷","Athens":"🇬🇷","Amsterdam":"🇳🇱",
  "Berlin":"🇩🇪","Vienna":"🇦🇹","Copenhagen":"🇩🇰","Stockholm":"🇸🇪",
  "LA":"🌴","Los Angeles":"🌴","San Francisco":"🌉","Chicago":"🌃","Miami":"🌊","Boston":"🦞",
  "Montreal":"🇨🇦","Toronto":"🇨🇦","Vancouver":"🇨🇦",
};
export function cityEmoji(city) { return CITY_EMOJI[city] || "📍"; }
export const REGION_COLORS = {
  "East Asia":"#F0997B","Southeast Asia":"#EF9F27","South Asia":"#97C459","Western Europe":"#5B9BD5","Eastern Europe":"#AFA9EC","Central Europe":"#7F77DD","Northern Europe":"#9FE1CB",
  "Middle East":"#F5C4B3","North Africa":"#FAC775","West Africa":"#F09595","East Africa":"#E24B4A","Southern Africa":"#D85A30",
  "North America":"#1D9E75","Central America & Caribbean":"#0F6E56","South America":"#639922","Oceania":"#185FA5","Other":"#888780",
};
