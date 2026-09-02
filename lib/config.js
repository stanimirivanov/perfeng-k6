export const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
export const API_VERSION = __ENV.API_VERSION || 'v1';
export const THINK_TIME = Number(__ENV.THINK_TIME || '1');
if (!Number.isFinite(THINK_TIME) || THINK_TIME < 0) {
  throw new Error('THINK_TIME must be a non-negative number of seconds');
}

export function getHeaders() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (__ENV.AUTH_TOKEN) headers.Authorization = `Bearer ${__ENV.AUTH_TOKEN}`;
  return headers;
}

export function getApiUrl(path) {
  return `${BASE_URL}/api/${API_VERSION}/${path.replace(/^\//, '')}`;
}

export function generateRandomId(prefix = 'test') {
  return `${prefix}-${__VU}-${__ITER}`;
}
