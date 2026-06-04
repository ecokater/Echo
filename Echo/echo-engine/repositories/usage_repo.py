import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from database import SystemEvent, UsageEvent


def create_usage_event(
    db: Session,
    *,
    user_id: str,
    event_type: str,
    endpoint: str,
    provider: str | None = None,
    model_id: str | None = None,
    status: str,
    cost_fragments: int = 0,
    refunded_fragments: int = 0,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: int = 0,
    error_code: str | None = None,
) -> UsageEvent:
    event = UsageEvent(
        user_id=user_id,
        event_type=event_type,
        endpoint=endpoint,
        provider=provider,
        model_id=model_id,
        status=status,
        cost_fragments=cost_fragments,
        refunded_fragments=refunded_fragments,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        latency_ms=latency_ms,
        error_code=error_code,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def create_system_event(
    db: Session,
    *,
    source: str,
    event_type: str,
    message: str,
    level: str = "info",
    user_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> SystemEvent:
    event = SystemEvent(
        user_id=user_id,
        level=level,
        source=source,
        event_type=event_type,
        message=message,
        metadata_json=json.dumps(metadata or {}, ensure_ascii=False),
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_usage_events(db: Session, user_id: str, limit: int = 50) -> list[UsageEvent]:
    return (
        db.query(UsageEvent)
        .filter(UsageEvent.user_id == user_id)
        .order_by(UsageEvent.created_at.desc())
        .limit(max(1, min(200, limit)))
        .all()
    )


def list_system_events(db: Session, user_id: str, limit: int = 50) -> list[SystemEvent]:
    return (
        db.query(SystemEvent)
        .filter(SystemEvent.user_id == user_id)
        .order_by(SystemEvent.created_at.desc())
        .limit(max(1, min(200, limit)))
        .all()
    )


def serialize_usage_event(event: UsageEvent) -> dict:
    return {
        "id": event.id,
        "user_id": event.user_id,
        "event_type": event.event_type,
        "endpoint": event.endpoint,
        "provider": event.provider,
        "model_id": event.model_id,
        "status": event.status,
        "cost_fragments": event.cost_fragments,
        "refunded_fragments": event.refunded_fragments,
        "prompt_tokens": event.prompt_tokens,
        "completion_tokens": event.completion_tokens,
        "latency_ms": event.latency_ms,
        "error_code": event.error_code,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


def serialize_system_event(event: SystemEvent) -> dict:
    try:
        metadata = json.loads(event.metadata_json or "{}")
    except Exception:
        metadata = {}
    return {
        "id": event.id,
        "user_id": event.user_id,
        "level": event.level,
        "source": event.source,
        "event_type": event.event_type,
        "message": event.message,
        "metadata": metadata,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }
