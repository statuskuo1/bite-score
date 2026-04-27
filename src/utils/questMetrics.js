import { CUISINE_REGIONS } from "../constants/cuisineConstants.js";

/** Shared counts for Cuisine Quests summary row and modal stat pills. */
export function getQuestMetrics(entries, questL) {
  const covered = new Set(entries.map((e) => (e.letter || e.cuisine?.[0])?.toUpperCase()));
  const loggedC = new Set(entries.map((e) => e.cuisine && e.cuisine.trim()));
  const totalCuisines = Object.values(CUISINE_REGIONS).flat().length;
  const doneCount = Object.values(CUISINE_REGIONS).flat().filter((x) => loggedC.has(x)).length;
  const letterQuestSize = questL.size;
  const totalForBar = totalCuisines > 0 ? totalCuisines : 1;
  const combinedProgress =
    ((doneCount / totalForBar) + (letterQuestSize / 26)) / 2;
  return {
    covered,
    loggedC,
    totalCuisines,
    doneCount,
    letterQuestSize,
    combinedProgress,
  };
}
