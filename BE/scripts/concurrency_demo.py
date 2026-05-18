"""Kịch bản mô phỏng hai người dùng cùng tranh một ghế trong cùng buổi diễn."""

import asyncio
import os

import httpx

API_BASE = os.getenv("API_BASE", "http://localhost:8000/api")
EMAIL_1 = os.getenv("RACE_USER1", "customer@ticketrush.com")
EMAIL_2 = os.getenv("RACE_USER2", "race2@ticketrush.com")
PASSWORD = os.getenv("RACE_PASSWORD", "Customer@123")
EVENT_KEY = os.getenv("RACE_EVENT", "1")
SEAT_ID = int(os.getenv("RACE_SEAT_ID", "1"))


async def login(client: httpx.AsyncClient, email: str, password: str) -> str:
    response = await client.post(f"{API_BASE}/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return response.json()["access_token"]


async def lock_seat(client: httpx.AsyncClient, token: str, show_id: int, seat_id: int, queue_token: str | None) -> dict:
    """Gọi API giữ ghế bằng đúng hợp đồng hiện tại của backend.

    Đầu vào:
    - `client`: HTTP client dùng chung cho kịch bản mô phỏng.
    - `token`: JWT của từng khách hàng.
    - `show_id`: mã buổi diễn cần tranh ghế.
    - `seat_id`: mã ghế cần giữ.
    - `queue_token`: token hàng đợi nếu buổi diễn đang bật queue.

    Đầu ra:
    - Từ điển gồm mã trạng thái HTTP và payload phản hồi.
    """

    payload: dict[str, object] = {"show_id": show_id, "seat_ids": [seat_id]}
    if queue_token:
        payload["queue_token"] = queue_token

    response = await client.post(
        f"{API_BASE}/bookings/lock",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    return {"status_code": response.status_code, "body": response.json()}


async def join_queue_if_needed(client: httpx.AsyncClient, token: str, show_id: int) -> str | None:
    """Lấy token hàng đợi cho buổi diễn nếu endpoint queue yêu cầu."""

    response = await client.post(
        f"{API_BASE}/shows/{show_id}/queue/join",
        headers={"Authorization": f"Bearer {token}"},
    )
    if response.status_code >= 400:
        return None
    body = response.json()
    return body.get("token")


async def main() -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        token1, token2 = await asyncio.gather(
            login(client, EMAIL_1, PASSWORD),
            login(client, EMAIL_2, PASSWORD),
        )

        event_resp = await client.get(f"{API_BASE}/events/{EVENT_KEY}")
        event_resp.raise_for_status()
        shows = event_resp.json().get("shows") or []
        show_id = int(shows[0]["id"])
        queue_token1, queue_token2 = await asyncio.gather(
            join_queue_if_needed(client, token1, show_id),
            join_queue_if_needed(client, token2, show_id),
        )

        result1, result2 = await asyncio.gather(
            lock_seat(client, token1, show_id, SEAT_ID, queue_token1),
            lock_seat(client, token2, show_id, SEAT_ID, queue_token2),
        )

        print("Kết quả người dùng 1:", result1)
        print("Kết quả người dùng 2:", result2)


if __name__ == "__main__":
    asyncio.run(main())
