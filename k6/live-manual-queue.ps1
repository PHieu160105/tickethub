param(
  [int]$ShowId = 1,
  [string]$EventKey = "",
  [int]$ActiveUsers = 10,
  [int]$ReleaseBatch = 3,
  [int]$ArrivalRate = 2,
  [string]$Duration = "5m",
  [int]$SessionSeconds = 120,
  [int]$PollSeconds = 5,
  [int]$PreAllocatedVUs = 80,
  [int]$MaxVUs = 500,
  [string]$BaseUrl = "http://host.docker.internal:8000",
  [string]$RedisContainer = "ticketrush-redis-1"
)

$ErrorActionPreference = "Stop"

if ($ActiveUsers -lt 0) {
  throw "ActiveUsers must be >= 0"
}
if ($ReleaseBatch -lt 1) {
  throw "ReleaseBatch must be >= 1"
}
if ($ArrivalRate -lt 1) {
  throw "ArrivalRate must be >= 1"
}
if ($SessionSeconds -lt 10) {
  throw "SessionSeconds must be >= 10"
}
if ($PollSeconds -lt 1) {
  throw "PollSeconds must be >= 1"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "BE"

$env:WR_SHOW_ID = [string]$ShowId
$env:WR_EVENT_KEY = $EventKey
$env:WR_ACTIVE_USERS = [string]$ActiveUsers
$env:WR_RELEASE_BATCH = [string]$ReleaseBatch

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
                SET queue_enabled = true,
                    max_active_queue_tokens = :active_users,
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

        await session.execute(
            text(
                """
                UPDATE ticket_rush.queue_entries
                SET status = 'EXPIRED',
                    expires_at = NOW()
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
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$workerBatchRate = [math]::Round($ReleaseBatch / 3.0, 2)
$slotTurnoverRate = [math]::Round($ActiveUsers / [double]$SessionSeconds, 2)
$estimatedAdmitRate = [math]::Min($workerBatchRate, $slotTurnoverRate)

docker exec $RedisContainer redis-cli SET waiting_room:state waiting_room | Out-Null
docker exec $RedisContainer redis-cli SET waiting_room:protected_requests 10000 EX 900 | Out-Null
docker exec $RedisContainer redis-cli DEL waiting_room:db_errors | Out-Null

Write-Host "Live manual queue test is running"
Write-Host "Open while k6 is still running: http://localhost:5173/queue?showId=$resolvedShowId"
Write-Host "ShowId: $resolvedShowId"
Write-Host "ActiveUsers: $ActiveUsers"
Write-Host "ReleaseBatch per 3s worker tick: $ReleaseBatch"
Write-Host "Virtual arrivals: $ArrivalRate user(s)/second for $Duration"
Write-Host "Virtual session length: $SessionSeconds second(s)"
Write-Host "Estimated worker release ceiling: $workerBatchRate admitted user(s)/second"
Write-Host "Estimated active-slot turnover ceiling: $slotTurnoverRate admitted user(s)/second"
Write-Host "Estimated sustained admit ceiling: $estimatedAdmitRate admitted user(s)/second"
if ($ArrivalRate -gt $estimatedAdmitRate) {
  Write-Host "Queue will grow: arrivals are higher than the estimated sustained admit ceiling."
}

docker run --rm `
  -v "${repoRoot}/k6:/scripts" `
  grafana/k6 run `
  -e BASE_URL=$BaseUrl `
  -e SHOW_ID=$resolvedShowId `
  -e ARRIVAL_RATE=$ArrivalRate `
  -e DURATION=$Duration `
  -e SESSION_SECONDS=$SessionSeconds `
  -e STATUS_POLL_INTERVAL_SECONDS=$PollSeconds `
  -e PRE_ALLOCATED_VUS=$PreAllocatedVUs `
  -e MAX_VUS=$MaxVUs `
  -e RUN_ID=$runId `
  /scripts/queue-live-arrivals.js

if ($LASTEXITCODE -ne 0) {
  Write-Host "k6 finished with a non-zero exit code. Check the summary above for 429/latency/check failures."
}

$env:WR_SHOW_ID = [string]$resolvedShowId
Push-Location $backendDir
try {
  @'
import asyncio
import os
from sqlalchemy import text

from app.core.db import AsyncSessionLocal

show_id = int(os.environ["WR_SHOW_ID"])

async def main():
    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                text(
                    """
                    SELECT status, COUNT(*) AS count, MIN(position_hint) AS min_pos, MAX(position_hint) AS max_pos
                    FROM ticket_rush.queue_entries
                    WHERE show_id = :show_id
                      AND status IN ('waiting', 'admitted', 'WAITING', 'ADMITTED')
                    GROUP BY status
                    ORDER BY status
                    """
                ),
                {"show_id": show_id},
            )
        ).mappings().all()
        for row in rows:
            print(f"{row['status']}: count={row['count']}, min_pos={row['min_pos']}, max_pos={row['max_pos']}")

asyncio.run(main())
'@ | python -
} finally {
  Pop-Location
}
