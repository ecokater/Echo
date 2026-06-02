import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "amber_theme";

type ThemeMode = "dark" | "light";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readThemePreference(defaultDark = true): boolean {
  if (!canUseStorage()) return defaultDark;
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === "dark") return true;
    if (saved === "light") return false;
  } catch {
    return defaultDark;
  }
  return defaultDark;
}

export function applyThemePreference(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

export function saveThemePreference(isDark: boolean) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  } catch {
    // Ignore storage failures; the current document theme is still applied.
  }
}

export function useThemePreference(defaultDark = true) {
  const [dark, setDark] = useState(() => readThemePreference(defaultDark));

  useEffect(() => {
    applyThemePreference(dark);
    saveThemePreference(dark);
  }, [dark]);

  return [dark, setDark] as const;
}

export function useApplySavedTheme(defaultDark = true) {
  useEffect(() => {
    applyThemePreference(readThemePreference(defaultDark));
  }, [defaultDark]);
}
