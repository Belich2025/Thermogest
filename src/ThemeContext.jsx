import React, { createContext, useContext, useState, useMemo } from "react";
import { SC_LIGHT, SC_DARK, mkBS, mkMS, mkPS } from "./constants/status.js";

const T_LIGHT = {
  bg:"#f8fafc", card:"#ffffff", surface:"#f1f5f9",
  border:"#e2e8f0", accent:"#1d4ed8", accentLight:"#dbeafe",
  green:"#16a34a", greenLight:"#dcfce7",
  red:"#dc2626", redLight:"#fee2e2",
  orange:"#d97706", orangeLight:"#fff7ed", teal:"#0d9488", tealLight:"#f0fdfa",
  purple:"#7c3aed", purpleLight:"#f5f3ff",
  text:"#0f172a", sub:"#475569", muted:"#94a3b8",
  input:"#ffffff",
};
const T_DARK = {
  bg:"#0a0a0a", card:"#111111", surface:"#1a1a1a",
  border:"#3a3a3a", accent:"#3b82f6", accentLight:"#1a2e4a",
  green:"#a0a0a0", greenLight:"#1a1a1a",
  red:"#ef4444", redLight:"#2d0a0a",
  orange:"#f97316", orangeLight:"#2d1a0080", teal:"#14b8a6", tealLight:"#134e4a",
  purple:"#a78bfa", purpleLight:"#2e1065",
  text:"#f0f0f0", sub:"#aaaaaa", muted:"#666666",
  input:"#1a1a1a",
};

export { T_LIGHT, T_DARK };

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("blch-darkmode") === "true"
  );

  React.useEffect(() => {
    localStorage.setItem("blch-darkmode", darkMode);
    document.body.style.background = darkMode ? "#0a0a0a" : "#f8fafc";
  }, [darkMode]);

  const value = useMemo(() => {
    const T  = darkMode ? T_DARK : T_LIGHT;
    const SC = darkMode ? SC_DARK : SC_LIGHT;
    return {
      darkMode, setDarkMode,
      T, SC,
      BS: mkBS(SC), MS: mkMS(SC), PS: mkPS(SC),
    };
  }, [darkMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
