import { check, sleep } from 'k6';
import http from 'k6/http';

import { SHOW_ID, THINK_TIME_SECONDS } from './lib/config.js';
import { getOrCreateToken } from './lib/auth.js';
import { authHeaders, get, parseJson, requireStatus } from './lib/http.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 401, 409, 429));

export const options = {
  scenarios: {
    ramp_seat_reads: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.RAMP_UP || '30s', target: Number(__ENV.VUS || 50) },
        { duration: __ENV.HOLD || '1m', target: Number(__ENV.VUS || 50) },
        { duration: __ENV.RAMP_DOWN || '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.85'],
  },
};

export default function () {
  const email = `k6-load-${__VU}@ticketrush-load.example.com`;
  const token = getOrCreateToken(email);
  check(token, { 'auth token exists': Boolean });

  const seats = get(`/shows/${SHOW_ID}/seats`, authHeaders(token));
  requireStatus(seats, [200, 429], 'seat matrix returns data or waiting room gate');

  if (seats.status === 429) {
    const body = parseJson(seats, {});
    check(body, {
      'load receives waiting room gate': (data) => data.detail && data.detail.code === 'WAITING_ROOM_REQUIRED',
    });
  }

  sleep(THINK_TIME_SECONDS);
}
