import { api } from "./client";

export interface UsageEvent {
  id: number;
  user_id: string;
  event_type: string;
  endpoint: string;
  provider: string | null;
  model_id: string | null;
  status: string;
  cost_fragments: number;
  refunded_fragments: number;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  error_code: string | null;
  created_at: string | null;
}

export const getUsageEvents = async (limit = 20): Promise<UsageEvent[]> => {
  const { data } = await api.get<UsageEvent[]>(`/api/system/usage-events?limit=${limit}`);
  return data;
};
