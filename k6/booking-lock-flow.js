import { check, sleep } from 'k6';
import http from 'k6/http';

import { SHOW_ID, THINK_TIME_SECONDS } from './lib/config.js';
import { getOrCreateToken } from './lib/auth.js';
import { authHeaders, get, parseJson, post, requireStatus } from './lib/http.js';
import { heartbeatQueue, joinQueue, waitUntilAdmitted } from './lib/queue.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 401, 409, 429));

export const options = {
  scenarios: {
    booking_lock_users: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 5),
      iterations: Number(__ENV.ITERATIONS || 5),
      maxDuration: __ENV.MAX_DURATION || '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<2500'],
    checks: ['rate>0.85'],
  },
};

function findAvailableSeatId(matrix) {
  const availableSeats = (matrix.seats || []).filter((seat) => String(seat.status).toLowerCase() === 'available' && !seat.is_admin_locked);
  if (availableSeats.length === 0) return null;
  const index = ((__VU - 1) + __ITER) % availableSeats.length;
  return availableSeats[index].id;
}

export default function () {
  const email = `k6-booking-${__VU}-${__ITER}@ticketrush-load.example.com`;
  const accessToken = getOrCreateToken(email);
  check(accessToken, { 'auth token exists': Boolean });

  const joined = joinQueue(SHOW_ID, accessToken);
  const admitted = String(joined.status).toLowerCase() === 'admitted'
    ? joined
    : waitUntilAdmitted(SHOW_ID, joined.token, accessToken);

  if (String(admitted.status).toLowerCase() !== 'admitted') {
    check(admitted, { 'booking flow admitted before timeout': () => false });
    return;
  }

  heartbeatQueue(SHOW_ID, joined.token, accessToken);

  const seatsResponse = get(`/shows/${SHOW_ID}/seats`, authHeaders(accessToken, { 'X-Queue-Token': joined.token }));
  requireStatus(seatsResponse, 200, 'admitted token can fetch seat matrix');
  const matrix = parseJson(seatsResponse, {});
  const seatId = findAvailableSeatId(matrix);
  check(seatId, { 'found available seat': (value) => Boolean(value) });
  if (!seatId) return;

  const lockResponse = post(
    '/bookings/lock',
    { show_id: SHOW_ID, seat_ids: [seatId], queue_token: joined.token },
    authHeaders(accessToken),
  );
  requireStatus(lockResponse, 200, 'lock seat with admitted queue token');
  const lockBody = parseJson(lockResponse, {});
  check(lockBody, {
    'lock has locked seat': (data) => Array.isArray(data.locked_seat_ids) && data.locked_seat_ids.includes(seatId),
  });

  if (__ENV.CHECKOUT === 'true') {
    const checkoutResponse = post('/bookings/checkout', { show_id: SHOW_ID, queue_token: joined.token }, authHeaders(accessToken));
    requireStatus(checkoutResponse, 200, 'checkout with admitted queue token');
    const checkoutBody = parseJson(checkoutResponse, {});
    check(checkoutBody, {
      'checkout returns order id': (data) => Number.isFinite(Number(data.order_id)),
      'checkout returns items': (data) => Array.isArray(data.items) && data.items.length > 0,
    });
  } else {
    const releaseResponse = post('/bookings/release', { show_id: SHOW_ID, seat_ids: [seatId] }, authHeaders(accessToken));
    requireStatus(releaseResponse, 200, 'release locked seat');
  }

  sleep(THINK_TIME_SECONDS);
}
