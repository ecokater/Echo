import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000";
export const WS_BASE_URL =
  (import.meta.env.VITE_WS_BASE_URL as string) || "ws://127.0.0.1:8000";

const ACCESS_KEY = "amber_access_token";
const REFRESH_KEY = "amber_refresh_token";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({ baseURL: API_BASE_URL });

// Attach access token
api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// On 401, try one refresh then retry; otherwise force re-login
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refresh_token: refresh });
    tokenStore.set(data.access_token);
    return data.access_token;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      if (!refreshing) refreshing = doRefresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // refresh failed → clear and bounce to login
      tokenStore.clear();
      if (location.pathname !== "/login") location.href = "/login";
    }
    return Promise.reject(error);
  }
);
