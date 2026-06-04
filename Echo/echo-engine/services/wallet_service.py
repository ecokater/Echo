"""Fragment wallet: atomic balance mutations with full ledger audit.

Atomic decrement uses a conditional UPDATE (balance >= cost) which is safe on
both SQLite (serialized writes) and PostgreSQL. The ledger row is written in the
same transaction. For high-concurrency Postgres deployments add a Redis lock or
SELECT ... FOR UPDATE; the conditional UPDATE already prevents oversell.
"""
from datetime import datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from database import FragmentAccount, FragmentLedger


class InsufficientBalance(Exception):
    pass


def ensure_account(db: Session, user_id: str) -> FragmentAccount:
    acc = db.query(FragmentAccount).filter(FragmentAccount.user_id == user_id).first()
    if not acc:
        acc = FragmentAccount(user_id=user_id, balance=0, total_recharged=0, total_consumed=0)
        db.add(acc)
        db.commit()
        db.refresh(acc)
    return acc


def get_balance(db: Session, user_id: str) -> int:
    acc = ensure_account(db, user_id)
    return acc.balance


def _write_ledger(db: Session, user_id: str, delta: int, type_: str, ref_id: str, balance_after: int):
    db.add(FragmentLedger(
        user_id=user_id, delta=delta, type=type_, ref_id=ref_id,
        balance_after=balance_after, created_at=datetime.utcnow(),
    ))


def credit(db: Session, user_id: str, amount: int, type_: str = "recharge", ref_id: str = None) -> int:
    """Add fragments (recharge/gift/refund). Returns new balance."""
    ensure_account(db, user_id)
    db.execute(
        update(FragmentAccount)
        .where(FragmentAccount.user_id == user_id)
        .values(
            balance=FragmentAccount.balance + amount,
            total_recharged=FragmentAccount.total_recharged + (amount if type_ in ("recharge", "gift") else 0),
            updated_at=datetime.utcnow(),
        )
    )
    acc = db.query(FragmentAccount).filter(FragmentAccount.user_id == user_id).first()
    _write_ledger(db, user_id, amount, type_, ref_id, acc.balance)
    db.commit()
    return acc.balance


def consume(db: Session, user_id: str, cost: int, type_: str, ref_id: str = None) -> int:
    """Atomically deduct fragments. Raises InsufficientBalance if not enough.
    Returns new balance.
    """
    if cost <= 0:
        return get_balance(db, user_id)
    ensure_account(db, user_id)
    result = db.execute(
        update(FragmentAccount)
        .where(FragmentAccount.user_id == user_id, FragmentAccount.balance >= cost)
        .values(
            balance=FragmentAccount.balance - cost,
            total_consumed=FragmentAccount.total_consumed + cost,
            updated_at=datetime.utcnow(),
        )
    )
    if result.rowcount == 0:
        db.rollback()
        raise InsufficientBalance(f"Need {cost} fragments")
    acc = db.query(FragmentAccount).filter(FragmentAccount.user_id == user_id).first()
    _write_ledger(db, user_id, -cost, type_, ref_id, acc.balance)
    db.commit()
    return acc.balance


def get_ledger(db: Session, user_id: str, limit: int = 50) -> list[dict]:
    rows = (
        db.query(FragmentLedger)
        .filter(FragmentLedger.user_id == user_id)
        .order_by(FragmentLedger.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {"id": r.id, "delta": r.delta, "type": r.type, "ref_id": r.ref_id,
         "balance_after": r.balance_after, "created_at": r.created_at.isoformat()}
        for r in rows
    ]
