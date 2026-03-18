from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    blacklist_access_token,
    blacklist_refresh_token,
    is_refresh_token_blacklisted,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenPair, RefreshRequest, LoginResponse

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db=Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = create_refresh_token(subject=user.id, role=user.role.value)
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh", response_model=TokenPair)
def refresh(data: RefreshRequest, db=Depends(get_db)):
    payload = decode_refresh_token(data.refresh_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    jti = payload.get("jti")
    if jti and is_refresh_token_blacklisted(jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    blacklist_refresh_token(jti, 60 * 60 * 24 * settings.JWT_REFRESH_EXPIRE_DAYS)
    access_token = create_access_token(subject=user.id, role=user.role.value)
    new_refresh_token = create_refresh_token(subject=user.id, role=user.role.value)
    return TokenPair(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout")
def logout(
    current_user: CurrentUser,
    authorization: str | None = Header(None, alias="Authorization"),
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        payload = decode_access_token(token)
        if payload:
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                now = datetime.now(timezone.utc).timestamp()
                ttl = max(0, int(exp - now))
                if ttl > 0:
                    blacklist_access_token(jti, ttl)
    return {"detail": "Logged out"}
