param(
  [int]$ShowId = 1,
  [int]$ActiveUsers = 200,
  [int]$ReleaseBatch = 50,
  [string]$RedisContainer = "ticketrush-redis-1",
  [switch]$ResetQueue
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "BE"

if (docker ps -a --format "{{.Names}}" | Select-String -SimpleMatch "ticketrush-k6-ui-pressure") {
  docker rm -f ticketrush-k6-ui-pressure | Out-Null
}
docker exec $RedisContainer redis-cli SET waiting_room:state normal | Out-Null
docker exec $RedisContainer redis-cli DEL waiting_room:protected_requests waiting_room:db_errors waiting_room:state_changed_at | Out-Null

$env:WR_SHOW_ID = [string]$ShowId
$env:WR_ACTIVE_USERS = [string]$ActiveUsers
$env:WR_RELEASE_BATCH = [string]$ReleaseBatch
$env:WR_RESET_QUEUE = if ($ResetQueue) { "1" } else { "0" }

Push-Location $backendDir
try {
  @'
import asyncio
import os
from sqlalchemy import text

from app.core.db import AsyncSessionLocal

show_id = int(os.environ["WR_SHOW_ID"])
active_users = int(os.environ["WR_ACTIVE_USERS"])
release_batch = int(os.environ["WR_RELEASE_BATCH"])
reset_queue = os.environ.get("WR_RESET_QUEUE") == "1"

async def main():
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                """
                UPDATE ticket_rush.shows
                SET max_active_queue_tokens = :active_users,
                    queue_release_batch = :release_batch
                WHERE id = :show_id
                """
            ),
            {"show_id": show_id, "active_users": active_users, "release_batch": release_batch},
        )
        if reset_queue:
            await session.execute(
                text(
                    """
                    UPDATE ticket_rush.queue_entries
                    SET status = 'expired'
                    WHERE show_id = :show_id
                      AND status IN ('waiting', 'admitted', 'WAITING', 'ADMITTED')
                    """
                ),
                {"show_id": show_id},
            )
        await session.commit()

asyncio.run(main())
'@ | python -
} finally {
  Pop-Location
}

Write-Host "Waiting Room is OFF"
Write-Host "ShowId: $ShowId"
Write-Host "ActiveUsers restored to: $ActiveUsers"
Write-Host "ReleaseBatch restored to: $ReleaseBatch"
