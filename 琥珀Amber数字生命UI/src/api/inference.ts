import { api } from "./client";
import type {
  InferenceModel,
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

/** Build the model descriptor sent to the inference proxy.
 *
 * Default (main version): return an empty model → the server uses its platform
 * model (SiliconFlow / DeepSeek). Only when the user explicitly opts into the
 * advanced "自定义模型 API" mode do we forward their own key (BYO, preserved).
 */
export function modelFromSettings(): InferenceModel {
  try {
    if (localStorage.getItem("amber_use_custom_api") !== "1") return {};
    const c = JSON.parse(localStorage.getItem("amber_global_api") || "{}");
    if (!c.apiKey) return {};
    return { provider: "openai", model_id: c.modelId, api_key: c.apiKey, base_url: c.baseUrl };
  } catch {
    return {};
  }
}
