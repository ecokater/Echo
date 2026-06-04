// Local-first architecture: client owns persona/message/memory; server is a
// stateless inference proxy. These types mirror the backend inference schemas.

export interface MoodState {
  happiness: number;
  anger: number;
  anxiety: number;
}

export interface InferencePersona {
  id?: string;
  name: string;
  traits: string[];
  core_memory: string;
  mood: MoodState;
}

export interface InferenceMessage {
  role: "user" | "assistant";
  content: string;
}

export interface InferenceContext {
  recent_messages: InferenceMessage[];
  retrieved_memories: string[];
}

export interface InferenceModel {
  provider?: string;
  model_id?: string;
  api_key?: string;
  base_url?: string;
}

export interface InferenceChatRequest {
  persona: InferencePersona;
  context: InferenceContext;
  input: { content: string };
  model: InferenceModel;
}

export interface MoodDelta {
  happiness: number;
  anger: number;
  anxiety: number;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  cost_fragments: number;
}

export interface InferenceChatResponse {
  reply: string;
  mood_delta: MoodDelta;
  memory_candidates: string[];
  usage: Usage;
}

export interface InferenceDistillRequest {
  name: string;
  core_memory: string;
  traits_map: Record<string, number>;
  model: InferenceModel;
}

export interface InferenceDistillResponse {
  core_memory: string;
  stability: number;
  synchronization: number;
  refined_traits: string[];
  usage: Usage;
}

export interface InferenceMemorySummaryRequest {
  persona_name: string;
  messages: InferenceMessage[];
  model: InferenceModel;
}

export interface InferenceMemorySummaryResponse {
  summary: string;
  usage: Usage;
}

// ---- Local persisted entities (IndexedDB) ----

export interface LocalPersona {
  id: string;
  name: string;
  gender: string;
  relationship_desc: string;
  impression: string;
  avatar: string | null;
  core_memory: string;
  traits: string[];
  catchphrases: string[];
  stability: number;
  synchronization: number;
  happiness: number;
  anger: number;
  anxiety: number;
  // optional console tuning fields (UI only)
  intimacy?: number;
  activity?: number;
  curiosity?: number;
  response_temp?: number;
  proactivity?: number;
  memory_depth?: number;
  created_at: string;
  updated_at: string;
}

export interface LocalMessage {
  id: string;
  persona_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface LocalCorpus {
  id: string;
  persona_id: string;
  content: string;
  weight: number;
  is_pinned: boolean;
  timestamp: string;
}
