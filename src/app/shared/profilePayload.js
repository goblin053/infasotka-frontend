/**
 * Тело PATCH /api/users/profile. В Swagger указаны name и avatar, но на бэке DTO иногда
 * ожидает fullName / displayName — дублируем строку, лишние ключи обычно игнорируются Jackson.
 */
export function buildProfilePatchPayload(displayName, avatar = '') {
  const name = String(displayName || '').trim();
  const av = avatar == null ? '' : String(avatar);
  return {
    name,
    fullName: name,
    displayName: name,
    avatar: av,
  };
}

/** Достаём поля из тела ответа PATCH (без повторного GET). */
export function mergeProfileFromPatchResponse(response, fallback = {}) {
  if (!response || typeof response !== 'object') {
    return {
      name: fallback.name || '',
      email: fallback.email || '',
      phone: fallback.phone != null ? String(fallback.phone) : '',
      avatar: fallback.avatar != null ? String(fallback.avatar) : '',
      grade: fallback.grade,
    };
  }
  const name = response.name ?? response.fullName ?? response.displayName ?? fallback.name ?? '';
  const email = response.email ?? fallback.email ?? '';
  const phone = response.phone != null && response.phone !== '' ? response.phone : fallback.phone ?? '';
  const rawAv = response.avatar;
  const avatar =
    rawAv != null && rawAv !== ''
      ? String(rawAv)
      : fallback.avatar != null
        ? String(fallback.avatar)
        : '';
  const grade =
    response.grade ?? response.className ?? response.group ?? response.schoolClass ?? fallback.grade;
  return { name, email, phone, avatar, grade };
}
