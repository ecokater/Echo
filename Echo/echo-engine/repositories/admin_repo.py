"""Admin dashboard aggregations — read-only metrics across all tenants.

Operates on commercial + audit tables only (users / wallet / orders / usage /
shared personas). Never touches local-first chat content (it isn't stored
server-side anyway).
"""
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from database import (
    User, FragmentAccount, FragmentLedger, Order,
    UsageEvent, SharedPersona,
)


def overview(db: Session) -> dict:
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)

    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0
    new_users_24h = db.query(func.count(User.id)).filter(User.created_at >= day_ago).scalar() or 0

    total_recharged = db.query(func.coalesce(func.sum(FragmentAccount.total_recharged), 0)).scalar() or 0
    total_consumed = db.query(func.coalesce(func.sum(FragmentAccount.total_consumed), 0)).scalar() or 0
    balance_outstanding = db.query(func.coalesce(func.sum(FragmentAccount.balance), 0)).scalar() or 0

    paid_orders = db.query(func.count(Order.id)).filter(Order.status == "paid").scalar() or 0
    revenue_cents = db.query(func.coalesce(func.sum(Order.amount_cny), 0)).filter(Order.status == "paid").scalar() or 0

    # usage by status
    usage_rows = (
        db.query(UsageEvent.status, func.count(UsageEvent.id))
        .group_by(UsageEvent.status)
        .all()
    )
    usage_by_status = {status: count for status, count in usage_rows}
    usage_24h = db.query(func.count(UsageEvent.id)).filter(UsageEvent.created_at >= day_ago).scalar() or 0
    consumed_24h = (
        db.query(func.coalesce(func.sum(UsageEvent.cost_fragments), 0))
        .filter(UsageEvent.created_at >= day_ago).scalar() or 0
    )
    refunded_total = db.query(func.coalesce(func.sum(UsageEvent.refunded_fragments), 0)).scalar() or 0

    shares_public = db.query(func.count(SharedPersona.id)).filter(SharedPersona.status == "public").scalar() or 0
    shares_removed = db.query(func.count(SharedPersona.id)).filter(SharedPersona.status == "removed").scalar() or 0
    installs_total = db.query(func.coalesce(func.sum(SharedPersona.install_count), 0)).scalar() or 0

    return {
        "generated_at": now.isoformat(),
        "users": {"total": total_users, "active": active_users, "new_24h": new_users_24h},
        "fragments": {
            "total_recharged": int(total_recharged),
            "total_consumed": int(total_consumed),
            "balance_outstanding": int(balance_outstanding),
            "consumed_24h": int(consumed_24h),
            "refunded_total": int(refunded_total),
        },
        "revenue": {"paid_orders": paid_orders, "revenue_cny": round(revenue_cents / 100, 2)},
        "usage": {"by_status": usage_by_status, "events_24h": usage_24h},
        "shares": {"public": shares_public, "removed": shares_removed, "installs_total": int(installs_total)},
    }


def list_usage(db: Session, limit: int = 100, status: str | None = None) -> list[UsageEvent]:
    q = db.query(UsageEvent)
    if status:
        q = q.filter(UsageEvent.status == status)
    return q.order_by(UsageEvent.created_at.desc()).limit(max(1, min(500, limit))).all()


def list_ledger(db: Session, limit: int = 100) -> list[FragmentLedger]:
    return db.query(FragmentLedger).order_by(FragmentLedger.created_at.desc()).limit(max(1, min(500, limit))).all()


def list_orders(db: Session, limit: int = 100, status: str | None = None) -> list[Order]:
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    return q.order_by(Order.created_at.desc()).limit(max(1, min(500, limit))).all()


def list_shares(db: Session, limit: int = 100, status: str | None = None) -> list[SharedPersona]:
    q = db.query(SharedPersona)
    if status:
        q = q.filter(SharedPersona.status == status)
    return q.order_by(SharedPersona.created_at.desc()).limit(max(1, min(500, limit))).all()


# ---- serializers ----

def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def serialize_ledger(row: FragmentLedger) -> dict:
    return {
        "id": row.id, "user_id": row.user_id, "delta": row.delta, "type": row.type,
        "ref_id": row.ref_id, "balance_after": row.balance_after, "created_at": _iso(row.created_at),
    }


def serialize_order(row: Order) -> dict:
    return {
        "id": row.id, "user_id": row.user_id, "sku": row.sku, "amount_cny": row.amount_cny,
        "fragments": row.fragments, "channel": row.channel, "status": row.status,
        "out_trade_no": row.out_trade_no, "created_at": _iso(row.created_at), "paid_at": _iso(row.paid_at),
    }


def serialize_share(row: SharedPersona) -> dict:
    return {
        "id": row.id, "owner_id": row.owner_id, "owner_nickname": row.owner_nickname,
        "name": row.name, "impression": row.impression, "tags": row.tags,
        "install_count": row.install_count or 0, "status": row.status, "created_at": _iso(row.created_at),
    }
