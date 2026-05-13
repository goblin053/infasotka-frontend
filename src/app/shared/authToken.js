function normalizeRole(rawRole) {
  const value = String(rawRole || '')
    .trim()
    .toLowerCase()
    .replace(/^role_/, '');
  if (value === 'student' || value === 'tutor' || value === 'admin') return value;
  return '';
}

export function decodeJwtPayload(token) {
  try {
    const payloadBase64 = String(token || '').split('.')[1];
    if (!payloadBase64) return null;
    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizedRolesFromPayload(payload) {
  const direct = normalizeRole(
    payload?.role ||
      payload?.userRole ||
      payload?.authority ||
      payload?.user_type ||
      payload?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
  );
  if (direct) return [direct];

  const roles = Array.isArray(payload?.roles)
    ? payload.roles
    : Array.isArray(payload?.authorities)
      ? payload.authorities
      : [];

  return roles.map((item) => normalizeRole(item)).filter(Boolean);
}

export function roleFromClaims(payload) {
  const normalizedRoles = normalizedRolesFromPayload(payload);
  if (normalizedRoles.includes('admin')) return 'admin';
  const hasTutor = normalizedRoles.includes('tutor');
  const hasStudent = normalizedRoles.includes('student');
  // В одном JWT иногда перечисляют несколько ролей; для «ИнфоСотки» безопаснее не считать
  // пользователя репетитором без однозначного сигнала (см. explicitRoleFromClaims / профиль).
  if (hasTutor && hasStudent) return 'student';
  if (hasTutor) return 'tutor';
  if (hasStudent) return 'student';
  return 'student';
}

/**
 * Роль из JWT, только если она однозначно задана в токене.
 * Если в массиве ролей и student, и tutor — возвращает null (нужен профиль или зонд).
 */
export function explicitRoleFromClaims(payload) {
  const normalizedRoles = normalizedRolesFromPayload(payload);
  if (normalizedRoles.length === 0) return null;
  if (normalizedRoles.includes('admin')) return 'admin';
  const hasTutor = normalizedRoles.includes('tutor');
  const hasStudent = normalizedRoles.includes('student');
  if (hasTutor && hasStudent) return null;
  if (hasTutor) return 'tutor';
  if (hasStudent) return 'student';
  return null;
}

export function roleFromUserProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const candidates = [
    profile.role,
    profile.userRole,
    profile.accountRole,
    profile.type,
    profile.userType,
    profile.roleName,
  ];
  for (const c of candidates) {
    const r = normalizeRole(c);
    if (r) return r;
  }
  if (profile.user && typeof profile.user === 'object') {
    return roleFromUserProfile(profile.user);
  }
  return null;
}

const UUID_STRING_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Стандартное строковое представление UUID (36 символов с дефисами). */
export function isUuidString(value) {
  const s = value == null ? '' : String(value).trim();
  return s.length > 0 && UUID_STRING_RE.test(s);
}

/**
 * UUID пользователя из JWT: перебираем типичные claim'ы, берём первое значение в формате UUID.
 * `sub` часто = email — в таком случае пропускаем, если это не UUID.
 */
export function uuidFromClaims(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const keys = ['userId', 'user_id', 'user_uuid', 'uuid', 'uid', 'id', 'sub'];
  for (const k of keys) {
    const v = payload[k];
    if (isUuidString(v)) return String(v).trim();
  }
  if (payload.user && typeof payload.user === 'object' && isUuidString(payload.user.id)) {
    return String(payload.user.id).trim();
  }
  return '';
}

export function uuidFromUserProfile(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const keys = ['id', 'userId', 'user_id', 'uuid'];
  for (const k of keys) {
    const v = profile[k];
    if (isUuidString(v)) return String(v).trim();
  }
  if (profile.user && typeof profile.user === 'object') {
    return uuidFromUserProfile(profile.user);
  }
  return '';
}

/** Для тел запросов к API, где нужен java.util.UUID. */
export function userUuidForApi(payload, profile) {
  return uuidFromUserProfile(profile) || uuidFromClaims(payload);
}

export function displayNameFromClaims(payload, fallbackEmail) {
  return (
    payload?.name ||
    payload?.fullName ||
    payload?.username ||
    payload?.email ||
    String(fallbackEmail || '').split('@')[0] ||
    'Пользователь'
  );
}

/**
 * Стабильный идентификатор пользователя для ключей localStorage (не смешивать учётки на одном браузере).
 * Берётся из JWT в порядке приоритета: userId, id, sub, user_id.
 */
export function stableStorageUserId(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = [payload.userId, payload.id, payload.sub, payload.user_id];
  for (const c of candidates) {
    const s = c == null ? '' : String(c).trim();
    if (s) return s;
  }
  return '';
}

/**
 * Фолбэк-определение роли по фактическому доступу к защищенным endpoint'ам.
 * Нужен на случай, если в JWT нет роли или роль в БД была изменена.
 *
 * Нельзя проверять только /api/tutors/dashboard первым: часть бэкендов отвечает 200
 * и ученикам, из‑за чего после перезагрузки роль становится «репетитор». Смотрим оба
 * эндпоинта; если доступны оба — сохраняем роль из JWT (defaultRole).
 */
export async function resolveRoleByApiAccess(apiRequest, defaultRole = 'student') {
  let tutorOk = false;
  let studentOk = false;

  try {
    await apiRequest('/api/tutors/dashboard');
    tutorOk = true;
  } catch {
    // ignore
  }

  try {
    await apiRequest('/api/students/dashboard');
    studentOk = true;
  } catch {
    // ignore
  }

  if (studentOk && !tutorOk) return 'student';
  if (tutorOk && !studentOk) return 'tutor';
  if (studentOk && tutorOk) {
    if (defaultRole === 'admin' || defaultRole === 'tutor' || defaultRole === 'student') {
      return defaultRole;
    }
    return 'student';
  }

  return defaultRole;
}

/**
 * Роль и профиль текущего пользователя.
 * Приоритет: профиль (/api/users/profile) -> однозначные claims JWT -> зонд доступа.
 */
export async function resolveUserRole(apiRequest, payload) {
  const jwtFallback = roleFromClaims(payload);
  let profile = null;

  try {
    profile = await apiRequest('/api/users/profile');
    const fromProfile = roleFromUserProfile(profile);
    if (fromProfile) return { role: fromProfile, profile };
  } catch {
    profile = null;
  }

  const fromClaims = explicitRoleFromClaims(payload);
  if (fromClaims) return { role: fromClaims, profile };

  const probed = await resolveRoleByApiAccess(apiRequest, jwtFallback);
  return { role: probed, profile };
}
