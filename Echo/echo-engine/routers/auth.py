from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import jwt

import config
from database import User
from deps import get_db, get_current_user
from services import auth_service, wallet_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    phone: str
    password: str
    nickname: str | None = None


class LoginRequest(BaseModel):
    phone: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


def _user_dict(u: User) -> dict:
    return {"id": u.id, "phone": u.phone, "email": u.email, "nickname": u.nickname, "avatar_url": u.avatar_url}


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.phone == req.phone).first():
        raise HTTPException(status_code=409, detail="该手机号已注册")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")

    user = User(phone=req.phone, password_hash=auth_service.hash_password(req.password),
                nickname=req.nickname or req.phone)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Gift starter fragments
    wallet_service.credit(db, user.id, config.SIGNUP_GIFT_FRAGMENTS, type_="gift", ref_id="signup")

    return TokenResponse(
        access_token=auth_service.create_access_token(user.id),
        refresh_token=auth_service.create_refresh_token(user.id),
        user=_user_dict(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == req.phone).first()
    if not user or not auth_service.verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="手机号或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号已被禁用")
    return TokenResponse(
        access_token=auth_service.create_access_token(user.id),
        refresh_token=auth_service.create_refresh_token(user.id),
        user=_user_dict(user),
    )


@router.post("/refresh")
def refresh(req: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = auth_service.decode_token(req.refresh_token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Wrong token type")
    user_id = payload.get("sub")
    if not db.query(User).filter(User.id == user_id).first():
        raise HTTPException(status_code=401, detail="User not found")
    return {"access_token": auth_service.create_access_token(user_id), "token_type": "bearer"}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _user_dict(user)


@router.delete("/me")
def delete_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Account deletion (App Store / 合规 required)."""
    user.status = "deleted"
    user.phone = f"deleted_{user.id}"
    db.commit()
    return {"status": "success", "message": "账号已注销"}
