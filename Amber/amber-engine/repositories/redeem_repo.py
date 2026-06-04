import secrets
import string
import uuid
from datetime import datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from database import RedeemCode
from services import wallet_service


ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class RedeemError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def normalize_code(raw: str) -> str:
    return "".join(ch for ch in raw.upper().strip() if ch in string.ascii_uppercase + string.digits)


def _format_code(prefix: str = "AMB") -> str:
    parts = ["".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(3)]
    return "-".join([prefix, *parts])


def serialize(row: RedeemCode) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "fragments": int(row.fragments or 0),
        "status": row.status,
        "batch_id": row.batch_id,
        "note": row.note,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "redeemed_by": row.redeemed_by,
        "redeemed_at": row.redeemed_at.isoformat() if row.redeemed_at else None,
    }


def generate_codes(
    db: Session,
    *,
    count: int,
    fragments: int,
    note: str | None = None,
    created_by: str | None = None,
) -> tuple[str, list[RedeemCode]]:
    if count < 1 or count > 500:
        raise RedeemError(400, "count must be between 1 and 500")
    if fragments < 100 or fragments > 1000:
        raise RedeemError(400, "fragments must be between 100 and 1000")

    batch_id = str(uuid.uuid4())
    rows: list[RedeemCode] = []
    existing = set()
    attempts = 0
    while len(rows) < count:
        attempts += 1
        if attempts > count * 20:
            raise RedeemError(500, "failed to generate unique codes")
        code = _format_code()
        normalized = normalize_code(code)
        if normalized in existing:
            continue
        if db.query(RedeemCode.id).filter(RedeemCode.code == normalized).first():
            continue
        existing.add(normalized)
        rows.append(RedeemCode(
            code=normalized,
            fragments=fragments,
            batch_id=batch_id,
            note=note,
            created_by=created_by,
        ))

    db.add_all(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return batch_id, rows


def list_codes(db: Session, *, limit: int = 100, status: str | None = None) -> list[RedeemCode]:
    q = db.query(RedeemCode)
    if status:
        q = q.filter(RedeemCode.status == status)
    return q.order_by(RedeemCode.created_at.desc()).limit(max(1, min(500, limit))).all()


def redeem_code(db: Session, *, user_id: str, raw_code: str) -> tuple[RedeemCode, int]:
    code = normalize_code(raw_code)
    if not code:
        raise RedeemError(400, "兑换码不能为空")

    row = db.query(RedeemCode).filter(RedeemCode.code == code).first()
    if not row:
        raise RedeemError(404, "兑换码不存在")
    if row.status == "used":
        raise RedeemError(409, "兑换码已被使用")
    if row.status != "active":
        raise RedeemError(409, "兑换码不可用")

    wallet_service.ensure_account(db, user_id)
    now = datetime.utcnow()
    result = db.execute(
        update(RedeemCode)
        .where(RedeemCode.id == row.id, RedeemCode.status == "active")
        .values(status="used", redeemed_by=user_id, redeemed_at=now)
    )
    if result.rowcount == 0:
        db.rollback()
        raise RedeemError(409, "兑换码已被使用")

    balance = wallet_service.credit(db, user_id, int(row.fragments), type_="gift", ref_id=f"redeem:{row.id}")
    db.refresh(row)
    return row, balance
