import { create } from "zustand";

export type Locale = "zh" | "en";

// New key — does NOT collide with existing amber_* storage keys (REQ-016 keeps those).
const KEY = "echo_locale";

function initial(): Locale {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: initial(),
  setLocale: (l) => {
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    set({ locale: l });
  },
  toggle: () => {
    const next: Locale = get().locale === "zh" ? "en" : "zh";
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    set({ locale: next });
  },
}));
