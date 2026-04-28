export const CAFE_ORDERS = {
  "Coffee": ["Espresso","Cortado","Cappuccino","Latte","Flat White","Americano","Cold Brew"],
  "Tea":    ["Matcha","Hojicha","Chai","Brewed Tea","Oolong","Earl Grey"],
  "Sweets": ["Croissant","Cookie","Cake","Tart","Muffin","Ice cream","Soft serve","Pastry"],
  "Other":  ["Smoothie","Juice","Hot chocolate","Milkshake","Lemonade","Soda"],
};
export const CAFE_ICONS = {"Coffee":"☕","Tea":"🍵","Sweets":"🥐","Other":"🥤"};
export function getCafeIcon(category, order) {
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
