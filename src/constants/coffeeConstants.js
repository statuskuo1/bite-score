export const BEAN_ORIGINS = [
  "Brazil", "Colombia", "Central America",
  "Ethiopia", "Kenya", "Yemen",
  "Vietnam", "Indonesia", "Papua New Guinea",
  "Hawaii",
  "Blend", "Other",
];

export const BEAN_ORIGIN_GROUPS = [
  { label: "Latin America & South America", origins: ["Brazil", "Colombia", "Central America"] },
  { label: "Africa & The Middle East", origins: ["Ethiopia", "Kenya", "Yemen"] },
  { label: "Asia & The Pacific", origins: ["Vietnam", "Indonesia", "Papua New Guinea"] },
  { label: "North America", origins: ["Hawaii"] },
  { label: "", origins: ["Blend", "Other"] },
];

export const BEAN_REGIONS = [
  "Latin America & South America",
  "Africa & The Middle East",
  "Asia & The Pacific",
  "North America",
  "Blend",
  "Other",
];

export const BEAN_REGION_COLORS = {
  "Latin America & South America": "#EF9F27",
  "Africa & The Middle East": "#97C459",
  "Asia & The Pacific": "#5B9BD5",
  "North America": "#AFA9EC",
  "Blend": "#888780",
  "Other": "#444441",
};

const ORIGIN_TO_REGION = {
  // Current origins
  Brazil: "Latin America & South America",
  Colombia: "Latin America & South America",
  "Central America": "Latin America & South America",
  Ethiopia: "Africa & The Middle East",
  Kenya: "Africa & The Middle East",
  Yemen: "Africa & The Middle East",
  Vietnam: "Asia & The Pacific",
  Indonesia: "Asia & The Pacific",
  "Papua New Guinea": "Asia & The Pacific",
  Hawaii: "North America",
  Blend: "Blend",
  Other: "Other",
  // Legacy values from old rows
  Africa: "Africa & The Middle East",
  "South America": "Latin America & South America",
  "Asia-Pacific": "Asia & The Pacific",
  Guatemala: "Latin America & South America",
  Sumatra: "Asia & The Pacific",
  Unknown: "Other",
};

export const regionOf = (origin) => ORIGIN_TO_REGION[origin] || "Other";
