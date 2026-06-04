from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import User
from deps import get_db, get_current_user
from schemas import ChargeRequest, TogglePinRequest
from repositories.message_repo import get_corpus, get_corpus_entry, charge_corpus, toggle_pin_corpus, erase_corpus
from repositories.persona_repo import get_persona

router = APIRouter(prefix="/api/system/memory", tags=["legacy-memory"], deprecated=True)


def _assert_persona_owner(db: Session, persona_id: str, user: User):
    if not get_persona(db, persona_id, owner_id=user.id):
        raise HTTPException(status_code=404, detail="Persona not found")


def _assert_corpus_owner(db: Session, corpus_id: int, user: User):
    entry = get_corpus_entry(db, corpus_id)
    if not entry or not get_persona(db, entry.persona_id, owner_id=user.id):
        raise HTTPException(status_code=404, detail="Corpus not found")
    return entry


@router.get("/{persona_id}")
def get_memory(persona_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _assert_persona_owner(db, persona_id, user)
    return get_corpus(db, persona_id)


@router.post("/charge")
def charge_memory(req: ChargeRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _assert_corpus_owner(db, req.corpus_id, user)
    result = charge_corpus(db, req.corpus_id)
    if not result:
        raise HTTPException(status_code=404, detail="Corpus not found")
    return result


@router.post("/toggle-pin")
def toggle_pin(req: TogglePinRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _assert_corpus_owner(db, req.corpus_id, user)
    result = toggle_pin_corpus(db, req.corpus_id)
    if not result:
        raise HTTPException(status_code=404, detail="Corpus not found")
    return result


@router.delete("/erase/{corpus_id}")
def erase_memory(corpus_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _assert_corpus_owner(db, corpus_id, user)
    if not erase_corpus(db, corpus_id):
        raise HTTPException(status_code=404, detail="Corpus not found")
    return {"status": "success"}
