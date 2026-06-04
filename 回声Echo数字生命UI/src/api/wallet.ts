import { api } from "./client";

export interface Balance {
  balance: number;
  low_balance: boolean;
  threshold: number;
}

export interface LedgerEntry {
  id: number;
  delta: number;
  type: string;
  ref_id: string | null;
  balance_after: number;
  created_at: string;
}

export const getBalance = async (): Promise<Balance> => {
  const { data } = await api.get<Balance>("/api/wallet/balance");
  return data;
};

export const getLedger = async (limit = 50): Promise<LedgerEntry[]> => {
  const { data } = await api.get<LedgerEntry[]>(`/api/wallet/ledger?limit=${limit}`);
  return data;
};
