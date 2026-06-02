"""Explore marketplace: opt-in shared persona templates.

Stores only the publishable persona card (traits / core memory / avatar). Chat
history and private memory corpus are never written here — they remain local on
the owner's device per the Local-first architecture.
"""
from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import SharedPersona


_PUBLISH_FIELDS = (
    "name", "gender", "relationship_desc", "impression",
    "avatar", "core_memory", "traits", "catchphrases", "tags",
)


def publish(db: Session, *, owner_id: str, owner_nickname: str | None, data: dict) -> SharedPersona:
    row = SharedPersona(
        owner_id=owner_id,
        owner_nickname=owner_nickname,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **{k: data.get(k) for k in _PUBLISH_FIELDS},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get(db: Session, share_id: str) -> SharedPersona | None:
    return (
        db.query(SharedPersona)
        .filter(SharedPersona.id == share_id, SharedPersona.status == "public")
        .first()
    )


def get_owned(db: Session, share_id: str, owner_id: str) -> SharedPersona | None:
    return (
        db.query(SharedPersona)
        .filter(SharedPersona.id == share_id, SharedPersona.owner_id == owner_id)
        .first()
    )


def list_public(db: Session, *, q: str | None = None, sort: str = "hot",
                limit: int = 30, offset: int = 0) -> list[SharedPersona]:
    query = db.query(SharedPersona).filter(SharedPersona.status == "public")
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(
            SharedPersona.name.ilike(like),
            SharedPersona.impression.ilike(like),
            SharedPersona.tags.ilike(like),
        ))
    if sort == "new":
        query = query.order_by(SharedPersona.created_at.desc())
    else:  # hot
        query = query.order_by(SharedPersona.install_count.desc(), SharedPersona.created_at.desc())
    return query.offset(max(0, offset)).limit(max(1, min(100, limit))).all()


def list_mine(db: Session, owner_id: str, limit: int = 50) -> list[SharedPersona]:
    return (
        db.query(SharedPersona)
        .filter(SharedPersona.owner_id == owner_id)
        .order_by(SharedPersona.created_at.desc())
        .limit(max(1, min(200, limit)))
        .all()
    )


def increment_install(db: Session, row: SharedPersona) -> SharedPersona:
    row.install_count = (row.install_count or 0) + 1
    db.commit()
    db.refresh(row)
    return row


def unpublish(db: Session, row: SharedPersona) -> None:
    row.status = "removed"
    db.commit()


def serialize_card(row: SharedPersona) -> dict:
    return {
        "id": row.id,
        "owner_id": row.owner_id,
        "owner_nickname": row.owner_nickname,
        "name": row.name,
        "gender": row.gender,
        "relationship_desc": row.relationship_desc,
        "impression": row.impression,
        "avatar": row.avatar,
        "tags": row.tags,
        "install_count": row.install_count or 0,
        "like_count": row.like_count or 0,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def serialize_detail(row: SharedPersona) -> dict:
    data = serialize_card(row)
    data.update({
        "core_memory": row.core_memory,
        "traits": row.traits,
        "catchphrases": row.catchphrases,
    })
    return data
