import { check, sleep } from 'k6';
import http from 'k6/http';

import { SHOW_ID, THINK_TIME_SECONDS } from './lib/config.js';
import { get, parseJson, requireStatus } from './lib/http.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429));

export const options = {
  scenarios: {
    seat_pressure: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.RAMP_UP || '20s', target: Number(__ENV.VUS || 80) },
        { duration: __ENV.HOLD || '10m', target: Number(__ENV.VUS || 80) },
        { duration: __ENV.RAMP_DOWN || '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.90'],
  },
};

export default function () {
  const response = get(`/shows/${SHOW_ID}/seats`);
  requireStatus(response, [200, 429], 'seat route returns data or waiting room gate');

  if (response.status === 429) {
    const body = parseJson(response, {});
    check(body, {
      'waiting room gate is returned': (data) => data.detail && data.detail.code === 'WAITING_ROOM_REQUIRED',
    });
  }

  sleep(THINK_TIME_SECONDS);
}

