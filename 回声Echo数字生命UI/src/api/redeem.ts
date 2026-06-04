import { api } from "./client";

export interface RedeemResult {
  code: string;
  fragments: number;
  balance: number;
  redeemed_at: string;
}

export const redeemCode = async (code: string): Promise<RedeemResult> => {
  const { data } = await api.post<RedeemResult>("/api/redeem", { code });
  return data;
};
