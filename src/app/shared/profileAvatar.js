/** Макс. размер файла аватара перед отправкой в PATCH (data URL). */
export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function avatarUrlLooksUsable(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  return /^https?:\/\//i.test(u) || u.startsWith('data:') || u.startsWith('/');
}

/**
 * Читает локальный файл картинки в data URL (для поля avatar в PATCH /api/users/profile).
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readProfileImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof Blob)) {
      reject(new Error('Выберите файл изображения.'));
      return;
    }
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type || '')) {
      reject(new Error('Допустимы только форматы JPEG, PNG, GIF или WebP.'));
      return;
    }
    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      reject(new Error(`Файл слишком большой (максимум ${Math.round(PROFILE_AVATAR_MAX_BYTES / 1024 / 1024)} МБ).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        reject(new Error('Не удалось прочитать изображение.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });
}
