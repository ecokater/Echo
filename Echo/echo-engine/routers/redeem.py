from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import User
from deps import get_db, get_current_user
from repositories import redeem_repo
from schemas import RedeemRequest, RedeemResponse

router = APIRouter(prefix="/api/redeem", tags=["redeem"])


@router.post("", response_model=RedeemResponse)
def redeem(
    req: RedeemRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        row, balance = redeem_repo.redeem_code(db, user_id=user.id, raw_code=req.code)
    except redeem_repo.RedeemError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return RedeemResponse(
        code=row.code,
        fragments=row.fragments,
        balance=balance,
        redeemed_at=row.redeemed_at.isoformat() if row.redeemed_at else "",
    )
