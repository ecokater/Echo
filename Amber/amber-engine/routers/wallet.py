from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import config
from database import User
from deps import get_db, get_current_user
from services import wallet_service

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


@router.get("/balance")
def get_balance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    balance = wallet_service.get_balance(db, user.id)
    return {
        "balance": balance,
        "low_balance": balance < config.LOW_BALANCE_THRESHOLD,
        "threshold": config.LOW_BALANCE_THRESHOLD,
    }


@router.get("/ledger")
def get_ledger(limit: int = 50, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return wallet_service.get_ledger(db, user.id, limit=limit)
