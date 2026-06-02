from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import config
from schemas import ChatRequest
from deps import get_db, get_optional_user
from repositories.message_repo import get_chat_history
from repositories.persona_repo import get_persona
from services.chat_service import handle_chat_internal
from services import wallet_service
from services.wallet_service import InsufficientBalance

router = APIRouter(prefix="/api", tags=["legacy-chat"], deprecated=True)


def _assert_owner_if_authed(db: Session, persona_id: str, user):
    """Authenticated clients may only access their own personas (tenant isolation).
    Unauthenticated (legacy) clients pass through unchanged."""
    if user is not None and not get_persona(db, persona_id, owner_id=user.id):
        raise HTTPException(status_code=404, detail="Persona not found")


@router.get("/chat/{persona_id}")
def get_chat(persona_id: str, db: Session = Depends(get_db), user=Depends(get_optional_user)):
    _assert_owner_if_authed(db, persona_id, user)
    try:
        return get_chat_history(db, persona_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"获取聊天记录失败: {e}")
        return []


@router.post("/chat/{persona_id}")
async def chat_with_persona(
    persona_id: str,
    req: ChatRequest,
    db: Session = Depends(get_db),
    user=Depends(get_optional_user),
):
    _assert_owner_if_authed(db, persona_id, user)
    # Authenticated clients consume fragments; legacy unauthenticated clients pass through.
    if user is not None:
        try:
            wallet_service.consume(db, user.id, config.COST_PER_CHAT, "consume_chat", ref_id=persona_id)
        except InsufficientBalance:
            raise HTTPException(status_code=402, detail="记忆碎片不足，请补充后继续对话")
    return await handle_chat_internal(persona_id, req, db)
