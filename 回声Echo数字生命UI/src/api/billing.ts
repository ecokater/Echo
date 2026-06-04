import { api } from "./client";

export interface Sku {
  sku: string;
  title: string;
  fragments: number;
  price_cny: number;
  price_display: string;
  apple_product_id: string | null;
}

export interface OrderResult {
  order_id: string;
  out_trade_no: string;
  amount_cny: number;
  fragments: number;
  pay: Record<string, unknown>;
}

export interface BillingOrder {
  order_id: string;
  out_trade_no: string;
  sku: string;
  amount_cny: number;
  amount_display: string;
  fragments: number;
  channel: string;
  status: string;
  created_at: string | null;
  paid_at: string | null;
}

export const listSkus = async (): Promise<Sku[]> => {
  const { data } = await api.get<Sku[]>("/api/billing/skus");
  return data;
};

export const listOrders = async (limit = 20): Promise<BillingOrder[]> => {
  const { data } = await api.get<BillingOrder[]>(`/api/billing/orders?limit=${limit}`);
  return data;
};

export const createOrder = async (sku: string, channel: string): Promise<OrderResult> => {
  const { data } = await api.post<OrderResult>("/api/billing/order", { sku, channel });
  return data;
};

/** Dev-only: simulate payment success to verify the full loop locally. */
export const settleDev = async (out_trade_no: string): Promise<{ status: string; balance: number }> => {
  const { data } = await api.post("/api/billing/callback/dev", { out_trade_no });
  return data;
};
