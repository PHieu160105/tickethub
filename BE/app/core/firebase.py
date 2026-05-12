"""Firebase Admin SDK initialization and token verification."""

from typing import Any

import firebase_admin
from firebase_admin import credentials
from firebase_admin.auth import verify_id_token

from app.core.config import get_settings

_settings = get_settings()

_firebase_app: firebase_admin.App | None = None


def _get_firebase_creds() -> dict[str, Any]:
    """Build Firebase credentials dict from environment settings."""
    return {
        "type": "service_account",
        "project_id": _settings.firebase_project_id,
        "private_key": _settings.firebase_private_key.replace("\\n", "\n"),
        "client_email": _settings.firebase_client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }


def get_firebase_app() -> firebase_admin.App:
    """Get or initialize the Firebase app singleton."""
    global _firebase_app
    if _firebase_app is None:
        creds = credentials.Certificate(_get_firebase_creds())
        _firebase_app = firebase_admin.initialize_app(creds)
    return _firebase_app


def verify_firebase_token(id_token: str) -> dict[str, Any]:
    """Verify a Firebase ID token and return its decoded claims."""
    app = get_firebase_app()
    return verify_id_token(id_token, app=app)


class FirebaseTokenError(Exception):
    """Raised when Firebase token verification fails."""