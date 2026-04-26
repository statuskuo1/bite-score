import { createContext, useContext } from "react";

export const LangContext = createContext({ t: {} });

export function useLang() {
  return useContext(LangContext);
}
