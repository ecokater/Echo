import json
import re
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import Persona, PersonaCorpus, User
from deps import get_db, get_current_user
from schemas import PersonaBase, PersonaCreate, PersonaResponse, RedistillRequest, CommitUpdateRequest, PersonaIdRequest
from repositories.persona_repo import list_personas, get_persona, serialize_persona
from repositories.message_repo import clear_history
from services.chat_service import call_llm_with_retry

router = APIRouter(prefix="/api", tags=["legacy-personas"], deprecated=True)


def _owned(db: Session, persona_id: str, user: User) -> Persona:
    """Fetch a persona that must belong to the current user, else 404."""
    p = get_persona(db, persona_id, owner_id=user.id)
    if not p:
        raise HTTPException(status_code=404, detail="Persona not found")
    return p


@router.get("/personas", response_model=List[PersonaResponse])
def get_personas(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list_personas(db, owner_id=user.id)


@router.post("/personas", response_model=PersonaResponse)
def create_persona(persona: PersonaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    persona_id = persona.id or str(uuid.uuid4())
    db_p = Persona(
        id=persona_id,
        user_id=user.id,
        name=persona.name,
        gender=persona.gender,
        relationship_desc=persona.relationship_desc,
        impression=persona.impression,
        avatar=persona.avatar,
        token=persona.token,
        core_memory=persona.core_memory,
        traits=json.dumps(persona.traits, ensure_ascii=False),
        catchphrases=json.dumps(persona.catchphrases, ensure_ascii=False),
        stability=persona.stability,
        synchronization=persona.synchronization,
    )
    db.add(db_p)
    db.commit()

    if persona.raw_corpus:
        chunks, current = [], ""
        for line in persona.raw_corpus.split("\n"):
            line = line.strip()
            if not line:
                continue
            if len(current) + len(line) > 500:
                chunks.append(current)
                current = line + "\n"
            else:
                current += line + "\n"
        if current:
            chunks.append(current)
        for chunk in chunks:
            if chunk.strip():
                db.add(PersonaCorpus(persona_id=persona_id, content=chunk.strip(), weight=1.0, is_pinned=True))
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"写入初始语料失败: {e}")

    db.refresh(db_p)
    return serialize_persona(db_p)


@router.put("/personas/{persona_id}", response_model=PersonaResponse)
def update_persona(persona_id: str, data: PersonaBase, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _owned(db, persona_id, user)
    for field in ("name", "gender", "relationship_desc", "impression", "avatar", "token", "core_memory",
                  "stability", "synchronization"):
        setattr(p, field, getattr(data, field))
    p.traits = json.dumps(data.traits, ensure_ascii=False)
    p.catchphrases = json.dumps(data.catchphrases, ensure_ascii=False)
    db.commit()
    db.refresh(p)
    return serialize_persona(p)


@router.delete("/personas/{persona_id}")
async def delete_persona(persona_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _owned(db, persona_id, user)
    db.delete(p)
    db.commit()
    return {"message": "Deleted successfully"}


@router.post("/persona/clear-history")
async def clear_chat_history(req: PersonaIdRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned(db, req.persona_id, user)
    try:
        msgs, corpus = clear_history(db, req.persona_id)
        return {"status": "success", "deleted_messages": msgs, "deleted_memory": corpus}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persona/redistill")
async def redistill_persona(req: RedistillRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = get_persona(db, req.persona_id, owner_id=user.id)
    current_traits = ""
    if p and p.traits:
        try:
            tl = json.loads(p.traits)
            current_traits = tl[0] if tl else ""
        except Exception:
            current_traits = str(p.traits)

    prefix_match = re.search(r"(\[核心特质\].*?\[情绪阈值\]:)", current_traits)
    prefix = prefix_match.group(1) if prefix_match else "[核心特质]: [情绪阈值]:"
    anger = req.traits_map.get("anger", 50)
    humor = req.traits_map.get("humor", 50)
    empathy = req.traits_map.get("empathy", 50)
    new_trait = f"{prefix} 易怒({anger}%) 幽默({humor}%) 共情({empathy}%)"

    if not req.api_key:
        return {"core_memory": req.core_memory, "stability": 85, "synchronization": 90, "refined_traits": [new_trait]}

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=req.api_key, base_url=req.base_url)
        system_prompt = f"""你现在是数字生命意识流的最高压缩结晶器。你正在为名为【{req.name}】的分身进行人格初始蒸馏。
【文风刚性约束】：第一人称，工业极客美学，200-300字。
【原核心记忆】：{req.core_memory}
【期望性格阈值】：易怒度:{anger}%, 幽默度:{humor}%, 共情度:{empathy}%
请严格返回 JSON 格式：{{"core_memory": "...", "stability": 0-100, "synchronization": 0-100}}"""
        response = await call_llm_with_retry(
            client=client, model=req.model_id or "gpt-4o-mini",
            messages=[{"role": "system", "content": system_prompt}],
            temperature=0.7, response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content.strip())

        def normalize(v, fallback):
            try:
                v = float(v)
                return int(v * 100) if 0 < v <= 1 else int(max(0, min(100, v)))
            except Exception:
                return fallback

        result["stability"] = normalize(result.get("stability"), 85)
        result["synchronization"] = normalize(result.get("synchronization"), 90)
        result["refined_traits"] = [new_trait]
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persona/commit-update")
def commit_persona_update(req: CommitUpdateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _owned(db, req.persona_id, user)
    p.name = req.name
    if req.avatar is not None:
        p.avatar = req.avatar
    p.core_memory = req.core_memory
    if req.stability is not None:
        p.stability = req.stability
    if req.synchronization is not None:
        p.synchronization = req.synchronization
    db.add(PersonaCorpus(persona_id=req.persona_id, content="【修改人格】：信息已更新。", weight=1.0, is_pinned=True))
    deleted = db.query(PersonaCorpus).filter(PersonaCorpus.persona_id == req.persona_id, PersonaCorpus.is_pinned == False).delete()
    print(f"【灵魂洗涤完成】已清空 {req.name} 的 {deleted} 条陈旧记忆。")
    db.commit()
    db.refresh(p)
    return {"status": "success", "persona": {"id": p.id, "name": p.name, "avatar": p.avatar, "core_memory": p.core_memory, "traits": json.loads(p.traits) if p.traits else [], "stability": p.stability, "synchronization": p.synchronization}}
