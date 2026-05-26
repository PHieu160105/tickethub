import { check, sleep } from 'k6';
import http from 'k6/http';

import { SHOW_ID, THINK_TIME_SECONDS } from './lib/config.js';
import { getOrCreateToken } from './lib/auth.js';
import { authHeaders, get, parseJson, requireStatus } from './lib/http.js';
import { joinQueue, queueStatus } from './lib/queue.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 401, 409, 429));

export const options = {
  scenarios: {
    guarded_access: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.90'],
  },
};

export default function () {
  const email = `k6-guard-${__VU}@ticketrush-load.example.com`;
  const token = getOrCreateToken(email);
  check(token, { 'auth token exists': Boolean });

  const blocked = get(`/shows/${SHOW_ID}/seats`, authHeaders(token));
  requireStatus(blocked, [200, 429], 'protected seat route responds');

  if (blocked.status === 429) {
    const body = parseJson(blocked, {});
    check(body, {
      'blocked with waiting room code': (data) => data.detail && data.detail.code === 'WAITING_ROOM_REQUIRED',
      'blocked response has queue_url': (data) => data.detail && typeof data.detail.queue_url === 'string',
    });

    const joined = joinQueue(SHOW_ID, token);
    check(joined, {
      'queue join returns token': (data) => Boolean(data.token),
      'queue join returns position': (data) => Number.isFinite(Number(data.position)),
    });

    const status = queueStatus(SHOW_ID, joined.token, token);
    check(status, {
      'queue status returns token': (data) => data.token === joined.token,
      'queue status is known': (data) => ['waiting', 'admitted', 'expired', 'completed'].includes(String(data.status).toLowerCase()),
    });
  }

  sleep(THINK_TIME_SECONDS);
}
