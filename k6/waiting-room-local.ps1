param(
  [int]$ShowId = 1,
  [string]$EventKey = "",
  [int]$ActiveUsers = 10,
  [int]$ReleaseBatch = 10,
  [int]$PressureUsers = 20,
  [string]$Hold = "10m",
  [string]$BaseUrl = "http://host.docker.internal:8000",
  [string]$RedisContainer = "ticketrush-redis-1",
  [switch]$ResetQueue,
  [switch]$NoPressure
)

$ErrorActionPreference = "Stop"

if ($ActiveUsers -lt 0) {
  throw "ActiveUsers must be >= 0"
}
if ($ReleaseBatch -lt 1) {
  throw "ReleaseBatch must be >= 1"
}
if ($PressureUsers -lt 1) {
  throw "PressureUsers must be >= 1"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "BE"

$env:WR_SHOW_ID = [string]$ShowId
$env:WR_EVENT_KEY = $EventKey
$env:WR_ACTIVE_USERS = [string]$ActiveUsers
$env:WR_RELEASE_BATCH = [string]$ReleaseBatch
$env:WR_RESET_QUEUE = if ($ResetQueue) { "1" } else { "0" }

Push-Location $backendDir
try {
  $resolvedShowId = @'
import asyncio
import os
from sqlalchemy import text

from app.core.db import AsyncSessionLocal

input_show_id = int(os.environ["WR_SHOW_ID"])
event_key = os.environ.get("WR_EVENT_KEY", "").strip()
active_users = int(os.environ["WR_ACTIVE_USERS"])
release_batch = int(os.environ["WR_RELEASE_BATCH"])
reset_queue = os.environ.get("WR_RESET_QUEUE") == "1"

async def main():
    async with AsyncSessionLocal() as session:
        resolved_show_id = input_show_id
        if event_key:
            resolved = await session.scalar(
                text(
                    """
                    SELECT s.id
                    FROM ticket_rush.shows s
                    JOIN ticket_rush.events e ON e.id = s.event_id
                    WHERE e.slug = :event_key
                      AND s.is_deleted = false
                    ORDER BY s.start_at ASC, s.id ASC
                    LIMIT 1
                    """
                ),
                {"event_key": event_key},
            )
            if not resolved:
                raise SystemExit(f"No show found for eventKey={event_key}")
            resolved_show_id = int(resolved)

        updated = await session.execute(
            text(
                """
                UPDATE ticket_rush.shows
                SET max_active_queue_tokens = :active_users,
                    queue_release_batch = :release_batch
                WHERE id = :show_id
                RETURNING id
                """
            ),
            {"show_id": resolved_show_id, "active_users": active_users, "release_batch": release_batch},
        )
        row = updated.first()
        if not row:
            raise SystemExit(f"Show {resolved_show_id} not found")

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
                {"show_id": resolved_show_id},
            )

        await session.commit()
        print(resolved_show_id)

asyncio.run(main())
'@ | python -
} finally {
  Pop-Location
}

$resolvedShowId = [int]($resolvedShowId | Select-Object -Last 1)

docker exec $RedisContainer redis-cli SET waiting_room:state waiting_room | Out-Null
docker exec $RedisContainer redis-cli SET waiting_room:protected_requests 2000 EX 900 | Out-Null
docker exec $RedisContainer redis-cli DEL waiting_room:db_errors | Out-Null

if (docker ps -a --format "{{.Names}}" | Select-String -SimpleMatch "ticketrush-k6-ui-pressure") {
  docker rm -f ticketrush-k6-ui-pressure | Out-Null
}

if (-not $NoPressure) {
  docker run -d `
    --name ticketrush-k6-ui-pressure `
    -v "${repoRoot}/k6:/scripts" `
    grafana/k6 run `
    -e BASE_URL=$BaseUrl `
    -e SHOW_ID=$resolvedShowId `
    -e VUS=$PressureUsers `
    -e RAMP_UP=15s `
    -e HOLD=$Hold `
    -e RAMP_DOWN=15s `
    /scripts/waiting-room-seat-pressure.js | Out-Null
}

Write-Host "Waiting Room is ON"
Write-Host "ShowId: $resolvedShowId"
Write-Host "ActiveUsers: $ActiveUsers"
Write-Host "ReleaseBatch: $ReleaseBatch"
Write-Host "PressureUsers: $(if ($NoPressure) { 0 } else { $PressureUsers })"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Queue URL: http://localhost:5173/queue?showId=$resolvedShowId"
