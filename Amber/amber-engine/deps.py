import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import SessionLocal, User
from services.auth_service import decode_token

bearer_scheme = HTTPBearer(auto_error=False)

# Comma-separated phone allowlist that auto-grants admin (bootstrap without a
# manual promote step). e.g. ADMIN_PHONES="13900000099,13800000001"
ADMIN_PHONES = {p.strip() for p in os.getenv("ADMIN_PHONES", "").split(",") if p.strip()}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type")

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def get_current_admin(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Admin-only guard. Grants access if the user's role is 'admin', or if the
    user's phone is in the ADMIN_PHONES allowlist (auto-promotes on first hit)."""
    if user.role != "admin" and user.phone and user.phone in ADMIN_PHONES:
        user.role = "admin"  # persist promotion for subsequent role-based checks
        db.commit()
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Returns the user if a valid access token is present, else None.

    Lets existing unauthenticated clients keep working while new clients that
    send a token get fragment billing applied.
    """
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            return None
        return db.query(User).filter(User.id == payload.get("sub")).first()
    except Exception:
        return None
