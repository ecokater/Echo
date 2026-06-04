from pydantic import BaseModel, Field
from typing import Any, List, Optional
from datetime import datetime


class PersonaBase(BaseModel):
    name: str
    gender: str
    relationship_desc: str
    impression: str
    avatar: Optional[str] = None
    token: Optional[str] = None
    core_memory: str
    traits: List[str]
    catchphrases: List[str]
    stability: float
    synchronization: float


class PersonaCreate(PersonaBase):
    id: Optional[str] = None
    raw_corpus: Optional[str] = None


class PersonaResponse(PersonaBase):
    id: str
    happiness: float
    anger: float
    anxiety: float
    last_interaction_time: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageBase(BaseModel):
    persona_id: str
    role: str
    content: str
    is_filtered: bool = False


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: int
    timestamp: str

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    content: str
    api_key: Optional[str] = None
    base_url: Optional[str] = "https://api.openai.com/v1"
    model_id: Optional[str] = "gpt-4o-mini"


class PersonaIdRequest(BaseModel):
    persona_id: str


class ChargeRequest(BaseModel):
    corpus_id: int


class TogglePinRequest(BaseModel):
    corpus_id: int


class RedistillRequest(BaseModel):
    persona_id: str
    name: str
    avatar: Optional[str] = None
    core_memory: str
    traits_map: dict
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_id: Optional[str] = None


class CommitUpdateRequest(BaseModel):
    persona_id: str
    name: str
    avatar: Optional[str] = None
    core_memory: str
    traits: Optional[List[str]] = None
    stability: Optional[float] = None
    synchronization: Optional[float] = None


# --- Inference proxy (Local-first architecture) ---
# Server is stateless: it receives ephemeral context, calls the model, returns
# reply/mood_delta/usage. It does NOT persist persona/messages/memory.

class MoodState(BaseModel):
    happiness: float = 50
    anger: float = 0
    anxiety: float = 0


class InferencePersona(BaseModel):
    id: Optional[str] = None          # client-local id, opaque to server
    name: str
    traits: List[str] = []
    core_memory: str = ""
    mood: MoodState = MoodState()


class InferenceMessage(BaseModel):
    role: str                         # "user" | "assistant"
    content: str


class InferenceContext(BaseModel):
    recent_messages: List[InferenceMessage] = []
    retrieved_memories: List[str] = []


class InferenceModel(BaseModel):
    provider: Optional[str] = "openai"
    model_id: Optional[str] = "gpt-4o-mini"
    api_key: Optional[str] = None     # user-supplied key; falls back to server global
    base_url: Optional[str] = None


class InferenceChatRequest(BaseModel):
    persona: InferencePersona
    context: InferenceContext = InferenceContext()
    input: dict                       # {"content": "..."}
    model: InferenceModel = InferenceModel()


class MoodDelta(BaseModel):
    happiness: int = 0
    anger: int = 0
    anxiety: int = 0


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_fragments: int = 0


class InferenceChatResponse(BaseModel):
    reply: str
    mood_delta: MoodDelta
    memory_candidates: List[str] = []
    usage: Usage


class InferenceDistillRequest(BaseModel):
    name: str
    core_memory: str
    traits_map: dict = {}             # {"anger":n,"humor":n,"empathy":n}
    model: InferenceModel = InferenceModel()


class InferenceDistillResponse(BaseModel):
    core_memory: str
    stability: int
    synchronization: int
    refined_traits: List[str]
    usage: Usage


class InferenceMemorySummaryRequest(BaseModel):
    persona_name: str
    messages: List[InferenceMessage] = []
    model: InferenceModel = InferenceModel()


class InferenceMemorySummaryResponse(BaseModel):
    summary: str
    usage: Usage


class UsageEventResponse(BaseModel):
    id: int
    user_id: str
    event_type: str
    endpoint: str
    provider: Optional[str] = None
    model_id: Optional[str] = None
    status: str
    cost_fragments: int = 0
    refunded_fragments: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
    error_code: Optional[str] = None
    created_at: Optional[str] = None


class SystemEventResponse(BaseModel):
    id: int
    user_id: Optional[str] = None
    level: str
    source: str
    event_type: str
    message: str
    metadata: dict[str, Any] = {}
    created_at: Optional[str] = None


# ───────────────────────── Explore: shared persona templates ─────────────────

class SharePublishRequest(BaseModel):
    """Publishable persona card. Chat history / private memory are NEVER sent."""
    name: str
    gender: Optional[str] = None
    relationship_desc: Optional[str] = None
    impression: Optional[str] = None
    avatar: Optional[str] = None
    core_memory: Optional[str] = None
    traits: Optional[str] = None
    catchphrases: Optional[str] = None
    tags: Optional[str] = None


class SharedPersonaCard(BaseModel):
    """List-view summary (no heavy core_memory payload)."""
    id: str
    owner_id: str
    owner_nickname: Optional[str] = None
    name: str
    gender: Optional[str] = None
    relationship_desc: Optional[str] = None
    impression: Optional[str] = None
    avatar: Optional[str] = None
    tags: Optional[str] = None
    install_count: int = 0
    like_count: int = 0
    created_at: Optional[str] = None


class SharedPersonaDetail(SharedPersonaCard):
    """Detail / install payload — full template to recreate the persona locally."""
    core_memory: Optional[str] = None
    traits: Optional[str] = None
    catchphrases: Optional[str] = None


# ───────────────────────── Platform model config + live pricing (admin) ─────────

class PlatformConfigResponse(BaseModel):
    provider_base_url: str
    provider_model_id: str
    api_key_masked: str = ""
    api_key_set: bool = False
    platform_enabled: bool = True
    cost_per_chat: int
    cost_per_distill: int
    cost_per_snapshot: int
    updated_at: Optional[str] = None


class PlatformConfigUpdate(BaseModel):
    """All fields optional — only provided ones are updated. Empty api_key = no change."""
    provider_base_url: Optional[str] = None
    provider_model_id: Optional[str] = None
    provider_api_key: Optional[str] = None
    platform_enabled: Optional[bool] = None
    cost_per_chat: Optional[int] = None
    cost_per_distill: Optional[int] = None
    cost_per_snapshot: Optional[int] = None


# --- Redeem codes ---

class RedeemRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=64)


class RedeemResponse(BaseModel):
    code: str
    fragments: int
    balance: int
    redeemed_at: str


class AdminRedeemGenerateRequest(BaseModel):
    count: int = Field(1, ge=1, le=500)
    fragments: int = Field(..., ge=100, le=1000)
    note: Optional[str] = Field(None, max_length=200)


class AdminRedeemCodeResponse(BaseModel):
    id: str
    code: str
    fragments: int
    status: str
    batch_id: Optional[str] = None
    note: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    redeemed_by: Optional[str] = None
    redeemed_at: Optional[str] = None


class AdminRedeemGenerateResponse(BaseModel):
    batch_id: str
    count: int
    fragments: int
    codes: List[str]
    items: List[AdminRedeemCodeResponse]
