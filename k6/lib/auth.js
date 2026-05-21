import { check } from 'k6';

import { TEST_EMAIL, TEST_NAME, TEST_PASSWORD } from './config.js';
import { authHeaders, parseJson, post, requireStatus } from './http.js';

export function login(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const response = post('/auth/login', { email, password }, authHeaders(null));
  if (response.status === 200) {
    const body = parseJson(response, {});
    check(body, { 'login returns token': (data) => Boolean(data.access_token) });
    return body.access_token;
  }
  return null;
}

export function register(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const response = post(
    '/auth/register',
    {
      full_name: TEST_NAME,
      email,
      password,
      gender: 'other',
      age: 25,
    },
    authHeaders(null),
  );

  requireStatus(response, [201, 409], 'register user or already exists');
  if (response.status === 201) {
    const body = parseJson(response, {});
    check(body, { 'register returns token': (data) => Boolean(data.access_token) });
    return body.access_token;
  }
  return null;
}

export function getOrCreateToken(email = TEST_EMAIL, password = TEST_PASSWORD) {
  return login(email, password) || register(email, password) || login(email, password);
}

