import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ theme: "light", setTheme: () => {} });

export const THEMES = [
  { value: "light", label: "Light", icon: "??" },
  { value: "dark", label: "Dark", icon: "??" },
  { value: "ocean", label: "Ocean", icon: "??" },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("cc-theme") || "light"; }
    catch { return "light"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.className = "theme-" + theme;
    try { localStorage.setItem("cc-theme", theme); } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
