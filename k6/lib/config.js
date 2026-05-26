export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
export const API_PREFIX = (__ENV.API_PREFIX || '/api').replace(/\/$/, '');
export const API_BASE_URL = `${BASE_URL}${API_PREFIX}`;

export const SHOW_ID = Number(__ENV.SHOW_ID || 1);
export const EVENT_KEY = __ENV.EVENT_KEY || '';

export const TEST_EMAIL = __ENV.TEST_EMAIL || 'k6-user-local@ticketrush-load.example.com';
export const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Password123!';
export const TEST_NAME = __ENV.TEST_NAME || 'K6 Test User';

export const THINK_TIME_SECONDS = Number(__ENV.THINK_TIME_SECONDS || 1);
export const STATUS_POLL_INTERVAL_SECONDS = Number(__ENV.STATUS_POLL_INTERVAL_SECONDS || 2);
export const QUEUE_WAIT_TIMEOUT_SECONDS = Number(__ENV.QUEUE_WAIT_TIMEOUT_SECONDS || 120);

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};
