const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const ACCESS_TOKEN_KEY = 'infostotka_access_token';

function buildUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${API_URL}${normalizedPath}`;
}

function buildAuthHeaders(extraHeaders = {}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : '';
  return {
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text || !String(text).trim()) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function collectDefaultMessagesFromText(text) {
  const found = [];
  const re = /default message\s*\[([^\]]+)\]/gi;
  let match = re.exec(text);
  while (match) {
    const msg = String(match[1] || '').trim();
    if (msg) found.push(msg);
    match = re.exec(text);
  }
  return found;
}

function messagesFromErrorList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      return String(
        item.defaultMessage ?? item.message ?? item.msg ?? item.error ?? item.detail ?? ''
      ).trim();
    })
    .filter(Boolean);
}

/** Человекочитаемый текст ошибки API (в т.ч. Spring Validation default message). */
export function formatApiErrorMessage(payload, fallback = '') {
  if (payload == null || payload === '') return fallback;

  if (typeof payload === 'object') {
    const nestedLists = [
      payload.errors,
      payload.fieldErrors,
      payload.violations,
      payload.details,
      payload.subErrors,
    ];
    for (const list of nestedLists) {
      const fromList = messagesFromErrorList(list);
      if (fromList.length) return [...new Set(fromList)].join('\n');
    }
    if (payload.message != null) return formatApiErrorMessage(payload.message, fallback);
    if (payload.error != null) return formatApiErrorMessage(payload.error, fallback);
    if (payload.detail != null) return formatApiErrorMessage(payload.detail, fallback);
    if (payload.title != null && typeof payload.title === 'string') return formatApiErrorMessage(payload.title, fallback);
    return fallback;
  }

  let text = String(payload).trim();
  if (!text) return fallback;

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return formatApiErrorMessage(JSON.parse(text), fallback);
    } catch {
      // plain text
    }
  }

  text = text.replace(/^Произошла ошибка:\s*/i, '').trim();

  const fromBrackets = collectDefaultMessagesFromText(text);
  if (fromBrackets.length) return [...new Set(fromBrackets)].join('\n');

  if (/Validation failed for argument/i.test(text) || /Field error in object/i.test(text)) {
    return fallback || 'Проверьте введённые данные.';
  }

  return text || fallback;
}

function errorMessageFromPayload(payload, status) {
  const fallback = `HTTP ${status}`;
  if (payload == null) return fallback;
  const formatted = formatApiErrorMessage(payload, '');
  if (formatted) return formatted;
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  return fallback;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...buildAuthHeaders(),
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new Error(errorMessageFromPayload(payload, response.status));
  }

  return payload;
}

export async function healthcheck() {
  const response = await fetch(buildUrl('/health'), {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  if (response.status === 404 || response.status === 403) {
    return { ok: true, note: response.status === 403 ? 'health недоступен (403), пропускаем' : 'health endpoint is absent' };
  }

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error(errorMessageFromPayload(payload, response.status));
  }

  return parseResponse(response);
}

function fileNameFromContentDisposition(headerValue, fallbackName) {
  const fallback = String(fallbackName || '').trim() || 'task-file';
  const header = String(headerValue || '');
  const utfMatch = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]).replace(/^["']|["']$/g, '');
    } catch {
      // ignore invalid encoding
    }
  }
  const simpleMatch = header.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (simpleMatch?.[2]) return simpleMatch[2];
  return fallback;
}

export async function downloadTaskFile(taskId, fallbackFileName = 'task-file') {
  const response = await fetch(buildUrl(`/api/tasks/${taskId}/file`), {
    method: 'GET',
    headers: buildAuthHeaders({
      accept: '*/*',
    }),
  });
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error(errorMessageFromPayload(payload, response.status));
  }
  const blob = await response.blob();
  const cd = response.headers.get('content-disposition');
  const fileName = fileNameFromContentDisposition(cd, fallbackFileName);
  return { blob, fileName };
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
