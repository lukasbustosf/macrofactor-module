"use client";

import { useEffect, useState } from "react";

const KEY = "mf-theme";

function apply(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/**
 * Dark mode con persistencia en localStorage y sincronía con la clase
 * `.dark` del <html> (Tailwind darkMode:'class').
 * El anti-flash lo maneja el script inline en layout.tsx.
 */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }

  return { theme, toggle };
}

/** Script que se inyecta en <head> para evitar el destello (FOUC). */
export const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('${KEY}');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
