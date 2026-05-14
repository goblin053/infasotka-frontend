const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const ACCESS_TOKEN_KEY = 'infostotka_access_token';

function buildUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${API_URL}${normalizedPath}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export async function apiRequest(path, options = {}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : '';

  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export function setAccessToken(token) {
  if (typeof localStorage === 'undefined') return;
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

export function clearAccessToken() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export { API_URL };
