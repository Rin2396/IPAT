from datetime import datetime, timedelta, timezone
from typing import Any
import uuid

import bcrypt
import redis
from jose import JWTError, jwt

from app.core.config import settings

_BCRYPT_MAX_PASSWORD_BYTES = 72


def _truncate_password(password: str) -> bytes:
    encoded = password.encode("utf-8")
    if len(encoded) > _BCRYPT_MAX_PASSWORD_BYTES:
        return encoded[:_BCRYPT_MAX_PASSWORD_BYTES]
    return encoded


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        _truncate_password(plain_password),
        hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        _truncate_password(password),
        bcrypt.gensalt(),
    ).decode("utf-8")


def create_access_token(subject: str | int, role: str, jti: str | None = None) -> str:
    if jti is None:
        jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "role": role, "type": "access", "jti": jti}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token(subject: str | int, role: str, jti: str | None = None) -> str:
    if jti is None:
        jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "role": role, "type": "refresh", "jti": jti}
    return jwt.encode(to_encode, settings.JWT_REFRESH_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def _redis_client() -> redis.Redis:
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


def blacklist_access_token(jti: str, expires_in_seconds: int) -> None:
    r = _redis_client()
    try:
        r.setex(f"blacklist:access:{jti}", expires_in_seconds, "1")
    finally:
        r.close()


def is_access_token_blacklisted(jti: str) -> bool:
    r = _redis_client()
    try:
        return r.get(f"blacklist:access:{jti}") is not None
    finally:
        r.close()


def blacklist_refresh_token(jti: str, expires_in_seconds: int) -> None:
    r = _redis_client()
    try:
        r.setex(f"blacklist:refresh:{jti}", expires_in_seconds, "1")
    finally:
        r.close()


def is_refresh_token_blacklisted(jti: str) -> bool:
    r = _redis_client()
    try:
        return r.get(f"blacklist:refresh:{jti}") is not None
    finally:
        r.close()
