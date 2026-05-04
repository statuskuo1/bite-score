import { useSyncExternalStore } from "react";
import { subscribeWantToGo, wantToGoHas } from "./sessionCache.js";

/**
 * Reactive "is this place saved?" subscription driven by `wantToGoCache`.
 *
 * Any component that reads this hook re-renders immediately when something
 * mutates the shared cache (addWantToGo / removeWantToGo, optimistic helpers,
 * boot-time seed, or the auto-removal after a visit insert) — regardless of
 * which surface triggered the change. That's what lets the "+ Want to go"
 * button on a feed post reflect a save done from the stat sheet (and
 * vice-versa) without a remount.
 *
 * The snapshot is a primitive boolean so React's default `Object.is` equality
 * works and we don't re-render on unrelated rows.
 */
export function useWantToGoSaved(placeId, kind) {
  return useSyncExternalStore(
    subscribeWantToGo,
    () => wantToGoHas(placeId, kind),
    () => false,
  );
}
