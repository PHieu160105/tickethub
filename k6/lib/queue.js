import { sleep } from 'k6';

import { QUEUE_WAIT_TIMEOUT_SECONDS, STATUS_POLL_INTERVAL_SECONDS } from './config.js';
import { authHeaders, parseJson, post, get, requireStatus } from './http.js';

export function joinQueue(showId, accessToken) {
  const response = post(`/shows/${showId}/queue/join`, {}, authHeaders(accessToken));
  requireStatus(response, [200, 409], 'join queue');
  return parseJson(response, {});
}

export function queueStatus(showId, queueToken, accessToken) {
  const response = get(`/shows/${showId}/queue/status/${queueToken}`, authHeaders(accessToken));
  requireStatus(response, 200, 'queue status');
  return parseJson(response, {});
}

export function heartbeatQueue(showId, queueToken, accessToken) {
  const response = post(`/shows/${showId}/queue/heartbeat/${queueToken}`, {}, authHeaders(accessToken));
  requireStatus(response, 200, 'queue heartbeat');
  return parseJson(response, {});
}

export function waitUntilAdmitted(showId, queueToken, accessToken) {
  const startedAt = Date.now();

  while ((Date.now() - startedAt) / 1000 < QUEUE_WAIT_TIMEOUT_SECONDS) {
    const status = queueStatus(showId, queueToken, accessToken);
    if (String(status.status).toLowerCase() === 'admitted') {
      return status;
    }
    if (['expired', 'completed'].includes(String(status.status).toLowerCase())) {
      return status;
    }
    sleep(STATUS_POLL_INTERVAL_SECONDS);
  }

  return { token: queueToken, status: 'timeout' };
}

