"""Kiểm thử quy ước xác thực."""

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import login
from app.schemas.auth import LoginRequest


@pytest.mark.asyncio
async def test_login_returns_auth_error_instead_of_validation_error_for_bad_credentials(db_session: AsyncSession):
    """Đăng nhập phải chuẩn hóa thông tin sai định dạng và thất bại qua logic xác thực."""

    payload = LoginRequest(email="  not-an-email  ", password="x")

    with pytest.raises(HTTPException) as exc_info:
        await login(payload=payload, session=db_session)

    assert exc_info.value.status_code == 401
