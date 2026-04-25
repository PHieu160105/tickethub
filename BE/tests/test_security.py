"""Security utility tests."""

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hashing_roundtrip() -> None:
    """Password hash should verify only the same plain text."""

    password = "StrongPass@123"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_jwt_roundtrip() -> None:
    """JWT helper should encode and decode subject claim."""

    token = create_access_token("42")
    payload = decode_access_token(token)

    assert payload["sub"] == "42"
