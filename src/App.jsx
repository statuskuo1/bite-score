import { useState, useReducer, useRef, useEffect, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";

const LangContext = createContext({t:{}});

const useLang = () => useContext(LangContext);

const supabase = createClient(
  "https://degnfgfmztzlzzptmygs.supabase.co",
  "sb_publishable_OFJIXBL_IWP7GqdSZ-Dleg_AYM4dKpw"
);

// ── Constants ──────────────────────────────────────────────────────────────────
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CUISINE_REGIONS = {
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

const ALL_CUISINES = [...new Set(Object.values(CUISINE_REGIONS).flat())].sort();

const REGION_MAP = {};
Object.entries(CUISINE_REGIONS).forEach(([r,cs]) => cs.forEach(c => { REGION_MAP[c] = r; }));

const FLAGS = {
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

const CITY_EMOJI = {
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
function cityEmoji(city) { return CITY_EMOJI[city] || "📍"; }

const REGION_COLORS = {
  "East Asia":"#F0997B","Southeast Asia":"#EF9F27","South Asia":"#97C459","Western Europe":"#5B9BD5","Eastern Europe":"#AFA9EC","Central Europe":"#7F77DD","Northern Europe":"#9FE1CB",
  "Middle East":"#F5C4B3","North Africa":"#FAC775","West Africa":"#F09595","East Africa":"#E24B4A","Southern Africa":"#D85A30",
  "North America":"#1D9E75","Central America & Caribbean":"#0F6E56","South America":"#639922","Oceania":"#185FA5","Other":"#888780",
};


// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  en: {
    appTagline:null,myLog:"My Log",myTaste:"My Taste",add:"Add",quests:"Quests",faq:"FAQ",
    restaurants:"Restaurants",drinks:"Drinks",sweets:"Sweets",
    swipeHint:"Swipe left on any row to edit or delete.",
    taste:"Taste",bangBuck:"Bang/Buck",wait:"Wait",repeatability:"Repeat",howMuchCare:"How much do you care about...",
    entries:"Entries",avgBite:"Avg BITE",
    theBasics:"The basics",scoreInputs:"Score inputs",notes:"Notes",
    restaurantName:"Restaurant name *",cuisine:"Cuisine",fusionDish:"Fusion dish",
    secondCuisine:"Second cuisine",totalCost:"Total cost *",portions:"Portions",
    waitMins:"Wait (mins)",includeInScore:"Include in score",
    whatMemorable:"What made it memorable?",anythingMemorable:"Anything memorable?",
    save:"Save",cancel:"Cancel",addAnotherItem:"+ Add another item",
    cafeItems:"Items",cafeName:"Cafe name *",category:"Category",order:"Order",
    milk:"Milk",coffeeDetails:"Coffee details",matchaDetails:"Matcha details",
    beanRegion:"Bean region",flavorProfile:"Flavor profile",grade:"Grade",
    restaurantTab:"🍽 Restaurant",cafeTab:"☕ Cafe",
    wouldntReturn:"Wouldn't return",ifOccasionCalls:"If occasion calls",
    wouldSeekOut:"Would seek out",mustReturn:"Must return",
    elite:"Elite",great:"Great",good:"Good",decent:"Decent",dontBother:"Don't bother",
    sucks:"sucks",meh:"meh",average:"average",goodTaste:"good",greatTaste:"great",
    perPortion:"per portion",mustReturnLabel:"must return",wouldSeekOutLabel:"would seek out",
    ifOccasionCallsLabel:"if occasion calls",wouldntReturnLabel:"wouldn't return",
    aZQuest:"A-Z Quest",cuisineQuest:"Cuisine Quest",suggestRestaurant:"✨ Suggest a restaurant",
    questLegendQuest:"Quest",questLegendLogged:"Logged",questLegendNotYet:"Not yet",
    tapToToggle:"Tap a logged letter to toggle it into your quest.",
    tastePalette:"Taste personality",weights:"Weights",cuisineBreakdown:"Cuisine breakdown",
    prVersion:"✨ PR version",roastMe:"🔥 Roast me",
    editWeights:"Edit weights",doneWeights:"Done",deleteLabel:"Delete",
    filterByTier:"Filter by tier",clear:"Clear",
    searchPlaceholder:"Search name, cuisine...",noEntries:"No entries match.",
    noEntriesYet:"No entries yet.",noDrinks:"No drink entries yet.",noSweets:"No sweets entries yet.",
    topCuisine:"Top cuisine",topRated:"Top rated",avgTaste:"Avg taste",avgSpend:"Avg spend",
    regionsExplored:"Regions explored",bestDrink:"Best drink",avgCost:"Avg cost",
    totalDrinks:"Total drinks",totalSweets:"Total sweets",hiddenGem:"Hidden gem 💎",
    pastryLeaderboard:"Pastry leaderboard",sweetsPersonality:"Sweets personality",
    coffeePersonality:"Coffee personality",beanOrigin:"Bean origin",
    welcome1:"🍴 Welcome to BITE Score",
    welcome2:"BITE \"Benefit Index of Taste and Efficiency\" is a weighted average of factors you care about. Scores range 0–5: above 3 is Great, above 4 is Elite.\n\nPlay around! Nothing saves permanently.\nOnly Irene can do that. 😤",
    welcomeBtn:"Got it, let me explore!",
    faqQ1:"What is the BITE Score?",faqQ2:"How is the BITE Score calculated?",
    faqQ3:"What is the Wait Penalty?",faqQ4:"What are the taste levels?",
    faqQ5:"What is Bang per Buck?",faqQ6:"What does Repeatability do?",faqQ7:"How are Cafes scored?",
    visitLabel:"Visit",visitsLabel:"visits",visitCount:"visits",
    showAnother:"🔀 Show another",tryAnother:"🎲 Try another",
    startOver:"Start over",surpriseMe:"🎲 Surprise me",orSearch:"or search a cuisine",
    moodFor:"What are you in the mood for?",cuisinesUntried:"cuisines you haven't tried yet.",
    findOnMaps:"📍 Find on Maps",backToQuests:"← Back to Quests",
    off:"off",size:"Size",avg:"avg",fusionLabel:"Fusion",
    includeRepeat:"Include in score",scorePreview:"BITE Score preview",
    cafeScorePreview:"Cafe Score preview",perPortion2:"per portion",waitLabel:"wait",
    tasteTopNote:"Irene's judgement may have been clouded by bias and how underwhelming her home food has been, so this is not actually objectively #1. But let her live. She misses home 🥹",
    regionsNote:"Tap the Quests tab to explore by cuisine region!",
    allItemsNeedCost:"All items need a cost",
  },
  zh: {
    appTagline:null,myLog:"我的紀錄",myTaste:"我的口味",add:"新增",quests:"任務",faq:"說明",
    restaurants:"餐廳",drinks:"喝咖啡",sweets:"吃甜食",
    swipeHint:"向左滑動可編輯或刪除。",
    taste:"口味",bangBuck:"CP值",wait:"等待",repeatability:"重訪意願",howMuchCare:"你有多在乎...",
    entries:"筆資料",avgBite:"平均 BITE",
    theBasics:"基本資訊",scoreInputs:"評分輸入",notes:"備註",
    restaurantName:"餐廳名稱 *",cuisine:"料理類型",fusionDish:"融合料理",
    secondCuisine:"第二料理類型",totalCost:"總費用 *",portions:"份量",
    waitMins:"等待時間（分鐘）",includeInScore:"納入評分",
    whatMemorable:"有什麼特別印象深刻的嗎？",anythingMemorable:"有什麼值得記錄的嗎？",
    save:"儲存",cancel:"取消",addAnotherItem:"+ 新增品項",
    cafeItems:"品項",cafeName:"咖啡廳名稱 *",category:"類別",order:"點單",
    milk:"牛奶",coffeeDetails:"咖啡詳情",matchaDetails:"抹茶詳情",
    beanRegion:"豆子產地",flavorProfile:"風味",grade:"等級",
    restaurantTab:"🍽 餐廳",cafeTab:"☕ 咖啡廳",
    wouldntReturn:"不會再去",ifOccasionCalls:"有機會再說",
    wouldSeekOut:"會特地去",mustReturn:"一定要再去",
    elite:"讚",great:"很棒",good:"不錯",decent:"還可以",dontBother:"別浪費時間",
    sucks:"很難吃",meh:"普通",average:"普普",goodTaste:"好吃",greatTaste:"超好吃",
    perPortion:"每份",mustReturnLabel:"一定要再去",wouldSeekOutLabel:"會特地去",
    ifOccasionCallsLabel:"有機會再說",wouldntReturnLabel:"不會再去",
    aZQuest:"A-Z 挑戰",cuisineQuest:"料理挑戰",suggestRestaurant:"✨ 推薦餐廳",
    questLegendQuest:"挑戰中",questLegendLogged:"已記錄",questLegendNotYet:"尚未",
    tapToToggle:"點擊已記錄的字母以加入挑戰。",
    tastePalette:"口味個性",weights:"權重",cuisineBreakdown:"料理分佈",
    prVersion:"✨ 公關版本",roastMe:"🔥 狠狠嘲諷我",
    editWeights:"編輯",doneWeights:"完成",deleteLabel:"刪除",
    filterByTier:"依等級篩選",clear:"清除",
    searchPlaceholder:"搜尋名稱、料理類型⋯",noEntries:"沒有符合的資料。",
    noEntriesYet:"尚無資料。",noDrinks:"尚無飲料紀錄。",noSweets:"尚無甜點紀錄。",
    topCuisine:"最愛料理",topRated:"最高評分",avgTaste:"平均口味",avgSpend:"平均消費",
    regionsExplored:"探索地區",bestDrink:"最佳飲品",avgCost:"平均費用",
    totalDrinks:"飲品總數",totalSweets:"甜點總數",hiddenGem:"隱藏寶石 💎",
    pastryLeaderboard:"甜點排行榜",sweetsPersonality:"甜點個性",
    coffeePersonality:"咖啡個性",beanOrigin:"豆子產地",
    welcome1:"🍴 歡迎來到 BITE 排行榜",
    welcome2:"BITE（Benefit Index of Taste and Efficiency）是一個加權平均評分，衡量你在乎的因素。分數介於 0–5：3 分以上是「很棒」，4 分以上是「頂級」。\n\n隨便玩！不會永久儲存。\n只有 Irene 有這個權力 😂",
    welcomeBtn:"Let's Go！",
    faqQ1:"什麼是 BITE 分數？",faqQ2:"BITE 分數怎麼計算？",
    faqQ3:"等待懲罰是什麼？",faqQ4:"口味等級怎麼分？",
    faqQ5:"什麼是 CP 值？",faqQ6:"回訪意願有什麼作用？",faqQ7:"咖啡廳怎麼評分？",
    visitLabel:"第",visitsLabel:"次造訪",visitCount:"次造訪",
    showAnother:"🔀 換一個",tryAnother:"🎲 再試一次",
    startOver:"重新開始",surpriseMe:"🎲 給我驚喜",orSearch:"或搜尋料理類型",
    moodFor:"你今天想吃什麼？",cuisinesUntried:"種料理你還沒試過。",
    findOnMaps:"📍 在地圖上找",backToQuests:"← 返回任務",
    off:"關閉",size:"大小",avg:"平均",fusionLabel:"融合",
    includeRepeat:"納入評分",scorePreview:"BITE 分數預覽",
    cafeScorePreview:"咖啡廳分數預覽",perPortion2:"每份",waitLabel:"等待",
    tasteTopNote:"Irene 的判斷可能受到偏見影響——她在家吃的東西真的很平淡⋯所以這不一定是客觀的第一名。但就讓她開心吧，她很想家 🥹",
    regionsNote:"點擊任務頁面探索各地料理！",
    allItemsNeedCost:"所有品項都需要填寫費用",
  }
};



// ── Translations ──────────────────────────────────────────────────────────────

const c = {
  orange:"#F0997B", orangeL:"#3C1F13", orangeM:"#D85A30",
  green:"#97C459", greenL:"#1A2E0A",
  amber:"#EF9F27", blue:"#5B9BD5", red:"#A32D2D",
  bg:"#141413", surf:"#1E1E1C", border:"rgba(255,255,255,0.1)", text:"#F1EFE8", muted:"#888780",
};

const S = {
  wb:{width:"100%",boxSizing:"border-box"},
  mb16:{marginBottom:16},
  blk4:{display:"block",marginBottom:4},
  f1:{flex:1},
  sec:{borderTop:"0.5px solid rgba(255,255,255,0.1)",paddingTop:16,marginBottom:4},
  sm:{fontSize:11,color:"#888780"},
  row8:{display:"flex",gap:8},
  val:{fontSize:13,fontWeight:500,color:"#F1EFE8"},
  err:{fontSize:11,color:"#F0997B",marginTop:4},
  chips:{display:"flex",gap:6,flexWrap:"wrap"},
  card:{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"1rem 1.25rem"},
  lbl:{fontSize:11,color:"#888780",letterSpacing:"0.06em",textTransform:"uppercase"},
};



// ── Formulas ──────────────────────────────────────────────────────────────────
function rMult(r) { return r===3?0.4:r===2?0.2:r===1?0:-0.3; }
function applyR(base, r) { return Math.round((base + Math.abs(base)*rMult(r))*100)/100; }

function calcMaxBite(wts) {
  // Max: taste=10, bpb=0 (free food), wait=0, R=3 stars (+0.4x)
  const wt = wts || {taste:50,bpb:40,wait:10};
  const base = (wt.taste/100)*10;
  return Math.round((base + Math.abs(base)*0.4)*100)/100;
}

function calcBite(t, cost, portions, w, useR, r, wts) {
  if (!portions) return null;
  const wt = wts || {taste:50,bpb:40,wait:10};
  const bpb = (cost/portions)/20;
  const wp = Math.min(10, Math.log(w+1)/Math.log(121)*10);
  const base = (wt.taste/100)*t - (wt.bpb/100)*bpb - (wt.wait/100)*wp;
  return useR ? applyR(base,r) : Math.round(base*100)/100;
}

function calcCafe(t, cost, portions, wait, useR, r) {
  if (!portions) return null;
  const bpb = (cost/portions)/5.25;
  const wp = Math.min(10, Math.log(wait+1)/Math.log(121)*10);
  const base = 0.7*t - 0.3*bpb;
  const waitPenalty = Math.abs(base) * 0.10 * (wp/10);
  const withWait = base - waitPenalty;
  const raw = useR ? applyR(withWait,r) : Math.round(withWait*100)/100;
  // Normalize to restaurant BITE Score scale (÷1.593)
  return Math.round((raw / 1.593) * 100) / 100;
}

function scoreColor(s) {
  if (s===null) return "#888780";
  if (s>=3) return "#97C459"; if (s>=2) return "#5B9BD5"; if (s>=1) return "#EF9F27"; return "#A32D2D";
}
function scoreLabel(s, tr) {
  if(!tr) tr = T.en;
  if (s===null) return "—";
  if (s>=4) return tr.elite; if (s>=3) return tr.great; if (s>=2) return tr.good; if (s>=1) return tr.decent; return tr.dontBother;
}
function tasteLabel(t, tr) {
  if(!tr) tr = T.en;
  if (t<=2) return tr.sucks; if (t<=4) return tr.meh; if (t<=7) return tr.average; if (t<=8.5) return tr.goodTaste; return tr.greatTaste;
}
function cafeScoreColor(s) {
  if (s===null) return "#888780";
  if (s>=4) return "#97C459"; if (s>=3) return "#5B9BD5"; if (s>=2) return "#EF9F27"; if (s>=1) return "#A32D2D"; return "#A32D2D";
}
function cafeScoreLabel(s, tr) {
  if(!tr) tr = T.en;
  if (s===null) return "—";
  if (s>=4) return tr.elite; if (s>=3) return tr.great; if (s>=2) return tr.good; if (s>=1) return tr.decent; return tr.dontBother;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const RESTAURANTS = [{id:1, name:"Sozai",cuisine:"Japanese",taste:8.2,cost:33.08,portions:1,wait:0,repeatability:3,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:2, name:"Taiwanese Gourmet",cuisine:"Taiwanese",taste:8.6,cost:35,portions:2,wait:0,repeatability:3,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:3, name:"Forma Pasta Factory",cuisine:"Italian",taste:8,cost:21,portions:1,wait:0,repeatability:2,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:4, name:"Uka Omakase",cuisine:"Japanese",taste:7.2,cost:66,portions:1,wait:0,repeatability:3,useR:true,notes:"10% discount with cash",isFusion:false,cuisine2:"",city:"NYC"},{id:5, name:"Nubiani",cuisine:"Korean",taste:8.3,cost:60,portions:1,wait:0,repeatability:2,useR:true,notes:"cash discount",isFusion:false,cuisine2:"",city:"NYC"},{id:6, name:"Pranahkon",cuisine:"Thai",taste:7.2,cost:54.39,portions:1.5,wait:0,repeatability:2,useR:true,notes:"went with group of 5",isFusion:false,cuisine2:"",city:"NYC"},{id:7, name:"Soogil",cuisine:"Korean",taste:9.2,cost:86.91,portions:1,wait:0,repeatability:2,useR:true,notes:"NYRW",isFusion:true,cuisine2:"French",city:"NYC"},{id:8, name:"Soothr",cuisine:"Thai",taste:8,cost:45,portions:1,wait:5,repeatability:2,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:9, name:"Uncle Rays Chicken Rice",cuisine:"Singaporean",taste:6.6,cost:28.26,portions:2,wait:0,repeatability:2,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:10,name:"Dubuhaus",cuisine:"Korean",taste:6.8,cost:30.29,portions:1.1,wait:0,repeatability:2,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:11,name:"Gramercy Tavern",cuisine:"American",taste:8.8,cost:78,portions:1,wait:0,repeatability:2,useR:true,notes:"NYRW",isFusion:false,cuisine2:"",city:"NYC"},{id:12,name:"Nyonya",cuisine:"Malaysian",taste:7,cost:50,portions:2,wait:0,repeatability:1,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:13,name:"Kin Ramen",cuisine:"Japanese",taste:7.8,cost:20.56,portions:1,wait:20,repeatability:3,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:14,name:"Gaonurri",cuisine:"Korean",taste:7.5,cost:82.16,portions:1.2,wait:0,repeatability:2,useR:true,notes:"NYRW",isFusion:false,cuisine2:"",city:"NYC"},{id:15,name:"Yumpling",cuisine:"Taiwanese",taste:6.5,cost:27.22,portions:1.1,wait:0,repeatability:1,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:16,name:"The Modern",cuisine:"American",taste:9,cost:102.46,portions:1,wait:0,repeatability:1,useR:true,notes:"NYRW",isFusion:false,cuisine2:"",city:"NYC"},{id:17,name:"Fish Cheeks",cuisine:"Thai",taste:6,cost:56.71,portions:1,wait:0,repeatability:2,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:18,name:"Sala Thai",cuisine:"Thai",taste:5.8,cost:36.09,portions:1.5,wait:0,repeatability:1,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:19,name:"Traveler - Hue House",cuisine:"Taiwanese",taste:6.1,cost:58.14,portions:1,wait:0,repeatability:1,useR:true,notes:"15 min wait walk in",isFusion:false,cuisine2:"",city:"NYC"},{id:20,name:"L'Industrie Pizza",cuisine:"Italian",taste:5,cost:15.18,portions:1,wait:5,repeatability:1,useR:true,notes:"off-peak time",isFusion:false,cuisine2:"",city:"NYC"},{id:21,name:"Tokyo Record Bar",cuisine:"Japanese",taste:7.6,cost:122.44,portions:1,wait:0,repeatability:1,useR:true,notes:"fun experience with vinyl DJ",isFusion:false,cuisine2:"",city:"NYC"},{id:22,name:"Sake No Hana",cuisine:"Japanese",taste:5.5,cost:77.33,portions:1.2,wait:0,repeatability:1,useR:true,notes:"NYRW",isFusion:false,cuisine2:"",city:"NYC"},{id:23,name:"Bourbon Steak",cuisine:"American",taste:5,cost:57.1,portions:1,wait:0,repeatability:0,useR:true,notes:"NYRW",isFusion:false,cuisine2:"",city:"NYC"},{id:24,name:"Le Pavillon",cuisine:"French",taste:8.3,cost:79,portions:1,wait:0,repeatability:0,useR:true,notes:"NYRW",isFusion:false,cuisine2:"",city:"NYC"},{id:25,name:"Temple Court Beekman",cuisine:"American",taste:5,cost:35.81,portions:1,wait:0,repeatability:0,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:26,name:"Nougatine Jean-Georges",cuisine:"American",taste:6.2,cost:78.4,portions:1,wait:0,repeatability:0,useR:true,notes:"NYRW",isFusion:false,cuisine2:"",city:"NYC"},{id:27,name:"Yakiniku Futago",cuisine:"Japanese",taste:5,cost:58,portions:1,wait:0,repeatability:0,useR:true,notes:"NYRW",isFusion:false,cuisine2:"",city:"NYC"},{id:28,name:"Pasta Eater N Go",cuisine:"Italian",taste:3,cost:21,portions:1.3,wait:0,repeatability:0,useR:true,notes:"AYCE",isFusion:false,cuisine2:"",city:"NYC"},{id:29,name:"Blue Box Cafe",cuisine:"American",taste:6,cost:121.79,portions:1,wait:0,repeatability:0,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:30,name:"Nami Nori",cuisine:"Japanese",taste:2.6,cost:40.7,portions:1,wait:0,repeatability:0,useR:true,notes:"NYRW. I hate this place",isFusion:false,cuisine2:"",city:"NYC"},{id:31,name:"Cho Dang Gol",cuisine:"Korean",taste:8.5,cost:60.56,portions:1.2,wait:45,repeatability:3,useR:true,notes:"i keep going back tho",isFusion:false,cuisine2:"",city:"NYC"},{id:32,name:"Raku",cuisine:"Japanese",taste:7.2,cost:38.66,portions:1,wait:65,repeatability:1,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:33,name:"Streecha",cuisine:"Ukrainian",taste:5,cost:18.5,portions:1,wait:0,repeatability:1,useR:true,notes:"Cash only",isFusion:false,cuisine2:"",city:"NYC"},{id:34,name:"Coco Hotpot Prince",cuisine:"Chinese",taste:6.2,cost:62.2,portions:1,wait:0,repeatability:2,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:35,name:"Yemen Cafe",cuisine:"Yemeni",taste:6.3,cost:36,portions:2,wait:0,repeatability:0,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:36,name:"LALIKO",cuisine:"Georgian",taste:6.8,cost:50.91,portions:1,wait:0,repeatability:0,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:37,name:"FARIDA",cuisine:"Kazakh",taste:7.5,cost:55.71,portions:1.2,wait:0,repeatability:1,useR:true,notes:"also ordered a Kyrgyz dish",isFusion:true,cuisine2:"Kyrgyz",city:"NYC"},{id:38,name:"Smor",cuisine:"Danish",taste:6.5,cost:15,portions:0.7,wait:0,repeatability:1,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},{id:39,name:"Baos and Bowls",cuisine:"Taiwanese",taste:4.3,cost:23,portions:1,wait:0,repeatability:0,useR:true,notes:"No water, no chili oil, no bathroom.",isFusion:true,cuisine2:"Shanghainese",city:"NYC"},{id:40,name:"Gulp - Hue House",cuisine:"Taiwanese",taste:7.3,cost:30,portions:1.2,wait:0,repeatability:1,useR:true,notes:"",isFusion:false,cuisine2:"",city:"NYC"},
];

const CAFES_INIT = [
  {id:1001,name:"Kokē",category:"Coffee",order:"Sesame latte",taste:7.5,cost:8,portions:1,wait:15,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:"Would come back for this"},
  {id:1002,name:"Kokē",category:"Sweets",order:"Black sesame soft serve",taste:5.5,cost:7,portions:1,wait:0,beanRegion:"",milkLevel:"",repeatability:1,useR:true,notes:"Wouldn't get again"},
  {id:1003,name:"Sote Coffee Roasters",category:"Coffee",order:"Cappuccino",taste:7.7,cost:5.25,portions:1,wait:10,beanRegion:"",milkLevel:"Medium",repeatability:3,useR:true,notes:""},
  {id:1006,name:"Sote Coffee Roasters",category:"Coffee",order:"Cappuccino",taste:7.7,cost:5.25,portions:1,wait:0,beanRegion:"",milkLevel:"Medium",repeatability:3,useR:true,notes:""},
  {id:1004,name:"Breads Bakery",category:"Coffee",order:"Cappuccino",taste:6.7,cost:5.75,portions:1,wait:10,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1005,name:"Breads Bakery",category:"Sweets",order:"Chocolate almond croissant",taste:8.8,cost:6,portions:1,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:"A little too sweet but STELLAR"},

  {id:1007,name:"Rex",category:"Coffee",order:"Cappuccino",taste:8.0,cost:4.5,portions:1,wait:7,beanRegion:"",milkLevel:"",repeatability:2,useR:true,notes:""},
  {id:1008,name:"Dot's Cafe",category:"Coffee",order:"Cappuccino",taste:6.8,cost:5.25,portions:1,wait:3,beanRegion:"",milkLevel:"",repeatability:2,useR:true,notes:""},
  {id:1009,name:"White Noise Coffee",category:"Coffee",order:"Latte",taste:7.2,cost:4.85,portions:1,wait:0,beanRegion:"",milkLevel:"Heavy",repeatability:2,useR:true,notes:"Very milky"},
  {id:1010,name:"MONTE Cafe & Bakery",category:"Coffee",order:"Cappuccino",taste:8.3,cost:5.72,portions:1,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1011,name:"MONTE Cafe & Bakery",category:"Coffee",order:"Cappuccino",taste:8.3,cost:5.72,portions:1,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1012,name:"Nata",category:"Sweets",order:"Natas x2",taste:9.5,cost:8.25,portions:2,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1013,name:"Nata",category:"Sweets",order:"Natas x2",taste:9.5,cost:8.25,portions:2,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1014,name:"Nata",category:"Sweets",order:"Natas x2 + espresso",taste:9.5,cost:10.02,portions:3,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1015,name:"Nata",category:"Sweets",order:"6 natas combo",taste:9.5,cost:23.02,portions:6,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1016,name:"Nata",category:"Sweets",order:"6 natas combo",taste:9.5,cost:23.02,portions:6,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1017,name:"Nata",category:"Sweets",order:"6 natas combo",taste:9.5,cost:23.02,portions:6,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1018,name:"Nata",category:"Sweets",order:"6 natas combo",taste:9.5,cost:23.02,portions:6,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1019,name:"Nata",category:"Sweets",order:"Natas x2 + cinnamon cortado",taste:9.5,cost:13.06,portions:3,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1020,name:"Nata",category:"Sweets",order:"Natas x2",taste:9.5,cost:8.25,portions:2,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1021,name:"Nata",category:"Sweets",order:"Natas x2",taste:9.5,cost:8.25,portions:2,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1022,name:"Nata",category:"Sweets",order:"Natas x2",taste:9.5,cost:8.25,portions:2,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1023,name:"Nata",category:"Sweets",order:"Natas x2",taste:9.5,cost:8.25,portions:2,wait:0,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1024,name:"Culture Froyo",category:"Sweets",order:"Froyo",taste:8.1,cost:11.43,portions:1,wait:0,beanRegion:"",milkLevel:"",repeatability:2,useR:true,notes:""},
  {id:1025,name:"Culture Froyo",category:"Sweets",order:"Froyo",taste:8.1,cost:13.78,portions:1,wait:0,beanRegion:"",milkLevel:"",repeatability:2,useR:true,notes:""},
  {id:1026,name:"Culture Froyo",category:"Sweets",order:"Froyo",taste:8.1,cost:14.85,portions:1,wait:0,beanRegion:"",milkLevel:"",repeatability:2,useR:true,notes:""},
  {id:1027,name:"Caffe Panna",category:"Sweets",order:"Ice cream",taste:8.7,cost:9.25,portions:1,wait:15,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1028,name:"Caffe Panna",category:"Sweets",order:"Ice cream",taste:8.7,cost:9.25,portions:1,wait:15,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1029,name:"Caffe Panna",category:"Sweets",order:"Ice cream",taste:8.7,cost:9.25,portions:1,wait:15,beanRegion:"",milkLevel:"",repeatability:3,useR:true,notes:""},
  {id:1030,name:"Hey Yogurt",category:"Sweets",order:"Purple rice yogurt",taste:7.8,cost:7.57,portions:1,wait:0,beanRegion:"",milkLevel:"",repeatability:2,useR:true,notes:""},
];

const INIT_REST = {name:"",letter:"",cuisine:"",taste:5,cost:"",portions:1,wait:0,repeatability:1,useR:true,notes:"",isFusion:false,cuisine2:"",city:""};
const INIT_CAFE = {name:"",category:"Coffee",order:"",taste:5,cost:"",portions:1,wait:0,beanRegion:"",milkLevel:"Light",repeatability:1,useR:true,notes:""};

const CAFE_ORDERS = {
  "Coffee": ["Espresso","Cortado","Cappuccino","Latte","Flat White","Americano","Cold Brew"],
  "Tea":    ["Matcha","Hojicha","Chai","Brewed Tea","Oolong","Earl Grey"],
  "Sweets": null,
  "Other":  null,
};
const CAFE_ICONS = {"Coffee":"☕","Tea":"🍵","Sweets":"🥐","Other":"🥤"};
function getCafeIcon(category, order) {
  const o = (order||"").toLowerCase();
  if (category==="Coffee") return "☕";
  if (category==="Tea") return "🍵";
  if (category==="Other") return "🥤";
  // Sweets - order-based
  if (o.includes("soft serve")||o.includes("froyo")||o.includes("yogurt")||o.includes("ice cream")||o.includes("parfait")) return "🍦";
  if (o.includes("cake")||o.includes("tart")) return "🎂";
  if (o.includes("cookie")||o.includes("muffin")||o.includes("scone")||o.includes("brownie")) return "🍪";
  return "🥐"; // default pastry for croissants, natas, danishes etc
}

function reducer(s, a) {
  switch(a.type) {
    case "ADD":    return {...s,entries:[...s.entries,a.e],view:"log"};
    case "DEL":    return {...s,entries:s.entries.filter(e=>e.id!==a.id)};
    case "UPD":    return {...s,entries:s.entries.map(e=>e.id===a.e.id?a.e:e),view:"log"};
    case "VIEW":   return {...s,view:a.view};
    case "LOAD":   return {...s,entries:a.entries};
    default:       return s;
  }
}

// ── Shared components ──────────────────────────────────────────────────────────
function Toggle({on,onClick}) {
  return (
    <div onClick={onClick} style={{width:36,height:20,borderRadius:10,background:on?"#F0997B":"#444441",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:on?18:3,width:14,height:14,borderRadius:7,background:"#fff",transition:"left 0.2s"}}/>
    </div>
  );
}

function RepeatPicker({value,onChange}) {
  const {t} = useLang();
  const opts = [[0,"✕",t.wouldntReturn],[1,"⭐",t.ifOccasionCalls],[2,"⭐⭐",t.wouldSeekOut],[3,"⭐⭐⭐",t.mustReturn]];
  return (
    <div style={{display:"flex",gap:8,marginTop:6}}>
      {opts.map(([v,stars,desc])=>(
        <div key={v} onClick={()=>onChange(v)} style={{flex:1,padding:"8px 6px",borderRadius:8,textAlign:"center",cursor:"pointer",background:value===v?"#3C1F13":"#141413",border:"1px solid "+(value===v?"#F0997B":"rgba(255,255,255,0.1)")}}>
          <div style={{fontSize:16,marginBottom:2}}>{stars}</div>
          <div style={{fontSize:9,color:value===v?"#F0997B":"#888780",lineHeight:1.3}}>{desc}</div>
        </div>
      ))}
    </div>
  );
}

function SwipeRow({children,onEdit,onDelete,isAdmin}) {
  const {t} = useLang();
  const [off,setOff] = useState(0);
  const sx = useRef(null);
  const sy = useRef(null);
  const ref = useRef(null);
  const T = 160;
  const innerRef = useRef(null);
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setOff(0);}
    document.addEventListener("mousedown",h);document.addEventListener("touchstart",h);
    return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("touchstart",h);};
  },[]);
  useEffect(()=>{
    const el=innerRef.current;
    if(!el)return;
    function onTM(e){
      if(sx.current===null)return;
      const dx=e.touches[0].clientX-sx.current;
      const dy=e.touches[0].clientY-(sy.current||0);
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>5){e.preventDefault();}
    }
    el.addEventListener("touchmove",onTM,{passive:false});
    return()=>el.removeEventListener("touchmove",onTM);
  },[]);

  return (
    <div ref={ref} style={{position:"relative",overflow:"hidden",borderRadius:10,marginBottom:8,isolation:"isolate"}}>
      <div style={{position:"absolute",right:0,top:0,bottom:0,display:"flex",alignItems:"stretch",zIndex:0}}>
        <button onClick={()=>{setOff(0);onEdit();}} style={{width:80,background:"#185FA5",color:"#F1EFE8",border:"none",fontSize:12,fontWeight:500,cursor:"pointer"}}>Edit</button>
        <button onClick={()=>{setOff(0);onDelete();}} style={{width:80,background:"#A32D2D",color:"#F1EFE8",border:"none",fontSize:12,fontWeight:500,cursor:"pointer"}}>{t.deleteLabel}</button>
      </div>
      <div
        onMouseDown={e=>{sx.current=e.clientX;sy.current=e.clientY;}}
        onMouseMove={e=>{if(sx.current===null)return;const dx=e.clientX-sx.current;if(Math.abs(dx)>5&&dx<0)setOff(Math.max(dx,-T));else if(off<0)setOff(Math.min(0,off+(e.clientX-sx.current)));}}
        onMouseUp={()=>{sx.current=null;sy.current=null;setOff(o=>o<-T/2?-T:0);}}
        onMouseLeave={()=>{if(sx.current!==null){sx.current=null;setOff(o=>o<-T/2?-T:0);}}}
        onTouchStart={e=>{sx.current=e.touches[0].clientX; sy.current=e.touches[0].clientY;}}
        onTouchMove={e=>{
          if(sx.current===null)return;
          const dx=e.touches[0].clientX-sx.current;
          const dy=e.touches[0].clientY-(sy.current||0);
          if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>5){e.preventDefault();if(dx<0)setOff(Math.max(dx,-T));else if(off<0)setOff(Math.min(0,off+dx));}
        }}
        onTouchEnd={()=>{sx.current=null;sy.current=null;setOff(o=>o<-T/2?-T:0);}}
        ref={innerRef} style={{transform:"translateX("+off+"px)",transition:sx.current===null?"transform 0.2s":"none",position:"relative",zIndex:1}}>
        {children}
      </div>
    </div>
  );
}

function LogoWithTripleTap({onTripleTap, isAdmin}) {
  const taps = useRef([]);
  function handleTap() {
    const now = Date.now();
    taps.current = [...taps.current.filter(t=>now-t<800), now];
    if(taps.current.length>=3) { taps.current=[]; onTripleTap(); }
  }
  return (
    <div onClick={handleTap} style={{cursor:"pointer",flexShrink:0,position:"relative"}}>
      <MouthLogo/>
      {isAdmin&&<div style={{position:"absolute",top:-3,right:-3,width:10,height:10,borderRadius:"50%",background:"#97C459",border:"1.5px solid #141413"}}/>}
    </div>
  );
}

function CuisineInput({value,onChange,placeholder}) {
  const [show,setShow] = useState(false);
  const ref = useRef(null);
  const filtered = value.trim().length>0 ? ALL_CUISINES.filter(x=>x.toLowerCase().startsWith(value.trim().toLowerCase())) : [];
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setShow(false);}
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <input value={value} onChange={e=>{onChange(e.target.value);setShow(true);}} onFocus={()=>setShow(true)} placeholder={placeholder} style={S.wb}/>
      {show&&filtered.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,zIndex:100,maxHeight:180,overflowY:"auto",marginTop:4}}>
          {filtered.map(x=>(
            <div key={x} onMouseDown={()=>{onChange(x);setShow(false);}} style={{padding:"8px 12px",fontSize:13,color:"#F1EFE8",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="#2C2C2A"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{x}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Tooltip({children,content}) {
  const [show,setShow] = useState(false);
  const [pos,setPos] = useState({top:0,left:0});
  const ref = useRef(null);
  useEffect(()=>{
    if(!show)return;
    function h(e){if(ref.current&&!ref.current.contains(e.target))setShow(false);}
    document.addEventListener("mousedown",h);document.addEventListener("touchstart",h);
    return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("touchstart",h);};
  },[show]);
  function cp(el){const r=el.getBoundingClientRect();let left=r.left+r.width/2;left=Math.max(104,Math.min(left,window.innerWidth-104));return{top:r.top-12,left};}
  return (
    <div ref={ref} style={{position:"relative",display:"inline-block"}}
      onMouseEnter={e=>{setPos(cp(e.currentTarget));setShow(true);}} onMouseLeave={()=>setShow(false)}
      onTouchEnd={e=>{e.stopPropagation();setPos(cp(e.currentTarget));setShow(s=>!s);}}>
      {children}
      {show&&content&&(
        <div style={{position:"fixed",top:pos.top,left:pos.left,transform:"translate(-50%,-100%)",background:"#2C2C2A",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#F1EFE8",zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,0.7)",width:200,lineHeight:1.6,pointerEvents:"none"}}>
          {content}
        </div>
      )}
    </div>
  );
}

function MouthLogo() {
  const [open,setOpen] = useState(true);
  useEffect(()=>{const id=setInterval(()=>setOpen(o=>!o),700);return()=>clearInterval(id);},[]);
  return (
    <div style={{width:40,height:40,borderRadius:"50%",background:"#3C1F13",border:"1.5px solid #F0997B",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",top:10,left:10,width:6,height:7,borderRadius:"50%",background:"#F1EFE8"}}/>
      <div style={{position:"absolute",top:11,left:12,width:3,height:3,borderRadius:"50%",background:"#2C2C2A"}}/>
      <div style={{position:"absolute",top:10,right:10,width:6,height:7,borderRadius:"50%",background:"#F1EFE8"}}/>
      <div style={{position:"absolute",top:11,right:12,width:3,height:3,borderRadius:"50%",background:"#2C2C2A"}}/>
      <div style={{position:"absolute",bottom:4,left:8,right:8,height:12,borderRadius:6,background:"#D85A30",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"#F1EFE8"}}/>
        {open&&<div style={{position:"absolute",top:3,left:0,right:0,bottom:3,background:"#7A1A1A"}}/>}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:"#F1EFE8"}}/>
      </div>
    </div>
  );
}

// ── Section label helper ───────────────────────────────────────────────────────
const SL = ({children}) => <span style={{fontSize:10,color:"#F0997B",letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:10}}>{children}</span>;
const FL = ({children}) => <span style={{fontSize:12,color:"#F1EFE8",marginBottom:6,display:"block",fontWeight:500}}>{children}</span>;

// ── Restaurant row & form ──────────────────────────────────────────────────────
function RestRow({e,i,display,onEdit,onDelete,isAdmin,visits=1,group,weights}) {
  const {t} = useLang();
  const [exp,setExp] = useState(false);
  const [showVisits,setShowVisits] = useState(false);
  const flag = FLAGS[e.cuisine]||(e.letter||e.cuisine?.[0])?.toUpperCase()||"?";
  const grp = group||[e];
  return (
    <div>
      {showVisits&&(
        <div onClick={()=>setShowVisits(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.25rem"}}>
          <div onClick={ev=>ev.stopPropagation()} style={{background:"#1E1E1C",borderRadius:16,width:"100%",maxWidth:560,maxHeight:"60vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.25rem",borderBottom:"0.5px solid rgba(255,255,255,0.1)",flexShrink:0}}>
              <div>
                <div style={{fontSize:15,fontWeight:500,color:"#F1EFE8"}}>{e.name}</div>
                <div style={{fontSize:12,color:"#888780"}}>{visits} visit{visits!==1?"s":""}</div>
              </div>
              <button onClick={()=>setShowVisits(false)} style={{fontSize:22,color:"#888780",background:"none",border:"none",cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1rem 1.25rem",flex:1}}>
              {[...grp].reverse().map((v,idx)=>{
                const sc=calcBite(v.taste,v.cost,v.portions,v.wait,v.useR,v.repeatability,weights);
                return(
                  <div key={v.id} style={{background:"#141413",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:500,color:"#F1EFE8"}}>Visit {grp.length-idx}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:16,fontWeight:500,color:scoreColor(sc)}}>{sc!=null?sc.toFixed(2):"—"}</div>
                        <button onClick={()=>{setShowVisits(false);onEdit(v);window.scrollTo({top:0,behavior:"smooth"});}} style={{fontSize:11,color:"#5B9BD5",background:"none",border:"0.5px solid #5B9BD5",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>Edit</button>
                        {isAdmin&&<button onClick={()=>{onDelete(v.id);}} style={{fontSize:11,color:"#A32D2D",background:"none",border:"0.5px solid #A32D2D",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>Delete</button>}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                      {[[t.taste,v.taste.toFixed(1)],["Cost","$"+v.cost],[t.wait,v.wait+" min"],["Repeat","⭐".repeat(v.repeatability)||"✕"]].map(([k,val])=>(
                        <div key={k}><div style={{fontSize:10,color:"#888780"}}>{k}</div><div style={S.val}>{val}</div></div>
                      ))}
                    </div>
                    {v.notes&&<div style={{marginTop:8,fontSize:11,color:"#888780",fontStyle:"italic"}}>{v.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <SwipeRow onEdit={()=>{ if(visits>1){setShowVisits(true);}else{onEdit(e);window.scrollTo({top:0,behavior:"smooth"});}}} onDelete={()=>onDelete(e.id)} isAdmin={isAdmin}>
        <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10}}>
          <div onClick={()=>setExp(x=>!x)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer"}}>
            <span style={{fontSize:12,color:"#888780",minWidth:18,textAlign:"right"}}>{"#"+(i+1)}</span>
            <div style={{width:36,height:36,borderRadius:8,background:"#3C1F13",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{flag}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontWeight:500,fontSize:14,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div>
                {visits>1&&<span onClick={ev=>{ev.stopPropagation();setShowVisits(true);}} style={{fontSize:10,fontWeight:500,padding:"2px 6px",borderRadius:10,background:"#2A1E05",color:"#EF9F27",border:"0.5px solid #EF9F27",flexShrink:0,cursor:"pointer"}}>{visits}×</span>}
                {e.isFusion&&<span style={{fontSize:10,fontWeight:500,padding:"2px 6px",borderRadius:10,background:"#2A1E05",color:"#EF9F27",border:"0.5px solid #EF9F27",flexShrink:0}}>{t.fusionLabel}</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:"#888780"}}>{e.cuisine}</span>
                <span style={{fontSize:10,padding:"1px 6px",borderRadius:8,background:"rgba(91,155,213,0.12)",color:"#5B9BD5",border:"0.5px solid rgba(91,155,213,0.25)"}}>📍 {e.city||"NYC"}</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:500,color:display.color}}>{display.val}</div>
              <div style={{fontSize:11,color:display.color}}>{display.label}</div>
            </div>
            <div style={{fontSize:10,color:"#888780",marginLeft:2}}>{exp?"▲":"▼"}</div>
          </div>
          {exp&&(
            <div style={{padding:"0 14px 12px 70px",borderTop:"0.5px solid rgba(255,255,255,0.07)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:10}}>
                {[[t.taste,String(e.taste)],["Cost","$"+e.cost],[t.portions,e.portions+"x"],[t.wait,e.wait+" min"],["Repeat",e.useR?("⭐".repeat(e.repeatability)||"✕"):t.off]].map(([k,v])=>(
                  <div key={k}><div style={{fontSize:10,color:"#888780"}}>{k}</div><div style={S.val}>{v}</div></div>
                ))}
              </div>
  {e.notes&&<div style={{marginTop:10,fontSize:11,color:"#888780"}}><span style={{fontWeight:500}}>Note: </span>{e.notes}</div>}
            </div>
          )}
        </div>
      </SwipeRow>
    </div>
  );
}

function RestForm({initial,onSave,onCancel,weights,addType,setAddType,existingNames,existingEntries}) {
  const {t} = useLang();
  const [f,setF] = useState(initial);
  const [sub,setSub] = useState(false);
  const inp = (k,v) => setF(p=>({...p,[k]:v}));
  const score = calcBite(+f.taste,+f.cost,+f.portions,+f.wait,f.useR,+f.repeatability,weights);
  const bg = score===null?"#2C2C2A":score>=3?"#1A2E0A":score>=2?"#0C2A3A":score>=1?"#2A1E05":"#3C1F13";
  function save() {
    if(!f.name||!f.cost){setSub(true);return;}
    onSave({...f,taste:+f.taste,cost:+f.cost,portions:+f.portions,wait:+f.wait,repeatability:+f.repeatability});
  }
  return (
    <div style={{...S.card,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        {addType!==undefined?(
          <div style={{display:"flex",gap:0,background:"#141413",borderRadius:20,padding:3}}>
            <Pill active={addType==="restaurant"} onClick={()=>setAddType("restaurant")}>{t.restaurantTab}</Pill>
            <Pill active={addType==="cafe"} onClick={()=>setAddType("cafe")}>{t.cafeTab}</Pill>
          </div>
        ):<div/>}
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:22,fontWeight:600,color:scoreColor(score),lineHeight:1}}>{score!=null?score.toFixed(2):"—"}</div>
          <div style={{fontSize:11,color:scoreColor(score)}}>{scoreLabel(score,t)}</div>
        </div>
      </div>
      <SL>{t.theBasics}</SL>
      <div style={S.mb16}>
        <FL>{t.restaurantName}</FL>
        <CafeNameInput value={f.name} onChange={v=>{
          inp("name",v);
          const match=(existingEntries||[]).find(e=>e.name===v);
          if(match){
            inp("cuisine",match.cuisine||"");
            inp("letter",(match.cuisine?.[0]||"").toUpperCase());
            inp("cuisine2",match.cuisine2||"");
            inp("isFusion",match.isFusion||false);
            inp("portions",match.portions||1);
            inp("wait",0);
            inp("useR",match.useR!==false);
            inp("repeatability",match.repeatability||1);
          }
        }} existingNames={existingNames||[]}/>
        {sub&&!f.name&&<div style={S.err}>Required</div>}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={S.f1}><FL>{t.cuisine}</FL><CuisineInput value={f.cuisine} placeholder={t.cuisine} onChange={v=>{inp("cuisine",v);inp("letter",v.trim()[0]?.toUpperCase()||"");}}/></div>
        {f.letter&&<div style={{display:"flex",alignItems:"flex-end",paddingBottom:2}}><div style={{width:36,height:36,borderRadius:8,background:"#3C1F13",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{FLAGS[f.cuisine]||f.letter}</div></div>}
      </div>

      <div style={{marginBottom:16}}>
        <FL>{t.city||"City"} <span style={{color:"#888780",fontWeight:400,fontSize:11}}>({t.optional||"optional"})</span></FL>
        <input value={f.city||""} onChange={e=>inp("city",e.target.value)} placeholder="e.g. NYC, Tokyo, Lisbon" style={S.wb}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <Toggle on={f.isFusion} onClick={()=>inp("isFusion",!f.isFusion)}/><span style={{fontSize:13,color:"#888780"}}>{t.fusionDish}</span>
      </div>
      {f.isFusion&&<div style={S.mb16}><FL>{t.secondCuisine}</FL><CuisineInput value={f.cuisine2||""} placeholder={t.cuisine} onChange={v=>inp("cuisine2",v)}/></div>}
      <div style={S.sec}><SL>{t.scoreInputs}</SL></div>
      <div style={S.mb16}>
        <FL>Taste — <span style={{color:"#F0997B"}}>{f.taste} · {tasteLabel(f.taste,t)}</span></FL>
        <input type="range" min="0" max="10" step="0.1" value={f.taste} onChange={e=>inp("taste",e.target.value)} style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888780",marginTop:4}}><span>0 sucks</span><span>5 avg</span><span>10 incredible</span></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={S.f1}><FL>{t.totalCost}</FL><input type="number" value={f.cost} onChange={e=>inp("cost",e.target.value)} placeholder="$ e.g. 45" style={S.wb}/>{sub&&!f.cost&&<div style={S.err}>Required</div>}</div>
        <div style={S.f1}><FL>{t.portions}</FL><input type="number" min="0.5" step="0.5" value={f.portions} onChange={e=>inp("portions",e.target.value)} style={S.wb}/></div>
        <div style={S.f1}><FL>{t.waitMins}</FL><input type="number" min="0" step="1" value={f.wait} onChange={e=>inp("wait",e.target.value)} style={S.wb}/></div>
      </div>
      <div style={S.sec}><SL>{t.repeatability}</SL></div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><Toggle on={f.useR} onClick={()=>inp("useR",!f.useR)}/><span style={{fontSize:13,color:"#888780"}}>{t.includeInScore}</span></div>
      {f.useR&&<div style={S.mb16}><FL>Repeatability — <span style={{color:"#F0997B"}}>{"⭐".repeat(f.repeatability)||"✕"}</span></FL><RepeatPicker value={f.repeatability} onChange={v=>inp("repeatability",v)}/></div>}
      <div style={S.sec}><SL>{t.notes}</SL></div>
      <div style={{marginBottom:20}}><textarea value={f.notes} onChange={e=>inp("notes",e.target.value)} placeholder={t.whatMemorable} rows={3} style={{width:"100%",boxSizing:"border-box",resize:"vertical"}}/></div>
      <div style={S.row8}>
        <button onClick={onCancel} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:14,cursor:"pointer"}}>{t.cancel}</button>
        <button onClick={save} style={{flex:2,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:15,fontWeight:500,cursor:"pointer"}}>{t.save}</button>
      </div>
    </div>
  );
}

// ── Cafe name autocomplete ─────────────────────────────────────────────────────
function CafeNameInput({value, onChange, existingNames}) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const filtered = value.trim().length > 0
    ? [...new Set(existingNames)].filter(n => n.toLowerCase().includes(value.trim().toLowerCase()) && n.toLowerCase() !== value.trim().toLowerCase())
    : [];
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setShow(false);}
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <input value={value} onChange={e=>{onChange(e.target.value);setShow(true);}} onFocus={()=>setShow(true)} placeholder="e.g. Birch Coffee" style={S.wb}/>
      {show&&filtered.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,zIndex:100,maxHeight:160,overflowY:"auto",marginTop:4}}>
          {filtered.map(n=>(
            <div key={n} onMouseDown={()=>{onChange(n);setShow(false);}} style={{padding:"8px 12px",fontSize:13,color:"#F1EFE8",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="#2C2C2A"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cafe grouped row (multiple visits rolled up) ───────────────────────────────
function CafeGroupRow({group, cafeSortBy, onEdit, onDelete, isAdmin}) {
  const {t,lang} = useLang();
  const [exp, setExp] = useState(false);
  const [showVisits, setShowVisits] = useState(false);
  const icon = getCafeIcon(group[0].category, group[0].order);
  const visits = group.length;

  const scores = group.map(e=>calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)).filter(s=>s!=null);
  const avgScore = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null;
  const avgTaste = group.reduce((a,e)=>a+e.taste,0)/visits;
  const avgCost = group.reduce((a,e)=>a+e.cost,0)/visits;
  const avgWait = group.reduce((a,e)=>a+e.wait,0)/visits;
  const avgRepeat = Math.round(group.reduce((a,e)=>a+e.repeatability,0)/visits);

  function getDisplay() {
    if(cafeSortBy==="taste"){const tv=avgTaste,lbl=tasteLabel(tv,t),col=tv<=2?"#A32D2D":tv<=4?"#888780":tv<=7?"#EF9F27":tv<=8.5?"#5B9BD5":"#97C459";return{val:tv.toFixed(1),label:lbl,color:col};}
    if(cafeSortBy==="bpb") return{val:"$"+avgCost.toFixed(2),label:"avg/item",color:"#5B9BD5"};
    if(cafeSortBy==="wait") return{val:avgWait.toFixed(0)+" min",label:"avg wait",color:"#888780"};
    if(cafeSortBy==="repeat") return{val:"⭐".repeat(avgRepeat)||"✕",label:"avg repeat",color:"#EF9F27"};
    return{val:avgScore!=null?avgScore.toFixed(2):"—",label:cafeScoreLabel(avgScore,t),color:cafeScoreColor(avgScore)};
  }
  const display = getDisplay();
  const orders = [...new Set(group.map(e=>e.order).filter(Boolean))].join(", ");

  return (
    <>
      {/* Visit history modal */}
      {showVisits&&(
        <div onClick={()=>setShowVisits(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.25rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1E1E1C",borderRadius:16,width:"100%",maxWidth:560,maxHeight:"60vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.25rem",borderBottom:"0.5px solid rgba(255,255,255,0.1)",flexShrink:0}}>
              <div>
                <div style={{fontSize:15,fontWeight:500,color:"#F1EFE8"}}>{group[0].name}</div>
                <div style={{fontSize:12,color:"#888780"}}>{visits} visit{visits!==1?"s":""}</div>
              </div>
              <button onClick={()=>setShowVisits(false)} style={{fontSize:22,color:"#888780",background:"none",border:"none",cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1rem 1.25rem",flex:1}}>
              {[...group].reverse().map((e,i)=>{
                const sc = calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability);
                return (
                  <div key={e.id} style={{background:"#141413",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:500,color:"#F1EFE8"}}>{lang==="zh"?t.visitLabel+(visits-i)+t.visitsLabel:"Visit "+(visits-i)}{e.order?" · "+e.order:""}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:16,fontWeight:500,color:scoreColor(sc)}}>{sc!=null?sc.toFixed(2):"—"}</div>
                        <button onClick={()=>{setShowVisits(false);onEdit(e);}} style={{fontSize:11,color:"#5B9BD5",background:"none",border:"0.5px solid #5B9BD5",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>{t.editWeights}</button>
                        <button onClick={()=>onDelete(e.id)} style={{fontSize:11,color:"#A32D2D",background:"none",border:"0.5px solid #A32D2D",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>{t.deleteLabel}</button>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                      {[[t.taste,e.taste.toFixed(1)],["Cost","$"+e.cost],[t.wait,e.wait+" min"],["Repeat","⭐".repeat(e.repeatability)||"✕"]].map(([k,v])=>(
                        <div key={k}><div style={{fontSize:10,color:"#888780"}}>{k}</div><div style={{fontSize:13,fontWeight:500,color:"#F1EFE8"}}>{v}</div></div>
                      ))}
                    </div>
                    {e.notes&&<div style={{marginTop:8,fontSize:11,color:"#888780",fontStyle:"italic"}}>{e.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <SwipeRow onEdit={()=>onEdit(group[group.length-1])} onDelete={()=>onDelete(group[group.length-1].id)} isAdmin={isAdmin}>
        <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10}}>
          <div onClick={()=>setExp(x=>!x)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer"}}>
            <span style={{fontSize:12,color:"#888780",minWidth:18,textAlign:"right"}}></span>
            <div style={{width:36,height:36,borderRadius:8,background:"#3C1F13",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontWeight:500,fontSize:14,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{group[0].name}</div>
                {visits>1&&(
                  <span onClick={e=>{e.stopPropagation();setShowVisits(true);}} style={{fontSize:10,fontWeight:500,padding:"2px 6px",borderRadius:10,background:"#2A1E05",color:"#EF9F27",border:"0.5px solid #EF9F27",flexShrink:0,cursor:"pointer"}}>{visits}×</span>
                )}
              </div>
              <div style={{fontSize:12,color:"#888780",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{orders||group[0].category}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:500,color:display.color}}>{display.val}</div>
              <div style={{fontSize:11,color:display.color}}>{display.label}</div>
            </div>
            <div style={{fontSize:10,color:"#888780",marginLeft:2}}>{exp?"▲":"▼"}</div>
          </div>
          {exp&&(
            <div style={{padding:"0 14px 12px 70px",borderTop:"0.5px solid rgba(255,255,255,0.07)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:10}}>
                {[[t.taste,avgTaste.toFixed(1)],["Cost","$"+avgCost.toFixed(2)],[t.wait,avgWait.toFixed(0)+" min"],["Repeat","⭐".repeat(avgRepeat)||"✕"],["Score",avgScore!=null?avgScore.toFixed(2):"—"],["Visits",String(visits)]].map(([k,v])=>(
                  <div key={k}><div style={{fontSize:10,color:"#888780"}}>{k}</div><div style={S.val}>{v}</div></div>
                ))}
              </div>
              {group[group.length-1].notes&&<div style={{marginTop:10,fontSize:11,color:"#888780"}}><span style={{fontWeight:500}}>Note: </span>{group[group.length-1].notes}</div>}
            </div>
          )}
        </div>
      </SwipeRow>
    </>
  );
}

// ── Cafe row & form ────────────────────────────────────────────────────────────
function Pill({active,children,onClick}) {
  return <div onClick={onClick} style={{padding:"4px 10px",borderRadius:14,border:"none",fontSize:11,cursor:"pointer",transition:"all 0.15s",background:active?"#F0997B":"transparent",color:active?"#141413":"#888780",fontWeight:active?500:400}}>{children}</div>;
}

function OrderPills({item, onUpdate, orderOptions}) {
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

function OrderAutocomplete({value, onChange, pastOrders, placeholder}) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const filtered = value.trim().length > 0
    ? [...new Set(pastOrders)].filter(o => o.toLowerCase().includes(value.trim().toLowerCase()) && o.toLowerCase() !== value.trim().toLowerCase())
    : [];
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setShow(false);}
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <input value={value} onChange={e=>{onChange(e.target.value);setShow(true);}} onFocus={()=>setShow(true)} placeholder={placeholder} style={S.wb}/>
      {show&&filtered.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,zIndex:100,maxHeight:160,overflowY:"auto",marginTop:4}}>
          {filtered.map(o=>(
            <div key={o} onMouseDown={()=>{onChange(o);setShow(false);}} style={{padding:"8px 12px",fontSize:13,color:"#F1EFE8",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="#2C2C2A"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function CafeItemBlock({item, idx, onUpdate, onRemove, canRemove, pastOrders}) {
  const {t} = useLang();
  const orderOptions = CAFE_ORDERS[item.category];
  const score = calcCafe(+item.taste,+item.cost,+item.portions,0,false,0);
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
        <FL>{t.category}</FL>
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
          <FL>Bean region <span style={{color:"#888780",fontWeight:400,fontSize:11}}>(optional)</span></FL>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {["Africa","Central America","South America","Asia-Pacific","Blend","Unknown"].map(b=>(
              <div key={b} onClick={()=>onUpdate({...item,beanRegion:item.beanRegion===b?"":b})} style={{padding:"6px 4px",borderRadius:8,textAlign:"center",cursor:"pointer",fontSize:11,background:item.beanRegion===b?"#3C1F13":"#1E1E1C",border:"1px solid "+(item.beanRegion===b?"#F0997B":"rgba(255,255,255,0.1)"),color:item.beanRegion===b?"#F0997B":"#888780"}}>{b}</div>
            ))}
          </div>
        </div>
      )}
      {/* Order */}
      <div style={{marginBottom:12}}>
        <FL>{t.order}</FL>
        {orderOptions ? (
          <OrderPills item={item} onUpdate={onUpdate} orderOptions={orderOptions}/>
        ) : (
          <OrderAutocomplete value={item.order} onChange={v=>onUpdate({...item,order:v,_customOrder:false})} pastOrders={pastOrders} placeholder={t.anythingMemorable}/>
        )}
      </div>
      {/* Taste */}
      <div style={{marginBottom:12}}>
        <FL>Taste — <span style={{color:"#F0997B"}}>{item.taste} · {tasteLabel(item.taste,t)}</span></FL>
        <input type="range" min="0" max="10" step="0.1" value={item.taste} onChange={e=>onUpdate({...item,taste:+e.target.value})} style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888780",marginTop:2}}><span>0 sucks</span><span>5 avg</span><span>10 incredible</span></div>
      </div>
      {/* Cost + Portions */}
      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <div style={S.f1}><FL>{t.totalCost}</FL><input type="number" value={item.cost} onChange={e=>onUpdate({...item,cost:e.target.value})} placeholder="$" style={S.wb}/></div>
        <div style={S.f1}><FL>{t.portions}</FL><input type="number" min="0.5" step="0.5" value={item.portions} onChange={e=>onUpdate({...item,portions:+e.target.value})} style={S.wb}/></div>
      </div>
      {/* Coffee/Tea extras */}
      {item.category==="Coffee"&&(
        <div style={{marginTop:10}}>
          <FL>{t.milk}</FL>
          <div style={S.row8}>
            {["None","Light","Medium","Heavy"].map(m=><div key={m} onClick={()=>onUpdate({...item,milkLevel:m})} style={{flex:1,padding:"6px",borderRadius:8,textAlign:"center",cursor:"pointer",fontSize:11,background:item.milkLevel===m?"#3C1F13":"#1E1E1C",border:"1px solid "+(item.milkLevel===m?"#F0997B":"rgba(255,255,255,0.1)"),color:item.milkLevel===m?"#F0997B":"#888780"}}>{m}</div>)}
          </div>

        </div>
      )}
    </div>
  );
}

function CafeForm({initial,onSave,onCancel,addType,setAddType,existingNames,existingCafes,pastOrders}) {
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

  return (
    <div style={{...S.card,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        {addType!==undefined?(
          <div style={{display:"flex",gap:0,background:"#141413",borderRadius:20,padding:3}}>
            <Pill active={addType==="restaurant"} onClick={()=>setAddType("restaurant")}>{t.restaurantTab}</Pill>
            <Pill active={addType==="cafe"} onClick={()=>setAddType("cafe")}>{t.cafeTab}</Pill>
          </div>
        ):<div/>}
        {(()=>{
          const sc=items[0]?calcCafe(+items[0].taste,+items[0].cost,+items[0].portions,0,false,0):null;
          return(
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:22,fontWeight:600,color:scoreColor(sc),lineHeight:1}}>{sc!=null?sc.toFixed(2):"—"}</div>
              <div style={{fontSize:11,color:cafeScoreColor(sc)}}>{cafeScoreLabel(sc)}</div>
            </div>
          );
        })()}
      </div>

      {/* ── The basics ── */}
      <SL>{t.theBasics}</SL>
      <div style={S.mb16}>
        <FL>{t.cafeName}</FL>
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
        <div style={S.f1}><FL>{t.waitMins}</FL><input type="number" min="0" step="1" value={wait} onChange={e=>setWait(e.target.value)} style={S.wb}/></div>
      </div>

      {/* ── Items ── */}
      <div style={S.sec}><SL>{t.cafeItems}</SL></div>
      {items.map((item,idx)=>(
        <CafeItemBlock key={idx} item={item} idx={idx} onUpdate={val=>updateItem(idx,val)} onRemove={()=>removeItem(idx)} canRemove={items.length>1} pastOrders={pastOrders||[]}/>
      ))}
      {sub&&items.some(it=>!it.cost)&&<div style={{...S.err,marginBottom:10}}>All items need a cost</div>}
      <button onClick={addItem} style={{width:"100%",padding:"9px",borderRadius:8,background:"transparent",border:"1px dashed rgba(255,255,255,0.2)",color:"#888780",fontSize:13,cursor:"pointer",marginBottom:16}}>{t.addAnotherItem}</button>

      {/* ── Repeatability ── */}
      <div style={S.sec}><SL>{t.repeatability}</SL></div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><Toggle on={useR} onClick={()=>setUseR(r=>!r)}/><span style={{fontSize:13,color:"#888780"}}>{t.includeInScore}</span></div>
      {useR&&<div style={S.mb16}><FL>Repeatability — <span style={{color:"#F0997B"}}>{"⭐".repeat(repeatability)||"✕"}</span></FL><RepeatPicker value={repeatability} onChange={setRepeatability}/></div>}

      {/* ── Notes ── */}
      <div style={S.sec}><SL>{t.notes}</SL></div>
      <div style={{marginBottom:20}}><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t.anythingMemorable} rows={2} style={{width:"100%",boxSizing:"border-box",resize:"vertical"}}/></div>
      <div style={S.row8}>
        <button onClick={onCancel} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:14,cursor:"pointer"}}>{t.cancel}</button>
        <button onClick={save} style={{flex:2,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:15,fontWeight:500,cursor:"pointer"}}>Save {items.length>1?items.length+" items":""}</button>
      </div>
    </div>
  );
}

// ── Donut chart ────────────────────────────────────────────────────────────────
function DonutChart({slices,total}) {
  const [hov,setHov] = useState(null);
  const S=180,CX=90,CY=90,R=78,RI=50;
  let ang = -Math.PI/2;
  const paths = slices.filter(s=>s.count>0).map(s=>{
    const frac=s.count/total,sw=frac*2*Math.PI,a1=ang+0.025,a2=ang+sw-0.025;
    ang+=sw;if(a2<=a1)return null;
    const c1=Math.cos(a1),s1=Math.sin(a1),c2=Math.cos(a2),s2=Math.sin(a2),lg=sw>Math.PI?1:0;
    const d="M "+(CX+R*c1)+" "+(CY+R*s1)+" A "+R+" "+R+" 0 "+lg+" 1 "+(CX+R*c2)+" "+(CY+R*s2)+" L "+(CX+RI*c2)+" "+(CY+RI*s2)+" A "+RI+" "+RI+" 0 "+lg+" 0 "+(CX+RI*c1)+" "+(CY+RI*s1)+" Z";
    return {...s,d,frac,mid:a1+(a2-a1)/2};
  }).filter(Boolean);
  const active = hov?paths.find(s=>s.region===hov):null;
  function splitL(n){if(n.length<=13)return[n];const b=n.lastIndexOf(" ",13);if(b<=3)return[n.slice(0,13),n.slice(13)];return[n.slice(0,b),n.slice(b+1)];}
  return (
    <svg width={S} height={S} viewBox={"0 0 "+S+" "+S} style={{flexShrink:0,overflow:"visible"}}>
      {paths.map(s=>{
        const ih=hov===s.region,tx=ih?Math.cos(s.mid)*4:0,ty=ih?Math.sin(s.mid)*4:0;
        return <path key={s.region} d={s.d} fill={s.color} opacity={hov&&!ih?0.35:1}
          style={{transform:"translate("+tx+"px,"+ty+"px)",transformOrigin:CX+"px "+CY+"px",transition:"all 0.15s",cursor:"pointer"}}
          onMouseEnter={()=>setHov(s.region)} onMouseLeave={()=>setHov(null)}/>;
      })}
      {active?(()=>{const ls=splitL(active.region),h=ls.length*13,y=CY-h/2+6;return(
        <g>
          <text x={CX} y={y-14} textAnchor="middle" fill={active.color} fontSize={14} fontWeight="600">{Math.round(active.frac*100)}%</text>
          {ls.map((l,i)=><text key={i} x={CX} y={y+i*13} textAnchor="middle" fill={"#F1EFE8"} fontSize={9}>{l}</text>)}
          <text x={CX} y={y+h+6} textAnchor="middle" fill={"#888780"} fontSize={9}>{active.count} {active.count===1?"place":"places"}</text>
        </g>
      );})():(
        <g>
          <text x={CX} y={CY-4} textAnchor="middle" fill={"#F1EFE8"} fontSize={22} fontWeight="500">{total}</text>
          <text x={CX} y={CY+13} textAnchor="middle" fill={"#888780"} fontSize={10}>places</text>
        </g>
      )}
    </svg>
  );
}

// ── Suggestions ──────────────────────────────────────────────────────────────────
function SuggestView({entries,onBack}) {
  const {t,lang} = useLang();
  const logged = new Set(entries.map(e=>e.cuisine&&e.cuisine.trim()));
  const untried = ALL_CUISINES.filter(x=>!logged.has(x));
  const [pick,setPick] = useState(null);
  const [search,setSearch] = useState("");
  const filt = search.trim().length>0 ? ALL_CUISINES.filter(x=>x.toLowerCase().startsWith(search.toLowerCase())) : [];

  function surprise() {
    if(!untried.length)return;
    setPick(untried[Math.floor(Math.random()*untried.length)]);
    setSearch("");
  }

  return (
    <div>
      <button onClick={onBack} style={{fontSize:12,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:20}}>{t.backToQuests}</button>
      <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"1.5rem",textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:24,marginBottom:8}}>✨</div>
        <div style={{fontSize:15,fontWeight:500,color:"#F1EFE8",marginBottom:6}}>{t.moodFor}</div>
        <div style={{fontSize:13,color:"#888780",marginBottom:16}}>{lang==="zh"?untried.length+t.cuisinesUntried:untried.length+" "+t.cuisinesUntried}</div>
        <button onClick={surprise} style={{padding:"10px 24px",borderRadius:20,background:"#F0997B",color:"#141413",border:"none",fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:16}}>{t.surpriseMe}</button>
        <div style={{fontSize:11,color:"#888780",marginBottom:8}}>{t.orSearch}</div>
        <div style={{position:"relative",maxWidth:260,margin:"0 auto",textAlign:"left"}}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPick(null);}} placeholder={t.searchPlaceholder} style={S.wb}/>
          {filt.length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,zIndex:100,maxHeight:160,overflowY:"auto",marginTop:4}}>
              {filt.map(x=>(
                <div key={x} onMouseDown={()=>{setPick(x);setSearch(x);}} style={{padding:"8px 12px",fontSize:13,color:"#F1EFE8",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#2C2C2A"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {FLAGS[x]?FLAGS[x]+" ":""}{x}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {pick&&(()=>{
        const isLogged = logged.has(pick);
        const myEntries = entries.filter(e=>e.cuisine&&e.cuisine.trim()===pick);
        return (
        <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"1.5rem"}}>
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:40,marginBottom:8}}>{FLAGS[pick]||"🍽️"}</div>
            <div style={{fontSize:11,color:"#F0997B",fontWeight:500,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:4}}>{pick}</div>
            <div style={S.sm}>{REGION_MAP[pick]||"Unknown region"}</div>
            {isLogged&&<div style={{fontSize:11,color:"#97C459",marginTop:6,fontWeight:500}}>✓ {lang==="zh"?"你已去過這個料理":"You've been here before"}</div>}
          </div>
          {isLogged&&myEntries.length>0&&(
            <div style={{marginBottom:12}}>
              {myEntries.map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:"#141413",borderRadius:8,marginBottom:6}}>
                  <span style={{fontSize:13,color:"#F1EFE8",fontWeight:500}}>{e.name}</span>
                  <span style={{fontSize:12,color:"#888780"}}>{"⭐".repeat(e.repeatability)||"✕"} · BITE {(()=>{const s=calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,null);return s!=null?s.toFixed(2):"—";})()}</span>
                </div>
              ))}
            </div>
          )}
          <a href={"https://www.google.com/maps/search/"+encodeURIComponent(pick+" restaurant New York City")} target="_blank" rel="noopener noreferrer"
            style={{display:"block",textAlign:"center",marginTop:12,fontSize:12,color:"#5B9BD5",textDecoration:"none"}}>
            📍 Find on Maps
          </a>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={surprise} style={{flex:1,padding:"9px",borderRadius:8,background:"transparent",border:"0.5px solid rgba(255,255,255,0.1)",color:"#888780",fontSize:13,cursor:"pointer"}}>{t.tryAnother}</button>
            <button onClick={()=>{setPick(null);setSearch("");}} style={{flex:1,padding:"9px",borderRadius:8,background:"#3C1F13",border:"0.5px solid #F0997B",color:"#F0997B",fontSize:13,cursor:"pointer"}}>{t.startOver}</button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

// ── Palette ────────────────────────────────────────────────────────────────────
function DrinksPalette({cafes,cafeWeights,updateCafeW,resetCafeWeights,cafeTotalW,cafeWErr}) {
  const {t,lang} = useLang();
  const drinks = cafes.filter(e=>["Coffee","Tea","Other"].includes(e.category));
  const total = drinks.length;
  const [editingW,setEditingW] = useState(false);

  if(!total) return <p style={{color:"#888780",fontSize:14}}>{t.noDrinks}</p>;

  const avgT=(drinks.reduce((a,e)=>a+e.taste,0)/total).toFixed(1);
  const avgC=(drinks.reduce((a,e)=>a+e.cost,0)/total).toFixed(2);

  const orderCounts={};drinks.forEach(e=>{const k=e.order||e.category;orderCounts[k]=(orderCounts[k]||0)+1;});
  const topOrder=Object.entries(orderCounts).sort((a,b)=>b[1]-a[1])[0];
  // Only count entries where milkLevel was actually logged
  const drinksWithMilk=drinks.filter(e=>e.milkLevel&&e.milkLevel.trim()!=="");
  const milkCounts={};drinksWithMilk.forEach(e=>{milkCounts[e.milkLevel]=(milkCounts[e.milkLevel]||0)+1;});
  const milkEntries=Object.entries(milkCounts).sort((a,b)=>b[1]-a[1]);
  const topMilk=milkEntries[0]; // most common logged milk level
  const noneCount=milkCounts["None"]||0; // only actual "None" selections, not blanks
  const beanCounts={};drinks.forEach(e=>{if(e.beanRegion)beanCounts[e.beanRegion]=(beanCounts[e.beanRegion]||0)+1;});
  const beanEntries=Object.entries(beanCounts).sort((a,b)=>b[1]-a[1]);
  const topBean=beanEntries[0];
  const scored=drinks.map(e=>({...e,sc:calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)})).sort((a,b)=>(b.sc??0)-(a.sc??0));
  const best=scored[0];

  const hasEnoughData = total >= 3;
  const [drinkRoastMode, setDrinkRoastMode] = useState(false);

  // Only derive milk line if enough logged milk data exists
  const hasMilkData = drinksWithMilk.length >= 3;
  const milkMajority = topMilk && topMilk[1] >= 2 ? topMilk[0] : null; // needs at least 2 entries

  // PR lines — only use data we actually have
  const personality=+avgT>=8?"You have high standards in a cup.":+avgT>=7?"You know what good coffee tastes like.":+avgT>=6?"You're still finding your go-to.":"Lorelai Gilmore would be disappointed in your coffee consumption.";
  const milkLine = !hasEnoughData||!hasMilkData ? null
    : milkMajority==="None" ? "You take your drinks black."
    : milkMajority ? "You lean "+milkMajority.toLowerCase()+" milk."
    : null;
  const beanLine = !hasEnoughData ? null : topBean ? "Your beans tend to come from "+topBean[0]+"." : null;
  const notEnoughLine = !hasEnoughData ? (drinkRoastMode ? "You want me to give you a personality read when you've logged less than 3 coffees? Log more and come back." : "Lorelai Gilmore would be disappointed in your coffee logging frequency.") : null;

  // Roast lines
  const roastPersonality=+avgT>=8?"You rate your own coffee higher than you rate most people. That's fine. Coffee is more reliable.":+avgT>=7?"You think you have good taste in coffee. You're not wrong but you're also not making it yourself, so let's not get too comfortable.":+avgT>=6?"You're drinking coffee for the ritual, not the taste. Own it.":"Your coffee taste scores are telling me you need to either raise your standards or switch to tea.";
  const roastMilkLine = !hasEnoughData||!hasMilkData ? null
    : milkMajority==="None" ? "You drink it black. Either great taste or a complicated personality. Possibly both."
    : milkMajority ? "You take "+milkMajority.toLowerCase()+" milk. One customization away from a Starbucks regular order."
    : null;
  const roastBeanLine = !hasEnoughData ? null : topBean ? "You keep going back to "+topBean[0]+" beans. At this point just move there." : null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{...S.card}}>
        <div style={{...S.lbl,marginBottom:10}}>Weights</div>
        <WeightSliders weights={cafeWeights} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"]]} onUpdate={updateCafeW} onReset={resetCafeWeights} defaults={{taste:70,bpb:30}}/>
        <div style={{fontSize:10,color:"#888780",marginTop:8,textAlign:"right"}}>Max score at these weights: <span style={{color:"#F0997B",fontWeight:500}}>{calcMaxBite(cafeWeights).toFixed(1)}</span></div>
      </div>
      <div style={{...S.card}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{...S.lbl,marginBottom:0}}>{t.coffeePersonality}</div>
          <div onClick={()=>setDrinkRoastMode(r=>!r)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",background:drinkRoastMode?"#2A1E05":"#1A2E0A",border:"1px solid "+(drinkRoastMode?"#EF9F27":"#97C459"),borderRadius:20,padding:"4px 10px"}}>
            <span style={{fontSize:11,color:drinkRoastMode?"#EF9F27":"#97C459",fontWeight:500}}>{drinkRoastMode?t.roastMe:t.prVersion}</span>
          </div>
        </div>
        <p style={{fontSize:13,color:"#F1EFE8",margin:"0 0 6px",lineHeight:1.65,fontWeight:500}}>{drinkRoastMode?roastPersonality:personality}</p>
        {(drinkRoastMode?roastMilkLine:milkLine)&&<p style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>{drinkRoastMode?roastMilkLine:milkLine}</p>}
        {(drinkRoastMode?roastBeanLine:beanLine)&&<p style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>{drinkRoastMode?roastBeanLine:beanLine}</p>}
        {topOrder&&hasEnoughData&&<p style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>Your go-to order: <span style={{color:"#F1EFE8",fontWeight:500}}>{topOrder[0]}</span>.</p>}
        {notEnoughLine&&<p style={{fontSize:13,color:"#888780",margin:0,lineHeight:1.65,fontStyle:"italic"}}>{notEnoughLine}</p>}
      </div>

      <div style={{...S.card}}>
        <div style={{...S.lbl,marginBottom:14}}>Bean breakdown</div>
        {(()=>{
          const BEAN_COLORS={"Africa":"#97C459","Central America":"#F0997B","South America":"#EF9F27","Asia-Pacific":"#5B9BD5","Blend":"#AFA9EC","Unknown":"#888780"};
          const ALL_BEANS=["Africa","Central America","South America","Asia-Pacific","Blend","Unknown"];
          const coffeeOnly=drinks.filter(e=>e.category==="Coffee"&&e.beanRegion);
          const coffeeTotal=coffeeOnly.length;
          const bc={};coffeeOnly.forEach(e=>{bc[e.beanRegion]=(bc[e.beanRegion]||0)+1;});
          const scored2=coffeeOnly.map(e=>({...e,sc:calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)}));
          const topBeanRegion=Object.entries(bc).sort((a,b)=>b[1]-a[1])[0];
          const bestByBean=topBeanRegion?scored2.filter(e=>e.beanRegion===topBeanRegion[0]).sort((a,b)=>(b.sc??0)-(a.sc??0))[0]:null;
          const avgBiteBean=coffeeTotal?(scored2.reduce((a,e)=>a+(e.sc??0),0)/coffeeTotal).toFixed(2):"—";
          const avgTasteBean=coffeeTotal?(coffeeOnly.reduce((a,e)=>a+e.taste,0)/coffeeTotal).toFixed(1):"—";
          const avgSpendBean=coffeeTotal?"$"+(coffeeOnly.reduce((a,e)=>a+e.cost,0)/coffeeTotal).toFixed(2):"—";
          const regionsLogged=Object.keys(bc).filter(k=>k!=="Unknown"&&k!=="Blend").length;

          // Simple donut
          const S2=160,CX2=80,CY2=80,R2=68,RI2=44;
          let ang2=-Math.PI/2;
          const paths2=coffeeTotal>0?ALL_BEANS.filter(b=>bc[b]>0).map(b=>{
            const count=bc[b],frac=count/coffeeTotal,sw=frac*2*Math.PI;
            const a1=ang2+0.03,a2=ang2+sw-0.03; ang2+=sw;
            if(a2<=a1)return null;
            const c1=Math.cos(a1),s1=Math.sin(a1),c2=Math.cos(a2),s2=Math.sin(a2),lg=sw>Math.PI?1:0;
            return {b,count,frac,color:BEAN_COLORS[b]||"#888780",
              d:"M "+(CX2+R2*c1)+" "+(CY2+R2*s1)+" A "+R2+" "+R2+" 0 "+lg+" 1 "+(CX2+R2*c2)+" "+(CY2+R2*s2)+" L "+(CX2+RI2*c2)+" "+(CY2+RI2*s2)+" A "+RI2+" "+RI2+" 0 "+lg+" 0 "+(CX2+RI2*c1)+" "+(CY2+RI2*s1)+" Z"};
          }).filter(Boolean):[];

          // Grey ring for empty state
          // Full circle paths for empty state
          const emptyRingOuter="M "+(CX2+R2)+" "+CY2+" A "+R2+" "+R2+" 0 1 1 "+(CX2+R2-0.001)+" "+(CY2-0.001)+" Z";
          const emptyRingD="M "+(CX2+R2)+" "+CY2+" A "+R2+" "+R2+" 0 1 1 "+(CX2-R2)+" "+CY2+" A "+R2+" "+R2+" 0 1 1 "+(CX2+R2)+" "+CY2+" M "+(CX2+RI2)+" "+CY2+" A "+RI2+" "+RI2+" 0 1 0 "+(CX2-RI2)+" "+CY2+" A "+RI2+" "+RI2+" 0 1 0 "+(CX2+RI2)+" "+CY2+" Z";

          return (
            <div>
              <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:16}}>
                <svg width={S2} height={S2} viewBox={"0 0 "+S2+" "+S2} style={{flexShrink:0}}>
                  {paths2.length>0
                    ? paths2.map(p=><path key={p.b} d={p.d} fill={p.color}/>)
                    : <><circle cx={CX2} cy={CY2} r={R2} fill="#2C2C2A"/><circle cx={CX2} cy={CY2} r={RI2} fill="#141413"/></>
                  }
                  <text x={CX2} y={CY2-4} textAnchor="middle" fill={coffeeTotal?"#F1EFE8":"#444441"} fontSize={20} fontWeight="500">{coffeeTotal||"?"}</text>
                  <text x={CX2} y={CY2+12} textAnchor="middle" fill="#888780" fontSize={9}>{coffeeTotal?"coffees":"log origin"}</text>
                </svg>
                <div style={{flex:1}}>
                  {ALL_BEANS.filter(b=>b!=="Blend"&&b!=="Unknown").map(b=>{
                    const count=bc[b]||0;
                    const hasData=count>0;
                    return (
                    <div key={b} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                      <div style={{width:8,height:8,borderRadius:2,background:hasData?(BEAN_COLORS[b]||"#888780"):"#2C2C2A",flexShrink:0}}/>
                      <span style={{fontSize:12,color:hasData?"#888780":"#444441",flex:1}}>{b}</span>
                      <span style={{fontSize:12,color:hasData?"#F1EFE8":"#444441",fontWeight:500}}>{hasData?count:0}</span>
                      <span style={{fontSize:11,color:"#444441",width:30,textAlign:"right"}}>{hasData?Math.round(count/coffeeTotal*100)+"%":"0%"}</span>
                    </div>
                  );})}
                </div>
              </div>

            </div>
          );
        })()}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
        {[
          [t.bestDrink, best?best.name+(best.order?" ("+best.order+")":""):"—"],
          ["Top rated", best?best.name:"—"],
          ["Avg BITE", (drinks.reduce((a,e)=>a+(calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0),0)/total).toFixed(2)],
          [t.avgTaste, avgT+"/10"],
          [t.avgCost, "$"+avgC],
          [t.totalDrinks, String(total)],
        ].map(([label,val])=>(
          <div key={label} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:10,color:"#888780",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
            <div style={{fontSize:13,fontWeight:500,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SweetsPalette({cafes, cafeWeights, updateCafeW, resetCafeWeights}) {
  const {t,lang} = useLang();
  // Note: uses same weights as Drinks
  const sweets = cafes.filter(e=>e.category==="Sweets");
  const total = sweets.length;
  if(!total) return <p style={{color:"#888780",fontSize:14}}>{t.noSweets}</p>;

  const scored = [...sweets].map(e=>({...e,sc:calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)})).sort((a,b)=>(b.sc??0)-(a.sc??0));
  const avgT=(sweets.reduce((a,e)=>a+e.taste,0)/total).toFixed(1);
  const mustReturn=sweets.filter(e=>e.repeatability===3).length;
  const mustReturnPct=Math.round(mustReturn/total*100);

  // Order type breakdown
  const orderCounts={};sweets.forEach(e=>{const k=e.order||"Other";orderCounts[k]=(orderCounts[k]||0)+1;});
  const orderEntries=Object.entries(orderCounts).sort((a,b)=>b[1]-a[1]);
  const topOrder=orderEntries[0];

  // Underrated = high BITE but not #1 taste
  const byBite=[...scored];
  const byTaste=[...sweets].sort((a,b)=>b.taste-a.taste);
  const underrated=byBite.find(e=>e.id!==byTaste[0]?.id);

  const [sweetsRoastMode, setSweetsRoastMode] = useState(false);

  // PR lines
  const personality=+avgT>=8?"You have elite taste in pastries. Literally.":+avgT>=7?"You know a good croissant when you eat one.":+avgT>=6?"You are adventurous, for better or worse.":"You are either very picky or very unlucky.";
  const mustReturnLine=mustReturnPct>=50?"More than half your sweets visits ended in ⭐⭐⭐. Your standards are high and your bakeries know it.":mustReturnPct>0?mustReturnPct+"% of your sweets visits ended in ⭐⭐⭐.":"You haven't given ⭐⭐⭐ to a single sweet yet. Tough crowd.";
  const topOrderLine=topOrder?(topOrder[1]>1?"Your go-to: "+topOrder[0]+", ordered "+topOrder[1]+" times so far.":"You've been branching out — no single order dominates yet."):null;

  // Roast lines
  const roastPersonality=+avgT>=8?"You rate pastries like you're judging a competition. No one asked for the breakdown but here we are.":+avgT>=7?"You think a croissant is acceptable. A croissant. The bare minimum of pastry achievement.":+avgT>=6?"You will eat almost anything if it's baked. That's not a compliment.":"Your sweets scores are concerning. Are you okay? Have you tried not ordering things you don't like?";
  const roastMustReturnLine=mustReturnPct>=50?"You gave ⭐⭐⭐ to over half your sweets. Either everything is genuinely amazing or your bar has simply ceased to exist.":mustReturnPct>0?"Only "+mustReturnPct+"% of your sweets made the cut for ⭐⭐⭐. You are either very discerning or very hard to please.":"Zero ⭐⭐⭐ on any sweet. You are the villain in every pastry chef's origin story.";
  const roastTopOrderLine=topOrder?(topOrder[1]>1?"You have ordered "+topOrder[0]+" "+topOrder[1]+" times. At this point it's a personality trait, not a preference.":"Still figuring out your sweet spot. Literally."):null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{...S.card}}>
        <div style={{...S.lbl,marginBottom:10}}>Weights</div>
        <WeightSliders weights={cafeWeights} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"]]} onUpdate={updateCafeW} onReset={resetCafeWeights} defaults={{taste:70,bpb:30}}/>
        <div style={{fontSize:10,color:"#888780",marginTop:8}}>Same weights as drinks</div>
      </div>
      <div style={{...S.card}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{...S.lbl,marginBottom:0}}>{t.sweetsPersonality}</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div onClick={()=>setSweetsRoastMode(r=>!r)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",background:sweetsRoastMode?"#2A1E05":"#1A2E0A",border:"1px solid "+(sweetsRoastMode?"#EF9F27":"#97C459"),borderRadius:20,padding:"4px 10px"}}>
              <span style={{fontSize:11,color:sweetsRoastMode?"#EF9F27":"#97C459",fontWeight:500}}>{sweetsRoastMode?t.roastMe:t.prVersion}</span>
            </div>
            <div style={{fontSize:10,color:"#888780"}}>Same weights as drinks</div>
          </div>
        </div>
        <p style={{fontSize:13,color:"#F1EFE8",margin:"0 0 6px",lineHeight:1.65,fontWeight:500}}>{sweetsRoastMode?roastPersonality:personality}</p>
        {topOrderLine&&<p style={{fontSize:13,color:"#888780",margin:"0 0 6px",lineHeight:1.65}}>{sweetsRoastMode?roastTopOrderLine:topOrderLine}</p>}
        <p style={{fontSize:13,color:"#888780",margin:0,lineHeight:1.65}}>{sweetsRoastMode?roastMustReturnLine:mustReturnLine}</p>
      </div>

      <div style={{...S.card}}>
        <div style={{...S.lbl,marginBottom:14}}>Sweets breakdown</div>
        {(()=>{
          // Map free-text orders to canonical types
          const TYPE_MAP=[
            ["Croissant",["croissant"]],
            ["Pain au Chocolat",["pain au choc","chocolate croissant"]],
            ["Danish",["danish"]],
            ["Tart",["tart","nata","natas","custard"]],
            ["Soft Serve",["soft serve","softserve","soft-serve"]],
            ["Ice Cream",["ice cream","gelato","sorbet"]],
            ["Muffin",["muffin"]],
            ["Cookie",["cookie"]],
            ["Scone",["scone"]],
            ["Cake",["cake","slice"]],
            ["Brownie",["brownie"]],
            ["Parfait",["parfait"]],
          ];
          function classify(order) {
            if(!order) return "Other";
            const low=order.toLowerCase();
            for(const [type,keywords] of TYPE_MAP) {
              if(keywords.some(k=>low.includes(k))) return type;
            }
            return "Other";
          }
          const TYPE_COLORS={"Croissant":"#F0997B","Pain au Chocolat":"#D85A30","Danish":"#EF9F27","Tart":"#97C459","Soft Serve":"#9FE1CB","Ice Cream":"#5B9BD5","Muffin":"#AFA9EC","Cookie":"#FAC775","Scone":"#F5C4B3","Cake":"#E24B4A","Brownie":"#7F77DD","Parfait":"#1D9E75","Other":"#888780"};
          const typeCounts={};sweets.forEach(e=>{const k=classify(e.order);typeCounts[k]=(typeCounts[k]||0)+1;});
          const typeEntries=Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]);
          const topType=typeEntries[0];
          const best2=scored[0];
          const avgBiteSweets=total?(sweets.reduce((a,e)=>a+(calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0),0)/total).toFixed(2):"—";
          const avgCostSweets=total?"$"+(sweets.reduce((a,e)=>a+e.cost,0)/total).toFixed(2):"—";

          const S2=160,CX2=80,CY2=80,R2=68,RI2=44;
          let ang2=-Math.PI/2;
          const paths2=typeEntries.map(([b,count])=>{
            const frac=count/total,sw=frac*2*Math.PI;
            const a1=ang2+0.03,a2=ang2+sw-0.03; ang2+=sw;
            if(a2<=a1)return null;
            const c1=Math.cos(a1),s1=Math.sin(a1),c2=Math.cos(a2),s2=Math.sin(a2),lg=sw>Math.PI?1:0;
            return {b,count,frac,color:TYPE_COLORS[b]||"#888780",
              d:"M "+(CX2+R2*c1)+" "+(CY2+R2*s1)+" A "+R2+" "+R2+" 0 "+lg+" 1 "+(CX2+R2*c2)+" "+(CY2+R2*s2)+" L "+(CX2+RI2*c2)+" "+(CY2+RI2*s2)+" A "+RI2+" "+RI2+" 0 "+lg+" 0 "+(CX2+RI2*c1)+" "+(CY2+RI2*s1)+" Z"};
          }).filter(Boolean);

          return (
            <div>
              <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:16}}>
                <svg width={S2} height={S2} viewBox={"0 0 "+S2+" "+S2} style={{flexShrink:0}}>
                  {paths2.map(p=><path key={p.b} d={p.d} fill={p.color}/>)}
                  <text x={CX2} y={CY2-4} textAnchor="middle" fill="#F1EFE8" fontSize={20} fontWeight="500">{total}</text>
                  <text x={CX2} y={CY2+12} textAnchor="middle" fill="#888780" fontSize={9}>sweets</text>
                </svg>
                <div style={{flex:1}}>
                  {typeEntries.map(([b,count])=>(
                    <div key={b} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                      <div style={{width:8,height:8,borderRadius:2,background:TYPE_COLORS[b]||"#888780",flexShrink:0}}/>
                      <span style={{fontSize:12,color:"#888780",flex:1}}>{b}</span>
                      <span style={{fontSize:12,color:"#F1EFE8",fontWeight:500}}>{count}</span>
                      <span style={{fontSize:11,color:"#888780",width:34,textAlign:"right"}}>{Math.round(count/total*100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                {[
                  ["Top type", topType?topType[0]:"—"],
                  ["Top rated", best2?best2.name+(best2.order?" · "+best2.order:""):"—"],
                  ["Avg BITE", avgBiteSweets],
                  [t.avgTaste, avgT+"/10"],
                  ["Avg spend", avgCostSweets],
                  [t.totalSweets, String(total)],
                ].map(([label,val])=>(
                  <div key={label} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:10,color:"#888780",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:13,fontWeight:500,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function StatCard({label,val,note}) {
  const [show,setShow] = useState(false);
  return (
    <div style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px",position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:10,color:"#888780",letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</div>
        {note&&<div onClick={e=>{e.stopPropagation();setShow(s=>!s);}} style={{width:16,height:16,borderRadius:"50%",border:"1px solid #888780",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <span style={{fontSize:10,color:"#888780",lineHeight:1}}>i</span>
        </div>}
      </div>
      <div style={{fontSize:14,fontWeight:500,color:"#F1EFE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</div>
      {show&&note&&(
        <div onClick={()=>setShow(false)} style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#2C2C2A",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"10px 12px",marginTop:4,fontSize:12,color:"#F1EFE8",lineHeight:1.6,cursor:"pointer"}}>
          {note}
        </div>
      )}
    </div>
  );
}

function InfoBubble({content}) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    if(!show) return;
    function h(e){if(ref.current&&!ref.current.contains(e.target))setShow(false);}
    document.addEventListener("mousedown",h);
    document.addEventListener("touchstart",h);
    return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("touchstart",h);};
  },[show]);
  return (
    <div ref={ref} style={{position:"relative",display:"inline-flex",flexShrink:0}}>
      <div onClick={e=>{e.stopPropagation();setShow(s=>!s);}} style={{width:18,height:18,borderRadius:"50%",background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,color:"#888780",fontWeight:600,flexShrink:0}}>i</div>
      {show&&(
        <div style={{position:"absolute",top:24,left:"50%",transform:"translateX(-50%)",background:"#2C2C2A",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#F1EFE8",zIndex:999,width:240,lineHeight:1.6,boxShadow:"0 4px 16px rgba(0,0,0,0.7)"}}>
          {content}
        </div>
      )}
    </div>
  );
}

function WelcomeWeights({weights, onUpdate, alwaysOpen}) {
  const {t} = useLang();
  const [open, setOpen] = useState(false);
  const isOpen = alwaysOpen || open;
  return (
    <div style={{borderTop:"0.5px solid rgba(255,255,255,0.08)",paddingTop:14,marginTop:4}}>
      {!alwaysOpen&&(
        <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",padding:0,marginBottom:open?10:0}}>
          <span style={{fontSize:12,color:"#888780"}}>Customize weights</span>
          <span style={{fontSize:11,color:"#888780"}}>{open?"▲":"▼"}</span>
        </button>
      )}
      {isOpen&&(
        <div>
          {!alwaysOpen&&<p style={{fontSize:11,color:"#888780",margin:"0 0 10px",lineHeight:1.5,textAlign:"left"}}>Default is Irene's settings (50/40/10). Drag to adjust.</p>}
          <WeightSliders weights={weights} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"],[t.wait,"wait"]]} onUpdate={onUpdate} defaults={{taste:50,bpb:40,wait:10}}/>
        </div>
      )}
    </div>
  );
}

function WeightSliders({weights, labels, onUpdate, onReset, defaults}) {
  const {t} = useLang();
  const COLORS = {"taste":"#F0997B","bpb":"#5B9BD5","wait":"#97C459"};
  const cols = labels.length >= 3 ? "repeat(3,1fr)" : "repeat(2,1fr)";
  function reset() {
    if(!defaults || !onReset) return;
    onReset(defaults);
  }
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:11,color:"#888780",fontStyle:"italic"}}>{t.howMuchCare}</span>
        {defaults&&<button onClick={reset} style={{fontSize:10,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",flexShrink:0}}>Reset</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:cols,gap:12}}>
        {labels.map(([label,key])=>(
          <div key={key}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:11,color:"#888780"}}>{label}</span>
              <span style={{fontSize:11,fontWeight:500,color:COLORS[key]||"#F0997B"}}>{weights[key]}%</span>
            </div>
            <input type="range" min="0" max="100" step="1" value={weights[key]}
              onChange={e=>onUpdate(key,+e.target.value)}
              style={{width:"100%",accentColor:COLORS[key]||"#F0997B"}}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaletteView({entries,cafes,weights,updateWeight,resetWeights,totalW,weightError,cafeWeights,updateCafeW,resetCafeWeights,cafeTotalW,cafeWErr}) {
  const {t,lang:lang_} = useLang();
  const [paletteTab,setPaletteTab] = useState("restaurants");
  const [editingW,setEditingW] = useState(false);
  const [roastMode,setRoastMode] = useState(false);
  const total = entries.length;

  const rg={};
  entries.forEach(e=>{const r=REGION_MAP[e.cuisine]||"Other";rg[r]=(rg[r]||0)+1;});
  const sorted=Object.entries(rg).sort((a,b)=>b[1]-a[1]);
  const rows=[...sorted.slice(0,5),["Other",sorted.slice(5).reduce((a,[,n])=>a+n,0)]];
  const slices=rows.map(([region,count])=>({region,count,color:region==="Other"?"#888780":(REGION_COLORS[region]||"#888780")}));

  const topR=sorted[0]?.[0]||"Other",rCount=sorted.length;
  const cc={};entries.forEach(e=>{cc[e.cuisine]=(cc[e.cuisine]||0)+1;});
  const topC=Object.entries(cc).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
  const avgT=total?(entries.reduce((a,e)=>a+e.taste,0)/total).toFixed(1):"0";
  const avgC=total?(entries.reduce((a,e)=>a+e.cost,0)/total).toFixed(0):"0";
  const groupedEntries = Object.values(entries.reduce((acc,e)=>{if(!acc[e.name])acc[e.name]=[];acc[e.name].push(e);return acc;},{}));
  const topB = groupedEntries.map(grp=>({name:grp[0].name,avg:grp.reduce((a,e)=>a+(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights)??0),0)/grp.length})).sort((a,b)=>b.avg-a.avg)[0];

  const pr0=lang_==="zh"?(topR==="East Asia"?"你的味蕾對東亞料理有種無法抗拒的吸引力——說真的，品味一流。":topR==="Western Europe"?"西歐的經典料理說到你心坎裡了。經典。":"你對"+topR+"料理有真正的好奇心。"):(topR==="East Asia"?"Your palate has a clear gravitational pull toward East Asia — and honestly, you have great taste.":topR==="Western Europe"?"Classic European dining speaks to your soul. Timeless.":"You have a genuine curiosity for "+topR+" cuisine.");
  const pr1=lang_==="zh"?(+avgT>=8?"你的標準很高，評分就是證明。你不接受普通。":+avgT>=6.5?"你欣賞品質，但不會太挑剔。一個價格合理的包子就能讓你很滿足。":"你帶著真正的好奇心吃飯。每一次踩雷都是數據。"):(+avgT>=8?"Your standards are high and your reviews reflect it. You don't do mid.":+avgT>=6.5?"You appreciate quality but you're not precious about it. A well-priced bao hits different.":"You eat with genuine curiosity. Every miss is data.");
  const pr2=lang_==="zh"?(+avgC>70?"你在乎飲食的投資。人生太短，不該浪費在難吃的食物上。":+avgC>40?"你找到了甜蜜點——品質與米其林價格之間的平衡。":"你有發掘價值的天賦。真正的 BITE 分數最大化者。"):(+avgC>70?"You invest in your meals. Life's too short for bad food at any price.":+avgC>40?"You've found the sweet spot — quality without the Michelin price tag.":"You have a gift for finding value. A true BITE Score maximizer.");
  const pr3=lang_==="zh"?(rCount>=4?"已探索 "+rCount+" 個地區，持續增加中。護照印章拿來。":"你知道自己的路，而且堅持走下去。忠誠、一致、有效率。"):(rCount>=4?""+rCount+" regions explored and counting. The passport stamps are giving.":"You know your lane and you stay in it. Loyal, consistent, efficient.");

  const topRPct=Math.round((rg[topR]||0)/total*100);
  const r0=lang_==="zh"?(topR==="East Asia"?"你的紀錄裡有 "+topRPct+"% 是東亞料理。我們懂。你想念媽媽的手藝。":topR==="Western Europe"?"有趣啊，「有文化」怎麼突然變成「我只吃法國菜」了？":""+topR+"佔了你紀錄的 "+topRPct+"%。這就是所謂的愛冒險啊。"):(topR==="East Asia"?"Girl, "+topRPct+"% of your log is East Asian food. We get it. You miss your mom's cooking.":topR==="Western Europe"?"Interesting how quickly 'cultured' becomes 'I only eat French food'.":""+topR+" is "+topRPct+"% of your log. Adventurous queen behavior right here.");
  const r1=lang_==="zh"?(+avgT>=8?"高標準還有金融公式來佐證。你就是那種人。":+avgT>=6.5?"平均口味 "+avgT+"。你給人一種「我有品味，但也能吃任何東西」的感覺。":"平均口味低於 6.5。要麼你在吃難吃的東西，要麼你在騙自己。"):(+avgT>=8?"High standards AND a finance formula to prove it. You are that girl.":+avgT>=6.5?""+avgT+" average taste. You're giving 'I have opinions but also I'll eat anything'.":"Average taste score under 6.5. Either you're eating bad food or you're lying to yourself.");
  const r2=lang_==="zh"?(+avgC>70?"每餐平均 $"+avgC+"。你看信用卡帳單的時候一定要喝點東西。":+avgC>40?"每餐平均 $"+avgC+"。不窮，但也沒在揮霍。混亂中產階級的體驗。":"每餐平均 $"+avgC+"。要麼你挖到了寶，要麼你的腸胃非常包容。"):(+avgC>70?"$"+avgC+" average per meal. You are not processing these credit card statements sober.":+avgC>40?"$"+avgC+" per meal average. Not broke, not balling. The chaotic middle class experience.":"$"+avgC+" per meal average. Either you have found hidden gems or you have a very forgiving digestive system.");
  const r3=lang_==="zh"?(rCount>=4?""+rCount+" 個地區，但有 "+topRPct+"% 是"+topR+"。所謂的多元，有點言過其實啦。":"只有 "+rCount+" 個地區。我們蓋了整個任務系統，結果就這樣用啊。"):(rCount>=4?""+rCount+" regions but "+topRPct+"% of that is "+topR+". The range is a bit of a lie bestie.":"Only "+rCount+" regions. We built an entire quest system and this is what we're doing with it.");

  const l0=pr0, l1=pr1, l2=pr2, l3=pr3;

  const pillSt = (on) => ({padding:"6px 14px",borderRadius:20,border:"1.5px solid "+(on?"#F0997B":"rgba(255,255,255,0.1)"),background:on?"#3C1F13":"transparent",color:on?"#F0997B":"#888780",fontSize:12,fontWeight:on?500:400,cursor:"pointer"});

  return (
    <div>
      <div style={{display:"flex",background:"#252523",borderRadius:10,padding:3,gap:2,marginBottom:20}}>
        {[["restaurants","🍽 "+t.restaurants],["drinks","☕ "+t.drinks],["sweets","🥐 "+t.sweets]].map(([v,l])=>(
          <button key={v} onClick={()=>setPaletteTab(v)} style={{flex:1,padding:"6px 0",textAlign:"center",borderRadius:8,border:"none",background:paletteTab===v?"#3C1F13":"transparent",color:paletteTab===v?"#F0997B":"#888780",fontSize:11,fontWeight:paletteTab===v?500:400,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
        ))}
      </div>

      {paletteTab==="restaurants"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {!total?<p style={{color:"#888780",fontSize:14}}>{t.noEntriesYet}</p>:<>
          <div style={{...S.card}}>
            <div style={{...S.lbl,marginBottom:10}}>Weights</div>
            <WeightSliders weights={weights} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"],[t.wait,"wait"]]} onUpdate={updateWeight} onReset={resetWeights} defaults={{taste:50,bpb:40,wait:10}}/>
            <div style={{fontSize:10,color:"#888780",marginTop:8,textAlign:"right"}}>Max score at these weights: <span style={{color:"#F0997B",fontWeight:500}}>{calcMaxBite(weights).toFixed(1)}</span></div>
          </div>
          <div style={{...S.card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{...S.lbl,marginBottom:0}}>{t.tastePalette}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div onClick={()=>setRoastMode(r=>!r)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",background:roastMode?"#2A1E05":"#1A2E0A",border:"1px solid "+(roastMode?"#EF9F27":"#97C459"),borderRadius:20,padding:"4px 10px"}}>
                  <span style={{fontSize:11,color:roastMode?"#EF9F27":"#97C459",fontWeight:500}}>{roastMode?t.roastMe:t.prVersion}</span>
                </div>

              </div>
            </div>

            {(roastMode?[r0,r1,r2,r3]:[l0,l1,l2,l3]).map((l,i)=><p key={i} style={{fontSize:13,color:i===0?"#F1EFE8":"#888780",margin:"0 0 6px",lineHeight:1.65,fontWeight:i===0?500:400}}>{l}</p>)}
          </div>
          <div style={{...S.card}}>
            <div style={{...S.lbl,marginBottom:14}}>{t.cuisineBreakdown}</div>
            <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
              <DonutChart slices={slices} total={total}/>
              <div style={{flex:1,minWidth:140}}>
                {slices.map(s=>{const d=s.count===0;return(
                  <div key={s.region} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{width:8,height:8,borderRadius:2,background:d?"#333330":s.color,flexShrink:0}}/>
                    <span style={{fontSize:12,color:d?"#444441":"#888780",flex:1}}>{s.region}</span>
                    <span style={{fontSize:12,color:d?"#444441":"#F1EFE8",fontWeight:500}}>{s.count}</span>
                    <span style={{fontSize:11,color:d?"#444441":"#888780",width:34,textAlign:"right"}}>{d?"0%":Math.round(s.count/total*100)+"%"}</span>
                  </div>
                );})}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {(()=>{
              const noteTopRated="Irene's judgement may have been clouded by bias and how underwhelming her home food has been, so this is not actually objectively #1. But let her live. She misses home 🥹";
              const noteRegions="Tap the Quests tab to explore by cuisine region!";
              const statRows=[[t.topCuisine,(FLAGS[topC]||"")+" "+topC],[t.topRated,topB?topB.name:"—","topRated"],[t.avgBite,(total?([...entries].reduce((a,e)=>a+(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights)??0),0)/total).toFixed(2):"—")],[t.avgTaste,avgT+"/10"],[t.avgSpend,"$"+avgC+" / meal"],[t.regionsExplored,rCount+" / "+Object.keys(CUISINE_REGIONS).length,"regions"]];
              return statRows.map(([label,val,key])=>(
                <StatCard key={label} label={label} val={val} note={key==="topRated"?noteTopRated:key==="regions"?noteRegions:undefined}/>
              ));
            })()}
          </div>
          </>}
        </div>
      )}

      {paletteTab==="drinks"&&<DrinksPalette cafes={cafes} cafeWeights={cafeWeights} updateCafeW={updateCafeW} resetCafeWeights={resetCafeWeights} cafeTotalW={cafeTotalW} cafeWErr={cafeWErr}/>}
      {paletteTab==="sweets"&&<SweetsPalette cafes={cafes} cafeWeights={cafeWeights} updateCafeW={updateCafeW} resetCafeWeights={resetCafeWeights}/>}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

// ── FAQ View ──────────────────────────────────────────────────────────────────
function FaqView({isAdmin, faqOverrides={}, setFaqOverrides}) {
  const {t,lang} = useLang();
  const isZh = lang==="zh";
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState("");
  const answerRefs = useRef({});
  const bl = "2px solid rgba(255,255,255,0.1)";
  const bst = {display:"block",paddingLeft:8,borderLeft:bl};
  const b4 = {display:"block",marginBottom:4};
  const items = [
    {q:t.faqQ1, a:isZh
      ?<span><em>給我的金融圈朋友們，這也叫 FACC</em><br/><br/>一個受金融界 WACC 啟發的加權美食評分系統。考慮因素：<br/><br/><span style={bst}><span style={b4}>口味 (T) = 0-10 分</span><span style={b4}>費用 (C) = 美元</span><span style={b4}>份量 (P) = 一人份數量</span><span style={b4}>CP值 (B) = C / P</span><span style={{display:"block"}}>回訪意願 (R) = 0-3 顆星</span></span></span>
      :<span><em>to my finance girlies and bros, the FACC</em><br/><br/>A weighted food rating system inspired by WACC in finance. Factors in:<br/><br/><span style={bst}><span style={b4}>Taste (T) = rated 0-10</span><span style={b4}>Cost (C) = in dollars</span><span style={b4}>Portions (P) = meals fed per person</span><span style={b4}>Bang-per-Buck (B) = C / P</span><span style={{display:"block"}}>Repeatability (R) = 0-3 stars</span></span></span>},
    {q:t.faqQ2, a:isZh
      ?<span><span style={{display:"block",marginBottom:6}}>基礎分 = (口味權重 x T) - (CP值權重 x C/P/20) - (等待權重 x W)</span><span style={{display:"block",marginBottom:6}}>W 為對數等待懲罰（見下方）。</span><span style={{display:"block"}}>最終 BITE = 基礎分 + |基礎分| x R 乘數</span></span>
      :<span><span style={{display:"block",marginBottom:6}}>Base = (wt x T) - (wb x C/P/20) - (ww x W)</span><span style={{display:"block",marginBottom:6}}>W is the log-scaled wait penalty (see below).</span><span style={{display:"block"}}>Final BITE = Base + |Base| x R multiplier.</span></span>},
    {q:t.faqQ3, a:isZh
      ?<span>W = min(10, ln(等待+1) / ln(121) x 10)<br/><br/>對數換算，早期等待分鐘懲罰最重。上限 120 分鐘。<br/><br/><span style={bst}>{[["0 分鐘","0.0"],["5 分鐘","3.5"],["15 分鐘","5.8"],["30 分鐘","7.2"],["60 分鐘","8.6"],["120 分鐘","10.0（上限）"]].map(([a,b])=><span key={a} style={b4}>{a} = {b}</span>)}</span></span>
      :<span>W = min(10, ln(wait+1) / ln(121) x 10)<br/><br/>Log-scaled so early minutes hurt most. Capped at 120 min.<br/><br/><span style={bst}>{[["0 min","0.0"],["5 min","3.5"],["15 min","5.8"],["30 min","7.2"],["60 min","8.6"],["120 min","10.0 (cap)"]].map(([a,b])=><span key={a} style={b4}>{a} = {b}</span>)}</span></span>},
    {q:t.faqQ4, a:isZh?"0-2：很難吃 · 2-4：普通 · 4-7：中規中矩 · 7-8.5：好吃 · 8.5-10：超好吃":"0-2: sucks · 2-4: meh · 4-7: average · 7-8.5: good · 8.5-10: great"},
    {q:t.faqQ5, a:isZh?"費用除以份量，再除以 20 做標準化。每份費用越低，分數越高。":"Cost divided by Portions, divided by 20 to normalize. A lower cost per portion improves your score."},
    {q:t.faqQ6, a:isZh
      ?<span>米其林風格 0-3 顆星評分。BITE = 基礎分 + |基礎分| x 乘數。<br/><br/><span style={bst}><span style={b4}>3 顆星 - 一定要再去：+0.4x</span><span style={b4}>2 顆星 - 會特地去：+0.2x</span><span style={b4}>1 顆星 - 有機會再說：0x</span><span style={{display:"block"}}>0 顆星 - 不會再去：-0.3x</span></span></span>
      :<span>Michelin-style 0-3 star rating. BITE = Base + |Base| x multiplier.<br/><br/><span style={bst}><span style={b4}>3 stars - Must return: +0.4x</span><span style={b4}>2 stars - Would seek out: +0.2x</span><span style={b4}>1 star - If occasion calls: 0x</span><span style={{display:"block"}}>0 stars - Would not return: -0.3x</span></span></span>},
    {q:t.faqQ7, a:isZh
      ?<span>咖啡廳採用可調整的加權評分，預設為 70% 口味、30% CP值（$5.25/品項為中性）。可在「我的品味」→「飲品」中調整權重。<br/><br/><span style={bst}><span style={b4}>基礎分 = (口味權重 × 口味) − (CP值權重 × 費用/品項/5.25)</span><span style={b4}>等待懲罰 ≤ |基礎分| 的 10%</span><span style={{display:"block"}}>最終 = (基礎分 − 等待懲罰) + |…| × R 乘數</span></span></span>
      :<span>Cafes use adjustable weights — default 70% Taste, 30% Bang per Buck ($5.25/item neutral). You can change the weights in My Taste → Drinks.<br/><br/><span style={bst}><span style={b4}>Base = (taste weight × Taste) − (bpb weight × Cost/Items/5.25)</span><span style={b4}>Wait penalty ≤ 10% of |Base|</span><span style={{display:"block"}}>Final = (Base − wait penalty) + |…| × R multiplier</span></span></span>},
  ];
  return (
    <div>
      {items.map(({q,a},i)=>{
        const key=String(q);
        const isEditing=editingIdx===i;
        const displayA=faqOverrides[i]!==undefined?faqOverrides[i]:a;
        return (
          <div key={key} style={{borderBottom:"0.5px solid rgba(255,255,255,0.1)",padding:"14px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontWeight:500,fontSize:14,color:"#F0997B",flex:1}}>{q}</div>
              {isAdmin&&!isEditing&&(
                <button onClick={()=>{
                  if(faqOverrides[i]!==undefined){
                    setEditVal(faqOverrides[i]);
                  } else if(typeof a==="string"){
                    setEditVal(a);
                  } else {
                    // Read rendered text from DOM
                    setEditVal(answerRefs.current[i]?.innerText||"[Edit to add plain text override]");
                  }
                  setEditingIdx(i);
                }} style={{fontSize:11,color:"#888780",background:"none",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:4,padding:"2px 8px",cursor:"pointer",flexShrink:0,marginLeft:8}}>Edit</button>
              )}
              {isAdmin&&isEditing&&(
                <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                  <button onClick={async()=>{
                    const next={...faqOverrides,[i]:editVal};
                    setFaqOverrides(next);
                    setEditingIdx(null);
                    try { await supabase.from("settings").upsert({key:"faq_override_"+i,value:editVal},{onConflict:"key"}); } catch(err){ console.error("faq save threw:",err); }
                  }} style={{fontSize:11,color:"#141413",background:"#F0997B",border:"none",borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>Save</button>
                  <button onClick={()=>setEditingIdx(null)} style={{fontSize:11,color:"#888780",background:"none",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>Cancel</button>
                </div>
              )}
            </div>
            {isEditing?(
              <div>
                <textarea value={editVal} onChange={e=>setEditVal(e.target.value)} rows={8} style={{width:"100%",boxSizing:"border-box",fontSize:13,lineHeight:1.7,resize:"vertical",fontFamily:"monospace"}}/>
                <div style={{fontSize:10,color:"#888780",marginTop:4}}>Tip: indent lines with 2 spaces for the bordered block style</div>
              </div>
            ):(
              <div ref={el=>answerRefs.current[i]=el} style={{fontSize:13,color:"#888780",lineHeight:1.7}}>
                {typeof displayA==="string"
                  ? displayA.split("\n").map((line,li)=>{
                      if(!line.trim()) return <div key={li} style={{height:8}}/>;
                      if(line.startsWith("  ")||line.startsWith("\t")) return <div key={li} style={{paddingLeft:10,borderLeft:"2px solid rgba(255,255,255,0.12)",marginBottom:4,color:"#888780"}}>{line.trimStart()}</div>;
                      return <div key={li} style={{marginBottom:4}}>{line}</div>;
                    })
                  : a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [st, dispatch] = useReducer(reducer, {entries:RESTAURANTS, view:"log"});
  const [cafes, setCafes] = useState(CAFES_INIT);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [faqOverrides, setFaqOverrides] = useState({});
  const waveTaps = useRef([]);
  const [welcomeOverride, setWelcomeOverride] = useState({});
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [welcomeEditVal, setWelcomeEditVal] = useState("");
  const [lang, setLang] = useState(()=>localStorage.getItem("bite_lang")||"en");
  const t = T[lang]||T.en;
  function toggleLang(){const nl=lang==="en"?"zh":"en";setLang(nl);localStorage.setItem("bite_lang",nl);}

  useEffect(()=>{
    async function load() {
      try {
      const {data:rData} = await supabase.from("restaurants").select("*").order("created_at",{ascending:true});
      const {data:cData} = await supabase.from("cafes").select("*").order("created_at",{ascending:true});
      if(rData&&rData.length>0) {
        const mapped = rData.map(r=>({
          id:r.id, name:r.name, cuisine:r.cuisine||"", cuisine2:r.cuisine2||"",
          isFusion:r.is_fusion||false, taste:+r.taste, cost:+r.cost,
          portions:+r.portions, wait:+r.wait, repeatability:+r.repeatability,
          useR:r.use_r!==false, notes:r.notes||"", letter:(r.cuisine?.[0]||"").toUpperCase()
        }));
        dispatch({type:"LOAD", entries:mapped});
      }
      if(cData&&cData.length>0) {
        const mapped = cData.map(c=>({
          id:c.id, name:c.name, category:c.category||"Coffee", order:c.order_item||"",
          taste:+c.taste, cost:+c.cost, portions:+c.portions, wait:+(c.wait||0),
          beanRegion:c.bean_region||"", milkLevel:c.milk_level||"",
          repeatability:+c.repeatability, useR:c.use_r!==false, notes:c.notes||""
        }));
        setCafes(mapped);
      }
      const {data:sData} = await supabase.from("settings").select("*");
      if(sData) {
        const ql = sData.find(s=>s.key==="questLetters");
        if(ql) setQuestL(new Set(JSON.parse(ql.value)));
        const faqOverrides={};
        sData.filter(s=>s.key.startsWith("faq_override_")).forEach(s=>{
          const idx=parseInt(s.key.replace("faq_override_",""));
          faqOverrides[idx]=s.value;
        });
        if(Object.keys(faqOverrides).length>0) setFaqOverrides(faqOverrides);
        const wo={};
        sData.filter(s=>s.key.startsWith("welcome_")).forEach(s=>{wo[s.key.replace("welcome_","")]=s.value;});
        if(Object.keys(wo).length>0) setWelcomeOverride(wo);
      }
      setDbLoaded(true);
      } catch(err) { console.error("Supabase load error:", err); setDbLoaded(true); }
    }
    load();
  },[]);

  function dismissWelcome(){
    setShowWelcome(false);
  }
  const [editR, setEditR] = useState(null);
  const [editC, setEditC] = useState(null);
  const [logTab, setLogTab] = useState("restaurants");
  const [addType, setAddType] = useState("restaurant");
  const [sortBy, setSortBy] = useState("bite");
  const [sortAsc, setSortAsc] = useState(false);
  const [tiers, setTiers] = useState(new Set());
  const [cityFilter, setCityFilter] = useState("");
  const lastCity = useRef("NYC");
  const [showFilter, setShowFilter] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [weights, setWeights] = useState({taste:50,bpb:40,wait:10});
  const [cafeWeights, setCafeWeights] = useState({taste:70,bpb:30});
  const [cafeWErr, setCafeWErr] = useState("");
  const [wErr, setWErr] = useState("");
  const [questL, setQuestL] = useState(new Set(["T","M","S","U","C","D","Y","K"]));
  const [cafeSortBy, setCafeSortBy] = useState("bite");
  const [cafeSortAsc, setCafeSortAsc] = useState(false);
  const [cafeFilterMilk, setCafeFilterMilk] = useState("");
  const [cafeFilterBean, setCafeFilterBean] = useState("");
  const [showCafeFilter, setShowCafeFilter] = useState(false);
  const [cafeSearch, setCafeSearch] = useState("");
  const [showCafeSearch, setShowCafeSearch] = useState(false);
  const [sweetsSearch, setSweetsSearch] = useState("");
  const [showSweetsSearch, setShowSweetsSearch] = useState(false);
  const [sweetsSortBy, setSweetsSortBy] = useState("bite");
  const [sweetsSortAsc, setSweetsSortAsc] = useState(false);
  const fRef = useRef(null);
  const sRef = useRef(null);
  const cfRef = useRef(null);
  const csRef = useRef(null);
  const ssRef = useRef(null);

  useEffect(()=>{
    function h(e){
      if(fRef.current&&!fRef.current.contains(e.target))setShowFilter(false);
      if(sRef.current&&!sRef.current.contains(e.target))setShowSearch(false);
      if(cfRef.current&&!cfRef.current.contains(e.target))setShowCafeFilter(false);
      if(csRef.current&&!csRef.current.contains(e.target))setShowCafeSearch(false);
      if(ssRef.current&&!ssRef.current.contains(e.target))setShowSweetsSearch(false);
    }
    document.addEventListener("mousedown",h);document.addEventListener("touchstart",h);
    return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("touchstart",h);};
  },[]);

  function rebalance(current, changedKey, newVal) {
    const nv = Math.min(100, Math.max(0, Math.round(newVal)));
    const others = Object.keys(current).filter(k=>k!==changedKey);
    const remaining = 100 - nv;
    const otherSum = others.reduce((a,k)=>a+current[k],0);
    const newW = {...current,[changedKey]:nv};
    if(otherSum===0){
      const each = Math.floor(remaining/others.length);
      others.forEach((k,i)=>newW[k]=i===others.length-1?remaining-each*(others.length-1):each);
    } else {
      others.forEach(k=>newW[k]=Math.max(0,Math.round(current[k]/otherSum*remaining)));
      // fix rounding to ensure exact 100
      const diff=100-Object.values(newW).reduce((a,x)=>a+x,0);
      if(diff!==0) newW[others[0]]+=diff;
    }
    return newW;
  }

  function updW(k,v){
    const newW=rebalance(weights,k,+v);
    setWeights(newW);setWErr("");
  }

  function resetWeights(defaults){ setWeights({...defaults});setWErr(""); }

  function updCafeW(k,v){
    const newW=rebalance(cafeWeights,k,+v);
    setCafeWeights(newW);setCafeWErr("");
  }

  function resetCafeWeights(defaults){ setCafeWeights({...defaults});setCafeWErr(""); }

  const covered = new Set(st.entries.map(e=>(e.letter||e.cuisine?.[0])?.toUpperCase()));
  async function toggleQ(l){
    if(!covered.has(l)||!isAdmin)return;
    const next=new Set(questL);
    next.has(l)?next.delete(l):next.add(l);
    setQuestL(next);
    try { await supabase.from("settings").upsert({key:"questLetters",value:JSON.stringify([...next])},{onConflict:"key"}); } catch(err){ console.error("quest save threw:",err); }
  }

  const loggedC = new Set(st.entries.map(e=>e.cuisine&&e.cuisine.trim()));
  const totalCuisines = Object.values(CUISINE_REGIONS).flat().length;
  const doneCount = Object.values(CUISINE_REGIONS).flat().filter(x=>loggedC.has(x)).length;
  const totalW = +(weights.taste+weights.bpb+weights.wait).toFixed(0);

  const sortedR = [...st.entries].sort((a,b)=>{
    let d=0;
    // For each field, d>0 means a should come FIRST in descending (default ↓) order
    // i.e. d = "a is better than b"
    if(sortBy==="bite") d=(calcBite(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,weights)??0)-(calcBite(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,weights)??0);
    else if(sortBy==="taste") d=a.taste-b.taste;
    else if(sortBy==="bpb") d=(b.cost/b.portions)-(a.cost/a.portions); // lower cost = better
    else if(sortBy==="wait") d=b.wait-a.wait; // lower wait = better
    else if(sortBy==="repeat") d=a.repeatability-b.repeatability;
    // sortAsc=false (↓) = best first (d descending), sortAsc=true (↑) = worst first
    return sortAsc?d:-d;
  });

  const allCities = [...new Set(sortedR.map(e=>e.city||"NYC"))].sort();
  const filtered = sortedR.filter(e=>{
    if(tiers.size>0&&!tiers.has(scoreLabel(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights),T.en)))return false;
    if(cityFilter&&(e.city||"NYC")!==cityFilter)return false;
    if(search.trim()){const q=search.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.cuisine.toLowerCase().includes(q)||(e.city||'NYC').toLowerCase().includes(q)||(e.notes&&e.notes.toLowerCase().includes(q));}
    return true;
  });

  const DRINK_CATS = ["Coffee","Tea","Other"];
  const sortedDrinks = [...cafes].filter(e=>DRINK_CATS.includes(e.category)).sort((a,b)=>{
    let d=0;
    if(cafeSortBy==="bite") d=(calcCafe(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability)??0)-(calcCafe(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability)??0);
    else if(cafeSortBy==="taste") d=b.taste-a.taste;
    else if(cafeSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
    else if(cafeSortBy==="wait") d=a.wait-b.wait;
    else if(cafeSortBy==="repeat") d=b.repeatability-a.repeatability;
    return cafeSortAsc?-d:d;
  }).filter(e=>{
    if(cafeFilterMilk&&e.milkLevel!==cafeFilterMilk)return false;
    if(cafeFilterBean&&e.beanRegion!==cafeFilterBean)return false;
    if(cafeSearch.trim()){const q=cafeSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q);}
    return true;
  });

  const sortedSweets = [...cafes].filter(e=>e.category==="Sweets").sort((a,b)=>{
    let d=0;
    if(sweetsSortBy==="bite") d=(calcCafe(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability)??0)-(calcCafe(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability)??0);
    else if(sweetsSortBy==="taste") d=b.taste-a.taste;
    else if(sweetsSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
    else if(sweetsSortBy==="wait") d=a.wait-b.wait;
    else if(sweetsSortBy==="repeat") d=b.repeatability-a.repeatability;
    return sweetsSortAsc?-d:d;
  }).filter(e=>{
    if(sweetsSearch.trim()){const q=sweetsSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q);}
    return true;
  });

  const TIERS=[["Elite","#97C459"],["Great","#97C459"],["Good","#5B9BD5"],["Decent","#EF9F27"],["Don't bother","#A32D2D"]];
  const tabSt = (on) => ({padding:"7px 18px",borderRadius:20,border:"1.5px solid "+(on?"#F0997B":"rgba(255,255,255,0.1)"),background:on?"#3C1F13":"transparent",color:on?"#F0997B":"#888780",fontSize:13,fontWeight:on?500:400,cursor:"pointer"});

  function getDisplay(e) {
    if(sortBy==="taste"){const tv=e.taste,lbl=tasteLabel(tv,t),col=tv<=2?"#A32D2D":tv<=4?"#888780":tv<=7?"#EF9F27":tv<=8.5?"#5B9BD5":"#97C459";return{val:tv.toFixed(1),label:lbl,color:col};}
    if(sortBy==="bpb") return{val:"$"+(e.cost/e.portions).toFixed(2),label:t.perPortion,color:"#5B9BD5"};
    if(sortBy==="wait") return{val:e.wait+" min",label:t.waitLabel,color:"#888780"};
    if(sortBy==="repeat") return{val:e.useR?("⭐".repeat(e.repeatability)||"✕"):t.off,label:e.useR?(e.repeatability===3?t.mustReturnLabel:e.repeatability===2?t.wouldSeekOutLabel:e.repeatability===1?t.ifOccasionCallsLabel:t.wouldntReturnLabel):"off",color:"#EF9F27"};
    const sc=calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights);
    return{val:sc!=null?sc.toFixed(2):"—",label:scoreLabel(sc,t),color:scoreColor(sc)};
  }

  return (
    <LangContext.Provider value={{t,lang,toggleLang}}>
    <div style={{fontFamily:"var(--font-sans)",maxWidth:640,margin:"0 auto",padding:"1.25rem 1rem 8rem 1rem",background:"#141413",minHeight:"100vh",color:"#F1EFE8",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap');
        input,select,textarea{background:#252523!important;color:#F1EFE8!important;border:1px solid rgba(255,255,255,0.2)!important;border-radius:8px;padding:9px 12px;}
        input:focus,textarea:focus{border-color:#F0997B!important;outline:none;}
        input::placeholder,textarea::placeholder{color:#666663!important;}
        input[type=range]{accent-color:#F0997B;padding:0;border:none!important;background:transparent!important;}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}
      `}</style>

      <div style={{marginBottom:"1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <LogoWithTripleTap onTripleTap={()=>{
            if(!isAdmin){const pw=prompt("Password:");if(pw==="nomnomNOM")setIsAdmin(true);}
            else setIsAdmin(false);
          }} isAdmin={isAdmin}/>
          <div>
            <h1 style={{fontSize:28,fontWeight:600,color:isAdmin?"#97C459":"#F0997B",margin:0,fontFamily:"'Fredoka',sans-serif",transition:"color 0.3s"}}>{lang==="zh"?"BITE Score 吃貨榜":"BITE Score"}</h1>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isAdmin&&<button onClick={()=>{setWelcomeEditVal({title:welcomeOverride[lang+"_title"]||t.welcome1,body:welcomeOverride[lang+"_body"]||t.welcome2});setEditingWelcome(true);}} style={{fontSize:10,color:"#888780",background:"none",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:4,padding:"3px 8px",cursor:"pointer"}}>Edit welcome</button>}
          <button onClick={toggleLang} style={{fontSize:11,fontWeight:500,padding:"5px 12px",borderRadius:20,border:"1.5px solid rgba(255,255,255,0.2)",background:"transparent",color:"#888780",cursor:"pointer",letterSpacing:"0.03em",flexShrink:0}}>{lang==="en"?"繁中":"EN"}</button>
        </div>
      </div>

      {((showWelcome&&!isAdmin&&dbLoaded)||isAdmin&&editingWelcome)&&(
        <div onClick={()=>{if(!isAdmin)dismissWelcome();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1E1E1C",borderRadius:16,padding:"1.5rem",maxWidth:360,width:"100%",border:"0.5px solid rgba(255,255,255,0.15)"}}>
            <div style={{fontSize:24,marginBottom:12,textAlign:"center",cursor:"default",userSelect:"none"}} onClick={()=>{
              const now=Date.now();
              waveTaps.current=[...waveTaps.current.filter(t=>now-t<800),now];
              if(waveTaps.current.length>=3){waveTaps.current=[];const pw=prompt("Password:");if(pw==="nomnomNOM"){setIsAdmin(true);dismissWelcome();}}
            }}>👋</div>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:16}}>
              {["en","zh"].map(l=>(
                <button key={l} onClick={()=>{
                  setLang(l);localStorage.setItem("bite_lang",l);
                  if(editingWelcome){
                    const T_other=l==="en"?{welcome1:"🍴 Welcome to BITE Score",welcome2:"BITE \"Benefit Index of Taste and Efficiency\" is a weighted average of factors you care about. Scores range 0–5 — above 3 is Great, above 4 is Elite.\n\nPlay around! Nothing saves permanently.\nOnly Irene can do that. 😤"}:{welcome1:"🍴 歡迎來到 BITE 排行榜",welcome2:"BITE（Benefit Index of Taste and Efficiency）是一個加權平均評分，衡量你在乎的因素。分數介於 0–5：3 分以上是「很棒」，4 分以上是「頂級」。\n\n隨便玩！不會永久儲存。\n只有 Irene 有這個權力 😂"};
                    setWelcomeEditVal({title:welcomeOverride[l+"_title"]||T_other.welcome1,body:welcomeOverride[l+"_body"]||T_other.welcome2});
                  }
                }} style={{padding:"5px 16px",borderRadius:20,border:"1.5px solid "+(lang===l?"#F0997B":"rgba(255,255,255,0.2)"),background:lang===l?"#3C1F13":"transparent",color:lang===l?"#F0997B":"#888780",fontSize:12,fontWeight:lang===l?500:400,cursor:"pointer"}}>
                  {l==="en"?"English":"繁體中文"}
                </button>
              ))}
            </div>
            {isAdmin&&editingWelcome?(
              <div>
                <div style={{fontSize:11,color:"#888780",marginBottom:6}}>Title ({lang})</div>
                <input value={welcomeEditVal.title||""} onChange={e=>setWelcomeEditVal(p=>({...p,title:e.target.value}))} style={{width:"100%",boxSizing:"border-box",marginBottom:10,fontSize:13}}/>
                <div style={{fontSize:11,color:"#888780",marginBottom:6}}>Body ({lang})</div>
                <textarea value={welcomeEditVal.body||""} onChange={e=>setWelcomeEditVal(p=>({...p,body:e.target.value}))} rows={6} style={{width:"100%",boxSizing:"border-box",fontSize:13,lineHeight:1.6,resize:"vertical",marginBottom:12}}/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={async()=>{
                    const next={...welcomeOverride,[lang+"_title"]:welcomeEditVal.title,[lang+"_body"]:welcomeEditVal.body};
                    setWelcomeOverride(next);
                    setEditingWelcome(false);
                    try {
                      await supabase.from("settings").upsert({key:"welcome_"+lang+"_title",value:welcomeEditVal.title},{onConflict:"key"});
                      await supabase.from("settings").upsert({key:"welcome_"+lang+"_body",value:welcomeEditVal.body},{onConflict:"key"});
                    } catch(err){console.error("welcome save threw:",err);}
                  }} style={{flex:2,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:14,fontWeight:500,cursor:"pointer"}}>Save</button>
                  <button onClick={async()=>{
                    const next={...welcomeOverride};delete next[lang+"_title"];delete next[lang+"_body"];
                    setWelcomeOverride(next);setEditingWelcome(false);
                    try{await supabase.from("settings").delete().in("key",["welcome_"+lang+"_title","welcome_"+lang+"_body"]);}catch(err){}
                  }} style={{flex:1,padding:"10px",background:"transparent",color:"#A32D2D",border:"0.5px solid #A32D2D",borderRadius:8,fontSize:12,cursor:"pointer"}}>Reset</button>
                  <button onClick={()=>setEditingWelcome(false)} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:14,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16}}>
                  <p style={{fontSize:16,fontWeight:600,color:"#F1EFE8",margin:0,lineHeight:1.5,textAlign:"center"}}>{welcomeOverride[lang+"_title"]||t.welcome1}</p>
                  <InfoBubble content={welcomeOverride[lang+"_body"]?.split("\n\n")[0]||t.welcome2.split("\n\n")[0]}/>
                </div>

                {isAdmin?(
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={()=>{setWelcomeEditVal({title:welcomeOverride[lang+"_title"]||t.welcome1,body:welcomeOverride[lang+"_body"]||t.welcome2});setEditingWelcome(true);}} style={{flex:1,padding:"10px",background:"transparent",color:"#888780",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:8,fontSize:13,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>setEditingWelcome(false)} style={{flex:1,padding:"10px",background:"#F0997B",color:"#141413",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer"}}>Done</button>
                  </div>
                ):(
                  <div>
                    <div style={{borderTop:"0.5px solid rgba(255,255,255,0.08)",paddingTop:14,marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <span style={{fontSize:11,color:"#888780",fontStyle:"italic"}}>{t.howMuchCare}</span>
                        <button onClick={()=>resetWeights({taste:50,bpb:40,wait:10})} style={{fontSize:10,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline"}}>Reset</button>
                      </div>
                      {[[t.taste,"taste","#F0997B"],[t.bangBuck,"bpb","#5B9BD5"],[t.wait,"wait","#97C459"]].map(([label,key,color])=>(
                        <div key={key} style={{marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <span style={{fontSize:11,color:"#888780"}}>{label}</span>
                            <span style={{fontSize:11,fontWeight:500,color:color}}>{weights[key]}%</span>
                          </div>
                          <input type="range" min="0" max="100" step="1" value={weights[key]}
                            onChange={e=>updW(key,+e.target.value)}
                            style={{width:"100%",accentColor:color}}/>
                        </div>
                      ))}
                    </div>
                    {(welcomeOverride[lang+"_body"]||t.welcome2).split("\n\n").slice(1).map((para,i)=>(
                      <p key={i} style={{fontSize:13,color:"#888780",margin:"0 0 12px",lineHeight:1.7,textAlign:"center",whiteSpace:"pre-line"}}>{para}</p>
                    ))}
                    <div style={{fontSize:10,color:"#888780",textAlign:"right",marginBottom:10}}>Max score at these weights: <span style={{color:"#F0997B",fontWeight:500}}>{calcMaxBite(weights).toFixed(1)}</span></div>
                    <button onClick={dismissWelcome} style={{width:"100%",padding:"12px",background:"#F0997B",color:"#141413",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer"}}>{t.welcomeBtn}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:640,background:"#1A1A18",borderTop:"0.5px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-around",alignItems:"center",padding:"8px 0 max(8px,env(safe-area-inset-bottom))",zIndex:100}}>
        {[["log","📋",t.myLog],["palette","😋",t.myTaste],["add","➕",t.add],["quests","🗺️",t.quests],["faq","❓",t.faq]].map(([v,icon,label])=>(
          <button key={v} onClick={()=>{dispatch({type:"VIEW",view:v});setEditR(null);setEditC(null);window.scrollTo({top:0,behavior:"instant"});}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 8px",minWidth:56}}>
            {v==="add"?(
              <div style={{width:44,height:44,borderRadius:"50%",background:"#F0997B",border:"2px solid #F0997B",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-8,marginBottom:2}}>
                <span style={{fontSize:22,lineHeight:1,color:"#141413"}}>➕</span>
              </div>
            ):(
              <span style={{fontSize:20,lineHeight:1}}>{icon}</span>
            )}
            <span style={{fontSize:10,color:st.view===v?"#F0997B":"#888780",fontWeight:st.view===v?500:400,transition:"color 0.15s"}}>{label}</span>
            {st.view===v&&v!=="add"&&<div style={{width:4,height:4,borderRadius:"50%",background:"#F0997B",marginTop:1}}/>}
          </button>
        ))}
      </div>

      {/* ── My Log ── */}
      {st.view==="log"&&!editR&&!editC&&!dbLoaded&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
          {[1,2,3,4,5].map(i=>(
            <div key={i} style={{background:"#1E1E1C",borderRadius:10,height:62,opacity:0.4+i*0.08,animation:"pulse 1.2s ease-in-out infinite"}}/>
          ))}
        </div>
      )}
      {st.view==="log"&&!editR&&!editC&&dbLoaded&&(
        <div>
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",background:"#252523",borderRadius:10,padding:3,gap:2,marginBottom:isAdmin?8:0}}>
              {[["restaurants","🍽 "+t.restaurants],["drinks","☕ "+t.drinks],["sweets","🥐 "+t.sweets]].map(([v,l])=>(
                <button key={v} onClick={()=>setLogTab(v)} style={{flex:1,padding:"6px 0",textAlign:"center",borderRadius:8,border:"none",background:logTab===v?"#3C1F13":"transparent",color:logTab===v?"#F0997B":"#888780",fontSize:11,fontWeight:logTab===v?700:500,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
              ))}
            </div>
            {isAdmin&&<p style={{fontSize:12,color:"#888780",margin:0}}>{t.swipeHint}</p>}
          </div>
          <div style={{borderBottom:"0.5px solid rgba(255,255,255,0.08)",marginBottom:12}}/>

          {logTab==="restaurants"&&(
            <div>

              {allCities.length>1&&(
                <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",scrollbarWidth:"none",marginBottom:8,paddingBottom:2}}>
                  <div onClick={()=>setCityFilter("")} style={{padding:"4px 12px",borderRadius:16,fontSize:11,cursor:"pointer",flexShrink:0,background:!cityFilter?"#3C1F13":"transparent",color:!cityFilter?"#F0997B":"#888780",border:"1px solid "+(!cityFilter?"#F0997B":"rgba(255,255,255,0.1)")}}>All</div>
                  {allCities.map(city=>(
                    <div key={city} onClick={()=>setCityFilter(city===cityFilter?"":city)} style={{padding:"4px 12px",borderRadius:16,fontSize:11,cursor:"pointer",flexShrink:0,background:cityFilter===city?"rgba(91,155,213,0.15)":"transparent",color:cityFilter===city?"#5B9BD5":"#888780",border:"1px solid "+(cityFilter===city?"rgba(91,155,213,0.5)":"rgba(255,255,255,0.1)")}}>📍 {city}</div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:2}}>
                  {[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat",t.repeatability]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSortBy(v)} style={{padding:"5px 12px",borderRadius:16,border:"1px solid "+(sortBy===v?"#F0997B":"rgba(255,255,255,0.1)"),background:sortBy===v?"#3C1F13":"transparent",color:sortBy===v?"#F0997B":"#888780",fontSize:12,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <div ref={sRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowSearch(s=>!s)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showSearch||search?"#F0997B":"rgba(255,255,255,0.1)"),background:showSearch||search?"#3C1F13":"transparent",color:showSearch||search?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                    {showSearch&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 10px",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,width:200}}>
                        <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.searchPlaceholder} style={{width:"100%",boxSizing:"border-box",fontSize:12}}/>
                        {search&&<button onClick={()=>setSearch("")} style={{fontSize:11,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:"4px 0 0",display:"block"}}>{t.clear}</button>}
                      </div>
                    )}
                  </div>
                  <div ref={fRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowFilter(f=>!f)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showFilter||tiers.size>0?"#F0997B":"rgba(255,255,255,0.1)"),background:showFilter||tiers.size>0?"#3C1F13":"transparent",color:showFilter||tiers.size>0?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 2h12l-4.5 5.5V12L5.5 10.5V7.5L1 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                    </button>
                    {showFilter&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,overflow:"hidden",minWidth:180,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50}}>
                        <div style={{padding:"6px 10px",borderBottom:"0.5px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={S.sm}>{t.filterByTier}</span>
                          {tiers.size>0&&<button onClick={()=>setTiers(new Set())} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:0}}>{t.clear}</button>}
                        </div>
                        {TIERS.map(([tier,col])=>{
                          const on=tiers.has(tier);
                          const cnt=sortedR.filter(e=>scoreLabel(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights),T.en)===tier).length;
                          return(
                            <div key={tier} onClick={()=>setTiers(p=>{const n=new Set(p);on?n.delete(tier):n.add(tier);return n;})} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:"0.5px solid rgba(255,255,255,0.1)",cursor:"pointer",background:on?"rgba(255,255,255,0.03)":"transparent"}}>
                              <div style={{width:13,height:13,borderRadius:3,border:"1.5px solid "+(on?col:"rgba(255,255,255,0.1)"),background:on?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<span style={{color:"#141413",fontSize:9,fontWeight:700,lineHeight:1}}>✓</span>}</div>
                              <span style={{flex:1,fontSize:12,color:on?col:"#F1EFE8",fontWeight:on?500:400}}>{tier}</span>
                              <span style={S.sm}>{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setSortAsc(a=>!a)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+"#F0997B",background:"#3C1F13",color:"#F0997B",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{sortAsc?"↑":"↓"}</button>
                </div>
              </div>
              {filtered.length===0&&<p style={{color:"#888780",fontSize:14}}>{t.noEntries}</p>}
              {(()=>{
                const groups={};
                filtered.forEach(e=>{const k=e.name;if(!groups[k])groups[k]=[];groups[k].push(e);});
                const groupArr=Object.values(groups).map(grp=>{
                  const e=grp[grp.length-1];
                  const avgBite=grp.reduce((a,e)=>a+(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights)??0),0)/grp.length;
                  const avgTaste=grp.reduce((a,e)=>a+e.taste,0)/grp.length;
                  const avgBpb=grp.reduce((a,e)=>a+(e.cost/e.portions),0)/grp.length;
                  const avgWait=grp.reduce((a,e)=>a+e.wait,0)/grp.length;
                  const avgRepeat=grp.reduce((a,e)=>a+e.repeatability,0)/grp.length;
                  // sortVal: higher = better (for descending = best first)
                  const visits=grp.length;
                  const sortVal=sortBy==="taste"?avgTaste:sortBy==="bpb"?-avgBpb:sortBy==="wait"?-avgWait:sortBy==="repeat"?avgRepeat+(visits*0.001):avgBite;
                  return {grp, e, sortVal};
                }).sort((a,b)=>sortAsc?a.sortVal-b.sortVal:b.sortVal-a.sortVal);
                return groupArr.map(({grp,e},i)=>{
                  const visits=grp.length;
                  const display=getDisplay(e);
                  return (
                    <RestRow key={e.id} e={e} i={i} display={display} isAdmin={isAdmin} visits={visits} group={grp} weights={weights}
                      onEdit={v=>{setEditR(v||e);window.scrollTo({top:0,behavior:"smooth"});}}
                      onDelete={async id=>{ const did=id||e.id; if(isAdmin) { try { await supabase.from("restaurants").delete().eq("id",did); } catch(err){ console.error("restaurant delete threw:",err); } } dispatch({type:"DEL",id:did}); }}/>
                  );
                });
              })()}
              {sortedR.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedR.length)],[t.avgBite,(sortedR.reduce((a,e)=>a+(calcBite(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights)??0),0)/sortedR.length).toFixed(2)]].map(([l,v])=>(
                    <div key={l} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={S.sm}>{l}</div>
                      <div style={{fontSize:20,fontWeight:500,color:"#F1EFE8"}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {logTab==="drinks"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:2}}>
                  {[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat","Repeat"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setCafeSortBy(v)} style={{padding:"5px 12px",borderRadius:16,border:"1px solid "+(cafeSortBy===v?"#F0997B":"rgba(255,255,255,0.1)"),background:cafeSortBy===v?"#3C1F13":"transparent",color:cafeSortBy===v?"#F0997B":"#888780",fontSize:12,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <div ref={csRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowCafeSearch(s=>!s)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showCafeSearch||cafeSearch?"#F0997B":"rgba(255,255,255,0.1)"),background:showCafeSearch||cafeSearch?"#3C1F13":"transparent",color:showCafeSearch||cafeSearch?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                    {showCafeSearch&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 10px",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,width:200}}>
                        <input autoFocus value={cafeSearch} onChange={e=>setCafeSearch(e.target.value)} placeholder={t.searchPlaceholder} style={{width:"100%",boxSizing:"border-box",fontSize:12}}/>
                        {cafeSearch&&<button onClick={()=>setCafeSearch("")} style={{fontSize:11,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:"4px 0 0",display:"block"}}>{t.clear}</button>}
                      </div>
                    )}
                  </div>
                  <div ref={cfRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowCafeFilter(f=>!f)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showCafeFilter||cafeFilterMilk||cafeFilterBean?"#F0997B":"rgba(255,255,255,0.1)"),background:showCafeFilter||cafeFilterMilk||cafeFilterBean?"#3C1F13":"transparent",color:showCafeFilter||cafeFilterMilk||cafeFilterBean?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 2h12l-4.5 5.5V12L5.5 10.5V7.5L1 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                    </button>
                    {showCafeFilter&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,overflow:"hidden",minWidth:200,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,padding:"10px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <span style={S.sm}>Filter</span>
                          {(cafeFilterMilk||cafeFilterBean)&&<button onClick={()=>{setCafeFilterMilk("");setCafeFilterBean("");}} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:0}}>{t.clear}</button>}
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:10,color:"#888780",marginBottom:6}}>{t.milk}</div>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                            {["None","Light","Medium","Heavy"].map(m=>(
                              <div key={m} onClick={()=>setCafeFilterMilk(cafeFilterMilk===m?"":m)} style={{padding:"4px 8px",borderRadius:12,cursor:"pointer",fontSize:11,background:cafeFilterMilk===m?"#3C1F13":"#141413",border:"1px solid "+(cafeFilterMilk===m?"#F0997B":"rgba(255,255,255,0.1)"),color:cafeFilterMilk===m?"#F0997B":"#888780"}}>{m}</div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:"#888780",marginBottom:6}}>{t.beanOrigin}</div>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                            {["Africa","Central America","South America","Asia-Pacific","Blend"].map(b=>(
                              <div key={b} onClick={()=>setCafeFilterBean(cafeFilterBean===b?"":b)} style={{padding:"4px 8px",borderRadius:12,cursor:"pointer",fontSize:11,background:cafeFilterBean===b?"#3C1F13":"#141413",border:"1px solid "+(cafeFilterBean===b?"#F0997B":"rgba(255,255,255,0.1)"),color:cafeFilterBean===b?"#F0997B":"#888780"}}>{b}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setCafeSortAsc(a=>!a)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid #F0997B",background:"#3C1F13",color:"#F0997B",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{cafeSortAsc?"↑":"↓"}</button>
                </div>
              </div>
              {!sortedDrinks.length&&<p style={{color:"#888780",fontSize:14}}>{t.noDrinks}</p>}
              {(()=>{
                const groups={};
                sortedDrinks.forEach(e=>{const k=e.name;if(!groups[k])groups[k]=[];groups[k].push(e);});
                const getSortVal=(grp)=>{
                  const avg=(fn)=>grp.reduce((a,e)=>a+fn(e),0)/grp.length;
                  if(cafeSortBy==="taste") return avg(e=>e.taste);
                  if(cafeSortBy==="bpb") return -avg(e=>e.cost/e.portions);
                  if(cafeSortBy==="wait") return -avg(e=>e.wait);
                  if(cafeSortBy==="repeat") return avg(e=>e.repeatability)+(grp.length*0.001);
                  return avg(e=>calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0);
                };
                return Object.entries(groups).sort((a,b)=>cafeSortAsc?getSortVal(a[1])-getSortVal(b[1]):getSortVal(b[1])-getSortVal(a[1])).map(([name,grp])=>(
                  <CafeGroupRow key={name} group={grp} cafeSortBy={cafeSortBy} isAdmin={isAdmin} onEdit={e=>{setEditC(e);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={async id=>{ if(isAdmin) { try { await supabase.from("cafes").delete().eq("id",id); } catch(err){ console.error("cafe delete threw:",err); } } setCafes(p=>p.filter(x=>x.id!==id)); }}/>
                ));
              })()}
              {sortedDrinks.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedDrinks.length)],[t.avgBite,(sortedDrinks.reduce((a,e)=>a+(calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0),0)/sortedDrinks.length).toFixed(2)]].map(([l,v])=>(
                    <div key={l} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={S.sm}>{l}</div>
                      <div style={{fontSize:20,fontWeight:500,color:"#F1EFE8"}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {logTab==="sweets"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:2}}>
                  {[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat","Repeat"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSweetsSortBy(v)} style={{padding:"5px 12px",borderRadius:16,border:"1px solid "+(sweetsSortBy===v?"#F0997B":"rgba(255,255,255,0.1)"),background:sweetsSortBy===v?"#3C1F13":"transparent",color:sweetsSortBy===v?"#F0997B":"#888780",fontSize:12,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <div ref={ssRef} style={{position:"relative"}}>
                    <button onClick={()=>setShowSweetsSearch(s=>!s)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid "+(showSweetsSearch||sweetsSearch?"#F0997B":"rgba(255,255,255,0.1)"),background:showSweetsSearch||sweetsSearch?"#3C1F13":"transparent",color:showSweetsSearch||sweetsSearch?"#F0997B":"#888780",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                    {showSweetsSearch&&(
                      <div style={{position:"absolute",right:0,top:40,background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 10px",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,width:200}}>
                        <input autoFocus value={sweetsSearch} onChange={e=>setSweetsSearch(e.target.value)} placeholder={t.searchPlaceholder} style={{width:"100%",boxSizing:"border-box",fontSize:12}}/>
                        {sweetsSearch&&<button onClick={()=>setSweetsSearch("")} style={{fontSize:11,color:"#888780",background:"none",border:"none",cursor:"pointer",padding:"4px 0 0",display:"block"}}>{t.clear}</button>}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setSweetsSortAsc(a=>!a)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid #F0997B",background:"#3C1F13",color:"#F0997B",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{sweetsSortAsc?"↑":"↓"}</button>
                </div>
              </div>
              {!sortedSweets.length&&<p style={{color:"#888780",fontSize:14}}>{t.noSweets}</p>}
              {(()=>{
                const groups={};
                sortedSweets.forEach(e=>{const k=e.name;if(!groups[k])groups[k]=[];groups[k].push(e);});
                const getSortValS=(grp)=>{
                  const avg=(fn)=>grp.reduce((a,e)=>a+fn(e),0)/grp.length;
                  if(sweetsSortBy==="taste") return avg(e=>e.taste);
                  if(sweetsSortBy==="bpb") return -avg(e=>e.cost/e.portions);
                  if(sweetsSortBy==="wait") return -avg(e=>e.wait);
                  if(sweetsSortBy==="repeat") return avg(e=>e.repeatability)+(grp.length*0.001);
                  return avg(e=>calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0);
                };
                return Object.entries(groups).sort((a,b)=>sweetsSortAsc?getSortValS(a[1])-getSortValS(b[1]):getSortValS(b[1])-getSortValS(a[1])).map(([name,grp])=>(
                  <CafeGroupRow key={name} group={grp} cafeSortBy={sweetsSortBy} isAdmin={isAdmin} onEdit={e=>{setEditC(e);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={async id=>{ if(isAdmin) { try { await supabase.from("cafes").delete().eq("id",id); } catch(err){ console.error("cafe delete threw:",err); } } setCafes(p=>p.filter(x=>x.id!==id)); }}/>
                ));
              })()}
              {sortedSweets.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:16}}>
                  {[[t.entries,String(sortedSweets.length)],[t.avgBite,(sortedSweets.reduce((a,e)=>a+(calcCafe(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability)??0),0)/sortedSweets.length).toFixed(2)]].map(([l,v])=>(
                    <div key={l} style={{background:"#1E1E1C",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={S.sm}>{l}</div>
                      <div style={{fontSize:20,fontWeight:500,color:"#F1EFE8"}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {st.view==="log"&&editR&&<RestForm initial={editR} weights={weights} existingNames={st.entries.map(e=>e.name)} existingEntries={st.entries} onSave={async e=>{
        console.log("restaurant save — isAdmin:", isAdmin, "id:", e.id);
        if(isAdmin) {
          try {
            const {error} = await supabase.from("restaurants").update({
              name:e.name, cuisine:e.cuisine, cuisine2:e.cuisine2||"",
              is_fusion:e.isFusion||false, taste:e.taste, cost:e.cost,
              portions:e.portions, wait:e.wait, repeatability:e.repeatability,
              use_r:e.useR, notes:e.notes||""
            }).eq("id",e.id);
            if(error) console.error("restaurant update error:", error);
          } catch(err) { console.error("restaurant update threw:", err); }
        }
        dispatch({type:"UPD",e}); setEditR(null);
      }} onCancel={()=>{setEditR(null);window.scrollTo({top:0,behavior:"smooth"});}}/>}
      {st.view==="log"&&editC&&<CafeForm initial={editC} onSave={async entries=>{
        const e=Array.isArray(entries)?entries[0]:entries;
        console.log("cafe save — isAdmin:", isAdmin, "id:", e.id, "type:", typeof e.id);
        if(isAdmin) {
          try {
            const {error} = await supabase.from("cafes").update({
              name:e.name, category:e.category, order_item:e.order||"",
              taste:e.taste, cost:e.cost, portions:e.portions, wait:e.wait||0,
              bean_region:e.beanRegion||"", milk_level:e.milkLevel||"",
              repeatability:e.repeatability, use_r:e.useR, notes:e.notes||""
            }).eq("id",e.id);
            if(error) console.error("cafe update error:", error, "id:", e.id);
          } catch(err) { console.error("cafe update threw:", err); }
        }
        setCafes(p=>p.map(x=>x.id===e.id?{...e,id:x.id}:x)); setEditC(null);
      }} onCancel={()=>{setEditC(null);window.scrollTo({top:0,behavior:"smooth"});}} existingNames={cafes.map(e=>e.name)} existingCafes={cafes} pastOrders={cafes.map(e=>e.order).filter(Boolean)}/>}

      {/* ── Add Rating ── */}
      {st.view==="add"&&(
        <div>
          {addType==="restaurant"
            ?<RestForm initial={{...INIT_REST,city:lastCity.current}} weights={weights} existingNames={st.entries.map(e=>e.name)} existingEntries={st.entries}
                onSave={async e=>{
                  if(isAdmin) {
                    try {
                      const {data,error} = await supabase.from("restaurants").insert([{
                        name:e.name, cuisine:e.cuisine, cuisine2:e.cuisine2||"",
                        is_fusion:e.isFusion||false, taste:e.taste, cost:e.cost,
                        portions:e.portions, wait:e.wait, repeatability:e.repeatability,
                        use_r:e.useR, notes:e.notes||"", letter:(e.cuisine?.[0]||"").toUpperCase()
                      }]).select().single();
                      if(error) console.error("restaurant insert error:",error);
                      dispatch({type:"ADD",e:{...e,id:data?.id||Date.now()}});
                    } catch(err) { console.error("restaurant insert threw:",err); dispatch({type:"ADD",e:{...e,id:Date.now()}}); }
                  } else {
                    if(e.city)lastCity.current=e.city;
                    dispatch({type:"ADD",e:{...e,id:Date.now()}});
                  }
                }}
                onCancel={()=>dispatch({type:"VIEW",view:"log"})}
                addType={addType} setAddType={setAddType}
              />
            :<CafeForm initial={INIT_CAFE}
                onSave={async entries=>{
                  const arr=Array.isArray(entries)?entries:[entries];
                  if(isAdmin) {
                    try {
                      const rows = arr.map(e=>({
                        name:e.name, category:e.category, order_item:e.order||"",
                        taste:e.taste, cost:e.cost, portions:e.portions, wait:e.wait||0,
                        bean_region:e.beanRegion||"", milk_level:e.milkLevel||"",
                        repeatability:e.repeatability, use_r:e.useR, notes:e.notes||""
                      }));
                      const {data,error} = await supabase.from("cafes").insert(rows).select();
                      if(error) console.error("cafe insert error:",error);
                      setCafes(p=>[...p,...(data?data.map((c,i)=>({...arr[i],id:c.id})):arr.map(e=>({...e,id:Date.now()+Math.random()})))]);
                    } catch(err) { console.error("cafe insert threw:",err); setCafes(p=>[...p,...arr.map(e=>({...e,id:Date.now()+Math.random()}))]); }
                  } else {
                    setCafes(p=>[...p,...arr.map(e=>({...e,id:Date.now()+Math.random()}))]);
                  }
                  dispatch({type:"VIEW",view:"log"});
                  setLogTab(arr.some(e=>e.category==="Sweets")?"sweets":"drinks");
                }}
                onCancel={()=>dispatch({type:"VIEW",view:"log"})}
                addType={addType} setAddType={setAddType}
                existingNames={cafes.map(e=>e.name)}
                existingCafes={cafes}
                pastOrders={cafes.map(e=>e.order).filter(Boolean)}
              />
          }
        </div>
      )}

      {/* ── Quests ── */}
      {st.view==="quests"&&(
        <div>
          <div style={{marginBottom:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
              <span style={{fontSize:16,fontWeight:500,color:"#F1EFE8"}}>{t.aZQuest}</span>
              <span style={{fontSize:18,fontWeight:500,color:"#97C459"}}>{questL.size}<span style={{fontSize:13,fontWeight:400,color:"#888780"}}> / 26</span></span>
            </div>
            <p style={{fontSize:11,color:"#888780",margin:"0 0 10px"}}>{t.tapToToggle}</p>
            <div style={{background:"#0D0D0C",borderRadius:8,height:6,marginBottom:16,overflow:"hidden"}}>
              <div style={{height:"100%",width:((questL.size/26)*100)+"%",background:"#97C459",borderRadius:8,transition:"width 0.4s"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(36px,1fr))",gap:6}}>
              {ALPHABET.map(l=>{
                const isQ=questL.has(l),isL=covered.has(l);
                const entry=st.entries.find(e=>(e.letter||e.cuisine?.[0])?.toUpperCase()===l);
                return(
                  <div key={l} title={entry?entry.name:l} onClick={()=>toggleQ(l)}
                    style={{height:36,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,cursor:isL?"pointer":"default",transition:"all 0.15s",background:isQ?"#1A2E0A":isL?"#3C1F13":"#1E1E1C",color:isQ?"#97C459":isL?"#F0997B":"#888780",border:"0.5px solid "+(isQ?"#97C459":isL?"#D85A30":"rgba(255,255,255,0.1)")}}>
                    {l}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:16,marginTop:12}}>
              {[[t.questLegendQuest,"#97C459","#1A2E0A"],[t.questLegendLogged,"#F0997B","#3C1F13"],[t.questLegendNotYet,"#888780","#1E1E1C"]].map(([label,col,bg])=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:12,height:12,borderRadius:3,background:bg,border:"0.5px solid "+col}}/>
                  <span style={S.sm}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{borderTop:"0.5px solid rgba(255,255,255,0.1)",marginBottom:32}}/>

          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:16,fontWeight:500,color:"#F1EFE8"}}>{t.cuisineQuest}</span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18,fontWeight:500,color:"#F0997B"}}>{doneCount}<span style={{fontSize:13,fontWeight:400,color:"#888780"}}> / {totalCuisines}</span></span>
                <button onClick={()=>dispatch({type:"VIEW",view:"suggest"})} style={{fontSize:11,color:"#F0997B",background:"#3C1F13",border:"0.5px solid "+"#F0997B",borderRadius:20,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap"}}>{t.suggestRestaurant}</button>
              </div>
            </div>
            <div style={{background:"#0D0D0C",borderRadius:8,height:6,marginBottom:20,overflow:"hidden"}}>
              <div style={{height:"100%",width:((doneCount/totalCuisines)*100)+"%",background:"#F0997B",borderRadius:8,transition:"width 0.4s"}}/>
            </div>
            {Object.entries(CUISINE_REGIONS).map(([region,cuisines])=>{
              const rd=cuisines.filter(x=>loggedC.has(x)).length,pct=Math.round((rd/cuisines.length)*100);
              return(
                <div key={region} style={{marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                    <span style={S.val}>{region}</span>
                    <span style={{fontSize:12,color:rd===cuisines.length?"#97C459":"#888780"}}>{rd}/{cuisines.length}</span>
                  </div>
                  <div style={{background:"#0D0D0C",borderRadius:6,height:5,marginBottom:8,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:rd===cuisines.length?"#97C459":"#F0997B",borderRadius:6,transition:"width 0.4s"}}/>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {cuisines.map(x=>{
                      const done=loggedC.has(x);
                      const names=st.entries.filter(e=>e.cuisine&&e.cuisine.trim()===x).map(e=>e.name).join("; ");
                      return(
                        <Tooltip key={x} content={done?names:null}>
                          <span style={{fontSize:11,padding:"3px 8px",borderRadius:12,background:done?"#3C1F13":"#1E1E1C",color:done?"#F0997B":"#888780",border:"0.5px solid "+(done?"#F0997B":"rgba(255,255,255,0.1)"),fontWeight:done?500:400}}>
                            {FLAGS[x]?FLAGS[x]+" ":""}{x}
                          </span>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {st.view==="suggest"&&<SuggestView entries={st.entries} onBack={()=>dispatch({type:"VIEW",view:"quests"})}/>}
      {st.view==="palette"&&<PaletteView entries={st.entries} cafes={cafes} weights={weights} updateWeight={updW} resetWeights={resetWeights} totalW={totalW} weightError={wErr} cafeWeights={cafeWeights} updateCafeW={updCafeW} resetCafeWeights={resetCafeWeights} cafeTotalW={+(cafeWeights.taste+cafeWeights.bpb).toFixed(0)} cafeWErr={cafeWErr}/>}

      {/* ── FAQ ── */}
      {st.view==="faq"&&<FaqView isAdmin={isAdmin} faqOverrides={faqOverrides} setFaqOverrides={setFaqOverrides}/>}
    </div>
    </LangContext.Provider>
  );
}
