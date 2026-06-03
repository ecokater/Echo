"""Platform model config + live pricing (singleton row id=1).

Seeded from config.py / env on first access; afterwards the DB row is the source
of truth so admins can change the model and fragment prices at runtime.
"""
from datetime import datetime

from sqlalchemy.orm import Session

import config
from database import PlatformConfig

_SINGLETON_ID = 1


def get_config(db: Session) -> PlatformConfig:
    cfg = db.query(PlatformConfig).filter(PlatformConfig.id == _SINGLETON_ID).first()
    if cfg is None:
        cfg = PlatformConfig(
            id=_SINGLETON_ID,
            provider_base_url=config.PLATFORM_BASE_URL,
            provider_model_id=config.PLATFORM_MODEL_ID,
            provider_api_key=config.PLATFORM_API_KEY or None,
            platform_enabled=True,
            cost_per_chat=config.COST_PER_CHAT,
            cost_per_distill=config.COST_PER_DISTILL,
            cost_per_snapshot=config.COST_PER_SNAPSHOT,
            updated_at=datetime.utcnow(),
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def update_config(db: Session, **fields) -> PlatformConfig:
    cfg = get_config(db)
    # Only update provided (non-None) fields; empty api_key is treated as "no change"
    for key, value in fields.items():
        if value is None:
            continue
        if key == "provider_api_key" and value == "":
            continue
        if hasattr(cfg, key):
            setattr(cfg, key, value)
    cfg.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cfg)
    return cfg


def _mask(api_key: str | None) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}****{api_key[-4:]}"


def serialize(cfg: PlatformConfig) -> dict:
    """Public/admin view — api_key is always masked."""
    return {
        "provider_base_url": cfg.provider_base_url,
        "provider_model_id": cfg.provider_model_id,
        "api_key_masked": _mask(cfg.provider_api_key),
        "api_key_set": bool(cfg.provider_api_key),
        "platform_enabled": bool(cfg.platform_enabled),
        "cost_per_chat": cfg.cost_per_chat,
        "cost_per_distill": cfg.cost_per_distill,
        "cost_per_snapshot": cfg.cost_per_snapshot,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


def as_resolver_dict(cfg: PlatformConfig) -> dict:
    """Internal view for the inference adapter (includes the real key)."""
    return {
        "enabled": bool(cfg.platform_enabled),
        "api_key": cfg.provider_api_key,
        "base_url": cfg.provider_base_url,
        "model_id": cfg.provider_model_id,
    }
