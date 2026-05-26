import { check, sleep } from 'k6';
import http from 'k6/http';
import exec from 'k6/execution';

import { SHOW_ID, STATUS_POLL_INTERVAL_SECONDS } from './lib/config.js';
import { getOrCreateToken } from './lib/auth.js';
import { authHeaders } from './lib/http.js';
import { heartbeatQueue, joinQueue, leaveQueue, queueStatus } from './lib/queue.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 401, 409, 429));

const ARRIVAL_RATE = Number(__ENV.ARRIVAL_RATE || 2);
const DURATION = __ENV.DURATION || '5m';
const PRE_ALLOCATED_VUS = Number(__ENV.PRE_ALLOCATED_VUS || 80);
const MAX_VUS = Number(__ENV.MAX_VUS || 500);
const SESSION_SECONDS = Number(__ENV.SESSION_SECONDS || 120);
const HEARTBEAT_INTERVAL_SECONDS = Number(__ENV.HEARTBEAT_INTERVAL_SECONDS || 20);
const RUN_ID = __ENV.RUN_ID || `${Date.now()}`;

export const options = {
  scenarios: {
    live_queue_arrivals: {
      executor: 'constant-arrival-rate',
      rate: ARRIVAL_RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    checks: ['rate>0.90'],
  },
};

function pollDelay(status) {
  return String(status).toLowerCase() === 'admitted'
    ? HEARTBEAT_INTERVAL_SECONDS
    : STATUS_POLL_INTERVAL_SECONDS;
}

export default function () {
  const iterationId = exec.scenario.iterationInTest;
  const email = `k6-live-${RUN_ID}-${iterationId}@ticketrush-load.example.com`;
  const accessToken = getOrCreateToken(email);
  check(accessToken, { 'auth token exists': Boolean });

  const joined = joinQueue(SHOW_ID, accessToken);
  check(joined, {
    'queue token exists': (data) => Boolean(data.token),
    'queue status after join is known': (data) => ['waiting', 'admitted'].includes(String(data.status).toLowerCase()),
  });

  let currentStatus = String(joined.status).toLowerCase();
  const endsAt = Date.now() + SESSION_SECONDS * 1000;

  while (Date.now() < endsAt && ['waiting', 'admitted'].includes(currentStatus)) {
    if (currentStatus === 'admitted') {
      const heartbeat = heartbeatQueue(SHOW_ID, joined.token, accessToken);
      currentStatus = String(heartbeat.status).toLowerCase();
    } else {
      const status = queueStatus(SHOW_ID, joined.token, accessToken);
      currentStatus = String(status.status).toLowerCase();
    }

    const remainingSeconds = Math.max((endsAt - Date.now()) / 1000, 0);
    sleep(Math.min(pollDelay(currentStatus), remainingSeconds));
  }

  if (['waiting', 'admitted'].includes(currentStatus)) {
    leaveQueue(SHOW_ID, joined.token, accessToken);
  }
}
