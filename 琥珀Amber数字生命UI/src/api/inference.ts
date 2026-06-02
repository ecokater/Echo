import { api } from "./client";
import type {
  InferenceChatRequest, InferenceChatResponse,
  InferenceDistillRequest, InferenceDistillResponse,
  InferenceMemorySummaryRequest, InferenceMemorySummaryResponse,
} from "@/types/skill";

/** Stateless cloud inference proxy. Client owns all persona/memory state. */
export const inferenceApi = {
  chat: async (req: InferenceChatRequest): Promise<InferenceChatResponse> => {
    const { data } = await api.post<InferenceChatResponse>("/api/inference/chat", req);
    return data;
  },
  distill: async (req: InferenceDistillRequest): Promise<InferenceDistillResponse> => {
    const { data } = await api.post<InferenceDistillResponse>("/api/inference/distill", req);
    return data;
  },
  memorySummary: async (req: InferenceMemorySummaryRequest): Promise<InferenceMemorySummaryResponse> => {
    const { data } = await api.post<InferenceMemorySummaryResponse>("/api/inference/memory-summary", req);
    return data;
  },
};

/** Build the model descriptor from locally stored LLM settings. */
export function modelFromSettings() {
  try {
    const c = JSON.parse(localStorage.getItem("amber_global_api") || "{}");
    return { provider: "openai", model_id: c.modelId, api_key: c.apiKey, base_url: c.baseUrl };
  } catch {
    return { provider: "openai" };
  }
}
