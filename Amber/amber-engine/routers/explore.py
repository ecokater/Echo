"""Explore marketplace: publish / browse / install shared persona templates.

Privacy: only the persona card the user explicitly publishes is stored server
-side. Chat history and private memory corpus never leave the device.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import User
from deps import get_db, get_current_user, get_optional_user
from repositories import explore_repo
from schemas import SharePublishRequest, SharedPersonaCard, SharedPersonaDetail

router = APIRouter(prefix="/api/explore", tags=["explore"])


@router.post("/publish", response_model=SharedPersonaDetail)
def publish_persona(
    req: SharePublishRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="分身名称不能为空")
    row = explore_repo.publish(
        db, owner_id=user.id, owner_nickname=user.nickname, data=req.model_dump()
    )
    return explore_repo.serialize_detail(row)


@router.get("/list", response_model=list[SharedPersonaCard])
def list_personas(
    q: str | None = None,
    sort: str = "hot",  # hot|new
    limit: int = 30,
    offset: int = 0,
    _: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    rows = explore_repo.list_public(db, q=q, sort=sort, limit=limit, offset=offset)
    return [explore_repo.serialize_card(r) for r in rows]


@router.get("/mine", response_model=list[SharedPersonaCard])
def list_my_personas(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = explore_repo.list_mine(db, user.id)
    return [explore_repo.serialize_card(r) for r in rows]


@router.get("/{share_id}", response_model=SharedPersonaDetail)
def get_persona(
    share_id: str,
    _: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    row = explore_repo.get(db, share_id)
    if not row:
        raise HTTPException(status_code=404, detail="分享不存在或已下架")
    return explore_repo.serialize_detail(row)


@router.post("/{share_id}/install", response_model=SharedPersonaDetail)
def install_persona(
    share_id: str,
    _: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Return the full template for local import and bump the install counter.

    The client recreates the persona in its local IndexedDB — the server keeps
    no per-user copy.
    """
    row = explore_repo.get(db, share_id)
    if not row:
        raise HTTPException(status_code=404, detail="分享不存在或已下架")
    explore_repo.increment_install(db, row)
    return explore_repo.serialize_detail(row)


@router.delete("/{share_id}")
def unpublish_persona(
    share_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = explore_repo.get_owned(db, share_id, user.id)
    if not row:
        raise HTTPException(status_code=404, detail="分享不存在或无权限")
    explore_repo.unpublish(db, row)
    return {"status": "removed", "id": share_id}
