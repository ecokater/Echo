"""Stateless inference proxy router for the Local-first architecture.

Charges fragments, calls the model adapter, returns structured results, and
records privacy-safe audit metadata. It never persists persona/messages/memory
or request bodies.
"""
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import User
from deps import get_db, get_current_user
from repositories import usage_repo, platform_repo
from schemas import (
    InferenceChatRequest,
    InferenceChatResponse,
    InferenceDistillRequest,
    InferenceDistillResponse,
    InferenceMemorySummaryRequest,
    InferenceMemorySummaryResponse,
)
from services import inference_service, wallet_service
from services.wallet_service import InsufficientBalance

router = APIRouter(prefix="/api/inference", tags=["inference"])


def _charge(db: Session, user_id: str, cost: int, kind: str) -> int:
    try:
        wallet_service.consume(db, user_id, cost, kind)
        return cost
    except InsufficientBalance:
        raise HTTPException(status_code=402, detail="Insufficient fragments")


def _latency_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _model_meta(req) -> tuple[str | None, str | None]:
    model = getattr(req, "model", None)
    if not model:
        return None, None
    return getattr(model, "provider", None), getattr(model, "model_id", None)


def _record_usage(
    db: Session,
    *,
    user_id: str,
    event_type: str,
    endpoint: str,
    req,
    status: str,
    started: float,
    response=None,
    cost_fragments: int = 0,
    refunded_fragments: int = 0,
    error_code: str | None = None,
):
    provider, model_id = _model_meta(req)
    usage = getattr(response, "usage", None)
    try:
        usage_repo.create_usage_event(
            db,
            user_id=user_id,
            event_type=event_type,
            endpoint=endpoint,
            provider=provider,
            model_id=model_id,
            status=status,
            cost_fragments=cost_fragments,
            refunded_fragments=refunded_fragments,
            prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
            latency_ms=_latency_ms(started),
            error_code=error_code,
        )
    except Exception as audit_error:
        db.rollback()
        print(f"[audit] usage event failed: {audit_error}")


def _record_system(
    db: Session,
    *,
    user_id: str,
    event_type: str,
    level: str,
    message: str,
    error: Exception | None = None,
):
    metadata = {"error_class": error.__class__.__name__} if error else None
    try:
        usage_repo.create_system_event(
            db,
            user_id=user_id,
            source="inference",
            event_type=event_type,
            level=level,
            message=message,
            metadata=metadata,
        )
    except Exception as audit_error:
        db.rollback()
        print(f"[audit] system event failed: {audit_error}")


@router.post("/chat", response_model=InferenceChatResponse)
async def inference_chat(
    req: InferenceChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    started = time.perf_counter()
    endpoint = "/api/inference/chat"
    cfg = platform_repo.get_config(db)
    platform = platform_repo.as_resolver_dict(cfg)
    try:
        cost = _charge(db, user.id, cfg.cost_per_chat, "consume_chat")
    except HTTPException:
        _record_usage(
            db,
            user_id=user.id,
            event_type="inference_chat",
            endpoint=endpoint,
            req=req,
            status="insufficient_balance",
            started=started,
            error_code="insufficient_balance",
        )
        raise

    try:
        response = await inference_service.run_chat(req, cost_fragments=cost, platform=platform)
        _record_usage(
            db,
            user_id=user.id,
            event_type="inference_chat",
            endpoint=endpoint,
            req=req,
            status="success",
            started=started,
            response=response,
            cost_fragments=cost,
        )
        return response
    except ValueError as e:
        wallet_service.credit(db, user.id, cost, "refund_chat")
        _record_usage(
            db,
            user_id=user.id,
            event_type="inference_chat",
            endpoint=endpoint,
            req=req,
            status="client_error",
            started=started,
            cost_fragments=cost,
            refunded_fragments=cost,
            error_code=e.__class__.__name__,
        )
        _record_system(
            db,
            user_id=user.id,
            event_type="inference_chat_failed",
            level="warning",
            message="Inference chat rejected before model call",
            error=e,
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        wallet_service.credit(db, user.id, cost, "refund_chat")
        _record_usage(
            db,
            user_id=user.id,
            event_type="inference_chat",
            endpoint=endpoint,
            req=req,
            status="provider_error",
            started=started,
            cost_fragments=cost,
            refunded_fragments=cost,
            error_code=e.__class__.__name__,
        )
        _record_system(
            db,
            user_id=user.id,
            event_type="inference_chat_failed",
            level="error",
            message="Inference chat provider call failed",
            error=e,
        )
        raise HTTPException(status_code=502, detail=f"Model call failed: {e}")


@router.post("/distill", response_model=InferenceDistillResponse)
async def inference_distill(
    req: InferenceDistillRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    started = time.perf_counter()
    endpoint = "/api/inference/distill"
    cfg = platform_repo.get_config(db)
    platform = platform_repo.as_resolver_dict(cfg)
    has_platform = platform["enabled"] and bool(platform["api_key"])
    if not (req.model.api_key or has_platform or _has_global_key()):
        response = await inference_service.run_distill(req, cost_fragments=0, platform=platform)
        _record_usage(
            db,
            user_id=user.id,
            event_type="inference_distill",
            endpoint=endpoint,
            req=req,
            status="success",
            started=started,
            response=response,
            cost_fragments=0,
        )
        return response

    try:
        cost = _charge(db, user.id, cfg.cost_per_distill, "consume_distill")
    except HTTPException:
        _record_usage(
            db,
            user_id=user.id,
            event_type="inference_distill",
            endpoint=endpoint,
            req=req,
            status="insufficient_balance",
            started=started,
            error_code="insufficient_balance",
        )
        raise

    try:
        response = await inference_service.run_distill(req, cost_fragments=cost, platform=platform)
        _record_usage(
            db,
            user_id=user.id,
            event_type="inference_distill",
            endpoint=endpoint,
            req=req,
            status="success",
            started=started,
            response=response,
            cost_fragments=cost,
        )
        return response
    except Exception as e:
        wallet_service.credit(db, user.id, cost, "refund_distill")
        _record_usage(
            db,
            user_id=user.id,
            event_type="inference_distill",
            endpoint=endpoint,
            req=req,
            status="provider_error",
            started=started,
            cost_fragments=cost,
            refunded_fragments=cost,
            error_code=e.__class__.__name__,
        )
        _record_system(
            db,
            user_id=user.id,
            event_type="inference_distill_failed",
            level="error",
            message="Inference distill provider call failed",
            error=e,
        )
        raise HTTPException(status_code=502, detail=f"Distill failed: {e}")


@router.post("/memory-summary", response_model=InferenceMemorySummaryResponse)
async def inference_memory_summary(
    req: InferenceMemorySummaryRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    started = time.perf_counter()
    endpoint = "/api/inference/memory-summary"
    cfg = platform_repo.get_config(db)
    platform = platform_repo.as_resolver_dict(cfg)
    try:
        cost = _charge(db, user.id, cfg.cost_per_snapshot, "consume_snapshot")
    except HTTPException:
        _record_usage(
            db,
            user_id=user.id,
            event_type="memory_summary",
            endpoint=endpoint,
            req=req,
            status="insufficient_balance",
            started=started,
            error_code="insufficient_balance",
        )
        raise

    try:
        response = await inference_service.run_memory_summary(req, cost_fragments=cost, platform=platform)
        _record_usage(
            db,
            user_id=user.id,
            event_type="memory_summary",
            endpoint=endpoint,
            req=req,
            status="success",
            started=started,
            response=response,
            cost_fragments=cost,
        )
        return response
    except ValueError as e:
        wallet_service.credit(db, user.id, cost, "refund_snapshot")
        _record_usage(
            db,
            user_id=user.id,
            event_type="memory_summary",
            endpoint=endpoint,
            req=req,
            status="client_error",
            started=started,
            cost_fragments=cost,
            refunded_fragments=cost,
            error_code=e.__class__.__name__,
        )
        _record_system(
            db,
            user_id=user.id,
            event_type="memory_summary_failed",
            level="warning",
            message="Memory summary rejected before model call",
            error=e,
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        wallet_service.credit(db, user.id, cost, "refund_snapshot")
        _record_usage(
            db,
            user_id=user.id,
            event_type="memory_summary",
            endpoint=endpoint,
            req=req,
            status="provider_error",
            started=started,
            cost_fragments=cost,
            refunded_fragments=cost,
            error_code=e.__class__.__name__,
        )
        _record_system(
            db,
            user_id=user.id,
            event_type="memory_summary_failed",
            level="error",
            message="Memory summary provider call failed",
            error=e,
        )
        raise HTTPException(status_code=502, detail=f"Memory summary failed: {e}")


def _has_global_key() -> bool:
    import state

    return bool(state.system_stats.get("global_api_key"))
