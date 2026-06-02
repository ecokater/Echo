from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from database import SessionLocal
from services.auth_service import decode_token
from repositories.persona_repo import get_persona
from ws_manager import manager

router = APIRouter(tags=["websocket"])


def _authorize(token: str | None, persona_id: str) -> bool:
    """WS handshake auth: valid access token whose user owns the persona."""
    if not token:
        return False
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return False
        user_id = payload.get("sub")
    except Exception:
        return False
    db = SessionLocal()
    try:
        return get_persona(db, persona_id, owner_id=user_id) is not None
    finally:
        db.close()


@router.websocket("/ws/{persona_id}")
async def websocket_endpoint(websocket: WebSocket, persona_id: str, token: str | None = Query(default=None)):
    if not _authorize(token, persona_id):
        await websocket.close(code=4401)  # unauthorized
        return
    await manager.connect(websocket, persona_id)
    try:
        while True:
            await websocket.receive_text()  # keepalive pings
    except WebSocketDisconnect:
        manager.disconnect(websocket, persona_id)
