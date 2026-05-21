import http from 'k6/http';
import { check, fail } from 'k6';

import { API_BASE_URL, BASE_URL, DEFAULT_HEADERS } from './config.js';

export function url(path) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function rootUrl(path) {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function authHeaders(token, extra = {}) {
  return {
    headers: {
      ...DEFAULT_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
  };
}

export function parseJson(response, fallback = null) {
  try {
    return response.json();
  } catch {
    return fallback;
  }
}

export function requireStatus(response, expected, label) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  const ok = check(response, {
    [label]: (res) => allowed.includes(res.status),
  });
  if (!ok) {
    fail(`${label}: expected ${allowed.join(', ')}, got ${response.status}: ${response.body}`);
  }
}

export function get(path, params = {}) {
  return http.get(url(path), params);
}

export function post(path, body = {}, params = {}) {
  return http.post(url(path), JSON.stringify(body), params);
}
