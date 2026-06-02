import { api, tokenStore } from "./client";

export interface AmberUser {
  id: string;
  phone: string | null;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AmberUser;
}

export const register = async (phone: string, password: string, nickname?: string): Promise<AmberUser> => {
  const { data } = await api.post<TokenResponse>("/api/auth/register", { phone, password, nickname });
  tokenStore.set(data.access_token, data.refresh_token);
  return data.user;
};

export const login = async (phone: string, password: string): Promise<AmberUser> => {
  const { data } = await api.post<TokenResponse>("/api/auth/login", { phone, password });
  tokenStore.set(data.access_token, data.refresh_token);
  return data.user;
};

export const fetchMe = async (): Promise<AmberUser> => {
  const { data } = await api.get<AmberUser>("/api/auth/me");
  return data;
};

export const logout = () => tokenStore.clear();

export const deleteAccount = async (): Promise<void> => {
  await api.delete("/api/auth/me");
  tokenStore.clear();
};
