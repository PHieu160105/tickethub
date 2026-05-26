import { check, sleep } from 'k6';
import http from 'k6/http';

import { SHOW_ID, THINK_TIME_SECONDS } from './lib/config.js';
import { getOrCreateToken } from './lib/auth.js';
import { authHeaders, get, parseJson, requireStatus } from './lib/http.js';
import { heartbeatQueue, joinQueue, waitUntilAdmitted } from './lib/queue.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 401, 409));

export const options = {
  scenarios: {
    queue_users: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 20),
      iterations: Number(__ENV.ITERATIONS || 20),
      maxDuration: __ENV.MAX_DURATION || '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.90'],
  },
};

export default function () {
  const email = `k6-queue-${__VU}-${__ITER}@ticketrush-load.example.com`;
  const accessToken = getOrCreateToken(email);
  check(accessToken, { 'auth token exists': Boolean });

  const joined = joinQueue(SHOW_ID, accessToken);
  check(joined, {
    'queue token exists': (data) => Boolean(data.token),
    'queue status after join is known': (data) => ['waiting', 'admitted'].includes(String(data.status).toLowerCase()),
  });

  const admitted = String(joined.status).toLowerCase() === 'admitted'
    ? joined
    : waitUntilAdmitted(SHOW_ID, joined.token, accessToken);

  check(admitted, {
    'eventually admitted or timeout visible': (data) => ['admitted', 'timeout', 'expired', 'completed'].includes(String(data.status).toLowerCase()),
  });

  if (String(admitted.status).toLowerCase() === 'admitted') {
    heartbeatQueue(SHOW_ID, joined.token, accessToken);

    const seats = get(`/shows/${SHOW_ID}/seats`, authHeaders(accessToken, { 'X-Queue-Token': joined.token }));
    requireStatus(seats, 200, 'admitted token can fetch seats');
    const body = parseJson(seats, {});
    check(body, {
      'seat matrix has show id': (data) => Number(data.show_id) === SHOW_ID,
      'seat matrix has seats array': (data) => Array.isArray(data.seats),
    });
  }

  sleep(THINK_TIME_SECONDS);
}
