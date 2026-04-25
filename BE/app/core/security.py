"""Password hashing and JWT utilities."""

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# Use PBKDF2 to keep hashing deterministic across environments without bcrypt backend issues.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
settings = get_settings()


class TokenDecodeError(Exception):
    """Raised when JWT token cannot be decoded or is missing required claims."""



def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt."""

    return pwd_context.hash(password)



def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the stored hash."""

    return pwd_context.verify(plain_password, hashed_password)



def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Create signed JWT token for the authenticated user."""

    expire_at = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)



def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate JWT token payload."""

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise TokenDecodeError("Invalid access token") from exc

    if "sub" not in payload:
        raise TokenDecodeError("Token payload missing subject")

    return payload
