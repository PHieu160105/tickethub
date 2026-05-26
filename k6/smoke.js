import { check, sleep } from 'k6';

import { SHOW_ID, THINK_TIME_SECONDS } from './lib/config.js';
import { getOrCreateToken } from './lib/auth.js';
import { authHeaders, get, parseJson, requireStatus, rootUrl } from './lib/http.js';
import http from 'k6/http';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 401, 409, 429));

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const token = getOrCreateToken();
  check(token, { 'auth token exists': Boolean });

  const health = http.get(rootUrl('/health'));
  requireStatus(health, 200, 'health is ok');

  const seats = get(`/shows/${SHOW_ID}/seats`, authHeaders(token));
  requireStatus(seats, [200, 429], 'seat matrix is reachable or protected by waiting room');

  const body = parseJson(seats, {});
  if (seats.status === 429) {
    check(body, {
      'waiting room error shape': (data) => data.detail && data.detail.code === 'WAITING_ROOM_REQUIRED',
    });
  }

  sleep(THINK_TIME_SECONDS);
}
