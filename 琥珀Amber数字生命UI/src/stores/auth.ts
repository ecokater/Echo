import { create } from "zustand";
import { tokenStore } from "@/api/client";
import { AmberUser, login as apiLogin, register as apiRegister, fetchMe, logout as apiLogout } from "@/api/auth";

interface AuthState {
  user: AmberUser | null;
  loading: boolean;
  initialized: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  login: async (phone, password) => {
    set({ loading: true });
    try {
      const user = await apiLogin(phone, password);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  register: async (phone, password, nickname) => {
    set({ loading: true });
    try {
      const user = await apiRegister(phone, password, nickname);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    apiLogout();
    set({ user: null });
  },

  // Restore session on app load if a token exists
  bootstrap: async () => {
    if (!tokenStore.getAccess()) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await fetchMe();
      set({ user });
    } catch {
      tokenStore.clear();
    } finally {
      set({ initialized: true });
    }
  },
}));
