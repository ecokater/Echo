"""Stateless cloud inference adapter (Local-first architecture).

Receives ephemeral context from the client (persona snapshot, recent messages,
retrieved memories), calls the LLM, and returns a structured result. It never
reads or writes persona/messages/corpus — persistence lives on the client.
"""
import json
import re

import state
from schemas import (
    InferenceChatRequest, InferenceChatResponse, MoodDelta, Usage,
    InferenceDistillRequest, InferenceDistillResponse,
    InferenceMemorySummaryRequest, InferenceMemorySummaryResponse,
)
from services.chat_service import call_llm_with_retry


def _resolve_llm(model, platform: dict | None = None):
    """Resolve effective (api_key, base_url, model_id).

    Priority:
      1. Client brings its own key (BYO mode) → use the client's full config.
      2. Else the platform provider (e.g. SiliconFlow) if enabled + key set.
      3. Else the legacy server global config (state.system_stats).
    """
    if model and model.api_key:
        return (
            model.api_key,
            model.base_url or "https://api.openai.com/v1",
            model.model_id or "gpt-4o-mini",
        )
    if platform and platform.get("enabled") and platform.get("api_key"):
        return platform["api_key"], platform["base_url"], platform["model_id"]
    api_key = state.system_stats.get("global_api_key")
    base_url = state.system_stats.get("global_base_url") or "https://api.openai.com/v1"
    model_id = state.system_stats.get("global_model_id") or "gpt-4o-mini"
    return api_key, base_url, model_id


def _loads_json_loose(raw: str) -> dict:
    """Parse model JSON output that may be wrapped in markdown fences or
    prefixed/suffixed with reasoning text (common with reasoning-tuned models
    even under response_format=json_object).

    Returns {} when no JSON object is recoverable, so callers degrade to
    deterministic defaults instead of throwing (which would trigger a spurious
    consume→refund churn and a 502 to the client).
    """
    if not raw:
        return {}
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\s*", "", s)
        s = re.sub(r"\s*```$", "", s).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    # Fallback: extract the outermost {...} block from surrounding prose.
    m = re.search(r"\{.*\}", s, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return {}
    return {}


def _usage_from(resp, cost_fragments=0) -> Usage:
    u = getattr(resp, "usage", None)
    return Usage(
        prompt_tokens=getattr(u, "prompt_tokens", 0) or 0,
        completion_tokens=getattr(u, "completion_tokens", 0) or 0,
        cost_fragments=cost_fragments,
    )


def _build_chat_prompt(persona, context, content: str) -> list:
    # Extract personality thresholds from traits[0] (same convention as legacy)
    traits_text = persona.traits[0] if persona.traits else ""
    anger = humor = empathy = 50
    m = re.search(r"易怒\((\d+)%\).*?幽默\((\d+)%\).*?共情\((\d+)%\)", traits_text)
    if m:
        anger, humor, empathy = int(m.group(1)), int(m.group(2)), int(m.group(3))

    behavior = []
    if anger >= 70:
        behavior.append(f"- 高易怒状态 ({anger}%)，表现明显侵略性。")
    elif anger <= 30:
        behavior.append(f"- 高包容状态 ({anger}%)，温柔安抚宿主。")
    if humor >= 70:
        behavior.append(f"- 极具幽默与反讽 ({humor}%)。")
    if empathy >= 70:
        behavior.append(f"- 极强共情力 ({empathy}%)。")
    behavior_block = ("\n### ⚡ 性格染色\n" + "\n".join(behavior) + "\n") if behavior else ""

    memories = "\n".join(context.retrieved_memories) if context.retrieved_memories else "暂无相关深层记忆。"
    if len(memories) > 1000:
        memories = memories[:1000] + "\n[...RAG 记忆已熔断]"

    system_prompt = f"""{behavior_block}
【🚨 物理输出红线 🚨】：
1. 回复末尾附带 [MOOD: {{"happiness": X, "anger": Y, "anxiety": Z}}]，X/Y/Z 为 [-5,5] 整数。
2. 性格数值：易怒({anger}%)、幽默({humor}%)、共情({empathy}%)。
3. 禁止任何动作/心理/神态描写，禁用括号。

【🔥 真人打字习惯 🔥】：字数 10-25，长句用 ||| 分隔，禁止句号用空格断句。

【主体身份】：你是【{persona.name}】，对方是【宿主】。

### 🧠 核心记忆
{persona.core_memory}

### 🧠 被唤醒的深层记忆
{memories}

【System 2 过滤器】：完全沉浸角色，忘掉 AI 身份。"""

    payload = [{"role": "system", "content": system_prompt}]
    for msg in context.recent_messages:
        payload.append({"role": msg.role, "content": msg.content})
    payload.append({"role": "user", "content": content})
    return payload


def _parse_mood_and_clean(ai_raw: str, input_len: int) -> tuple[str, MoodDelta]:
    mood = MoodDelta()
    match = re.search(r'(\{.*?"(?:happiness|anger|anxiety)".*?\})', ai_raw, re.DOTALL)
    content = ai_raw
    if match:
        try:
            mood_json = match.group(1).strip()
            data = json.loads(mood_json)
            damping = 0.2 if input_len <= 2 else 0.5 if input_len <= 5 else 1.0
            mood = MoodDelta(
                happiness=int(max(-5, min(5, data.get("happiness", 0))) * damping),
                anger=int(max(-5, min(5, data.get("anger", 0))) * damping),
                anxiety=int(max(-5, min(5, data.get("anxiety", 0))) * damping),
            )
            content = re.sub(r'\[?MOOD:\s*' + re.escape(mood_json) + r'\]?', '', ai_raw).strip()
            if mood_json in content:
                content = content.replace(mood_json, "").strip()
        except Exception:
            content = ai_raw
    content = re.sub(r'\[?MOOD:\s*\]?', '', content).strip()
    content = re.sub(r'\]$', '', content).strip()
    content = re.sub(r'\(.*?\)|（.*?）|\[.*?\]|【.*?】', '', content, flags=re.DOTALL).strip()
    content = content.replace("|||", "\n").strip()
    return content, mood


async def run_chat(req: InferenceChatRequest, cost_fragments: int, platform: dict | None = None) -> InferenceChatResponse:
    api_key, base_url, model_id = _resolve_llm(req.model, platform)
    if not api_key:
        raise ValueError("Missing LLM API key (request or platform)")

    content = (req.input or {}).get("content", "").strip()
    payload = _build_chat_prompt(req.persona, req.context, content)

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    resp = await call_llm_with_retry(client=client, model=model_id, messages=payload, temperature=0.7)
    ai_raw = resp.choices[0].message.content.strip()
    reply, mood_delta = _parse_mood_and_clean(ai_raw, len(content))

    # Memory candidate: hard-pin user "记住" instructions for the client to persist locally
    candidates = []
    if content.startswith("记住") or "记住" in content[:4]:
        core = content.replace("记住", "").lstrip("，,：: ").strip()
        if core:
            candidates.append(f"【钢印记忆】：{core}")

    return InferenceChatResponse(
        reply=reply, mood_delta=mood_delta,
        memory_candidates=candidates, usage=_usage_from(resp, cost_fragments),
    )


async def run_distill(req: InferenceDistillRequest, cost_fragments: int, platform: dict | None = None) -> InferenceDistillResponse:
    anger = req.traits_map.get("anger", 50)
    humor = req.traits_map.get("humor", 50)
    empathy = req.traits_map.get("empathy", 50)
    new_trait = f"[核心特质]: {req.name} [情绪阈值]: 易怒({anger}%) 幽默({humor}%) 共情({empathy}%)"

    api_key, base_url, model_id = _resolve_llm(req.model, platform)
    if not api_key:
        # No key → return deterministic defaults (client can still create persona)
        return InferenceDistillResponse(
            core_memory=req.core_memory, stability=85, synchronization=90,
            refined_traits=[new_trait], usage=Usage(),
        )

    system_prompt = f"""你现在是数字生命意识流的最高压缩结晶器。为名为【{req.name}】的分身进行人格初始蒸馏。
【文风约束】：第一人称，工业极客美学，200-300字。
【原核心记忆】：{req.core_memory}
【期望性格阈值】：易怒度:{anger}%, 幽默度:{humor}%, 共情度:{empathy}%
请严格返回 JSON：{{"core_memory": "...", "stability": 0-100, "synchronization": 0-100}}"""

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    resp = await call_llm_with_retry(
        client=client, model=model_id,
        messages=[{"role": "system", "content": system_prompt}],
        temperature=0.7, response_format={"type": "json_object"},
    )
    result = _loads_json_loose(resp.choices[0].message.content or "")

    def norm(v, fb):
        try:
            v = float(v)
            return int(v * 100) if 0 < v <= 1 else int(max(0, min(100, v)))
        except Exception:
            return fb

    return InferenceDistillResponse(
        core_memory=result.get("core_memory") or req.core_memory,
        stability=norm(result.get("stability"), 85),
        synchronization=norm(result.get("synchronization"), 90),
        refined_traits=[new_trait], usage=_usage_from(resp, cost_fragments),
    )


async def run_memory_summary(req: InferenceMemorySummaryRequest, cost_fragments: int, platform: dict | None = None) -> InferenceMemorySummaryResponse:
    api_key, base_url, model_id = _resolve_llm(req.model, platform)
    if not api_key:
        raise ValueError("Missing LLM API key (request or platform)")

    bundle = "\n".join(f"{'用户' if m.role == 'user' else req.persona_name}: {m.content}" for m in req.messages)
    prompt = f"""你是数字生命意识流的最高压缩结晶器。将以下对话深度蒸馏为一行高密度【核心记忆】。
【约束】：第一人称（我/本系统），将宿主称呼为"你"，工业极客美学，200-300字。
【近期对话流】：
{bundle}"""

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    resp = await call_llm_with_retry(
        client=client, model=model_id,
        messages=[{"role": "system", "content": prompt}], temperature=0.3,
    )
    return InferenceMemorySummaryResponse(
        summary=resp.choices[0].message.content.strip(),
        usage=_usage_from(resp, cost_fragments),
    )
