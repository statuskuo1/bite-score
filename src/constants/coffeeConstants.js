export const BEAN_ORIGINS = ["Ethiopia","Colombia","Brazil","Guatemala","Kenya","Sumatra","Blend","Other"];

export const BEAN_REGIONS = ["Africa","Central America","South America","Asia-Pacific","Blend","Other"];

export const BEAN_REGION_COLORS = {
  "Africa":"#97C459",
  "Central America":"#F0997B",
  "South America":"#EF9F27",
  "Asia-Pacific":"#5B9BD5",
  "Blend":"#AFA9EC",
  "Other":"#888780",
};

const ORIGIN_TO_REGION = {
  Ethiopia: "Africa",
  Kenya: "Africa",
  Guatemala: "Central America",
  Colombia: "South America",
  Brazil: "South America",
  Sumatra: "Asia-Pacific",
  Blend: "Blend",
  // Legacy broad-geo values (existing rows) map to themselves so old data
  // keeps showing up correctly in the donut and filters.
  Africa: "Africa",
  "Central America": "Central America",
  "South America": "South America",
  "Asia-Pacific": "Asia-Pacific",
  Unknown: "Other",
  Other: "Other",
};

export const regionOf = (origin) => ORIGIN_TO_REGION[origin] || "Other";
