const KEY = 'infostotka_display_by_account';

function accountKeyFromPayload(payload) {
  if (!payload) return '';
  return String(payload.sub || payload.userId || payload.id || payload.email || '').trim();
}

/** Не кладём data URL / слишком длинные строки в localStorage (риск квоты при аватаре из файла). */
function avatarSafeForDisplayCache(avatar) {
  const a = String(avatar || '').trim();
  if (!a) return '';
  if (a.startsWith('data:')) return '';
  if (a.length > 2048) return '';
  return a;
}

export function readDisplayCache(payload) {
  if (typeof localStorage === 'undefined') return null;
  const accountKey = accountKeyFromPayload(payload);
  if (!accountKey) return null;
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || '{}');
    const row = map[accountKey];
    if (row && typeof row.name === 'string' && row.name.trim()) {
      return { name: row.name.trim(), avatar: row.avatar != null ? String(row.avatar) : '' };
    }
  } catch {
    // ignore
  }
  return null;
}

export function writeDisplayCache(payload, { name, avatar }) {
  if (typeof localStorage === 'undefined') return;
  const accountKey = accountKeyFromPayload(payload);
  const n = name != null ? String(name).trim() : '';
  if (!accountKey || !n) return;
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || '{}');
    const prev = map[accountKey] || {};
    const prevAv = avatarSafeForDisplayCache(prev.avatar);
    let nextAv;
    if (avatar === undefined) {
      nextAv = prevAv;
    } else {
      const raw = String(avatar).trim();
      if (!raw) {
        nextAv = '';
      } else {
        nextAv = avatarSafeForDisplayCache(raw);
      }
    }
    map[accountKey] = {
      name: n,
      avatar: nextAv,
    };
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function removeDisplayCacheForPayload(payload) {
  if (typeof localStorage === 'undefined') return;
  const accountKey = accountKeyFromPayload(payload);
  if (!accountKey) return;
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || '{}');
    delete map[accountKey];
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
