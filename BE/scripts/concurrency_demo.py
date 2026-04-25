"""Simple script to simulate two users racing for one seat lock."""

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


async def lock_seat(client: httpx.AsyncClient, token: str, event_id: int, seat_id: int) -> dict:
    response = await client.post(
        f"{API_BASE}/bookings/lock",
        headers={"Authorization": f"Bearer {token}"},
        json={"event_id": event_id, "seat_ids": [seat_id]},
    )
    return {"status_code": response.status_code, "body": response.json()}


async def main() -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        token1, token2 = await asyncio.gather(
            login(client, EMAIL_1, PASSWORD),
            login(client, EMAIL_2, PASSWORD),
        )

        event_resp = await client.get(f"{API_BASE}/events/{EVENT_KEY}")
        event_resp.raise_for_status()
        event_id = event_resp.json()["id"]

        result1, result2 = await asyncio.gather(
            lock_seat(client, token1, event_id, SEAT_ID),
            lock_seat(client, token2, event_id, SEAT_ID),
        )

        print("Result User1:", result1)
        print("Result User2:", result2)


if __name__ == "__main__":
    asyncio.run(main())
