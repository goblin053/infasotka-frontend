import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageUp, Link2, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { apiRequest, getAccessToken } from '../shared/apiClient';
import { decodeJwtPayload } from '../shared/authToken';
import { avatarUrlLooksUsable, readProfileImageFileAsDataUrl } from '../shared/profileAvatar';
import { buildProfilePatchPayload, mergeProfileFromPatchResponse } from '../shared/profilePayload';

const palette = {
  pageBg: '#f8fafc',
  card: '#f1f5f9',
  cardInner: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#2f6bff',
  blueSoft: '#eaf1ff',
  green: '#16a34a',
};

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function GoogleMark() {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: '#fff',
        border: `1px solid ${palette.border}`,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: 16,
        color: '#4285F4',
      }}
      aria-hidden
    >
      G
    </span>
  );
}

function VkMark() {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: '#0077ff',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: 13,
      }}
      aria-hidden
    >
      VK
    </span>
  );
}

function colorFromId(id) {
  const palettePool = ['#6366f1', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];
  const s = String(id || '');
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) sum += s.charCodeAt(i);
  return palettePool[sum % palettePool.length];
}

export function StudentProfile({ user, onProfileUpdated, onOpenChat, tutors = [], tutorsLoading = false, tutorsError = '' }) {
  const avatarFileRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveInfo, setSaveInfo] = useState('');
  const [localAvatar, setLocalAvatar] = useState(() => String(user?.avatar || ''));
  const [form, setForm] = useState({
    name: user?.name || 'Алексей Смирнов',
    email: 'alexey@example.com',
    grade: '11 «А»',
  });
  const [googleLinked, setGoogleLinked] = useState(true);
  const [vkLinked, setVkLinked] = useState(false);

  /** Без GET профиля: имя из сессии, email из JWT. Обновление данных — только PATCH. */
  useEffect(() => {
    const payload = decodeJwtPayload(getAccessToken());
    const email = payload?.email || payload?.sub || '';
    setForm((prev) => ({
      ...prev,
      name: user?.name || prev.name,
      ...(email ? { email } : {}),
    }));
  }, [user?.name]);

  useEffect(() => {
    if (!isEditing) setLocalAvatar(String(user?.avatar || ''));
  }, [user?.avatar, isEditing]);

  const initials = useMemo(() => initialsFromName(form.name), [form.name]);
  const displayAvatar = isEditing ? localAvatar : String(user?.avatar || '');

  const cardStyle = {
    background: palette.card,
    border: `1px solid ${palette.border}`,
    borderRadius: 14,
    padding: '20px 22px',
    boxSizing: 'border-box',
  };

  const save = async () => {
    setSaveError('');
    setSaveInfo('');
    setIsSaving(true);
    try {
      const payload = buildProfilePatchPayload(form.name, localAvatar);
      const patchResponse = await apiRequest('/api/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const merged = mergeProfileFromPatchResponse(patchResponse, {
        name: payload.name,
        email: form.email,
        grade: form.grade,
        avatar: localAvatar,
      });
      const nextGrade =
        merged.grade !== undefined && merged.grade !== null ? String(merged.grade) : form.grade;
      setForm((prev) => ({
        ...prev,
        name: merged.name || payload.name,
        email: merged.email || prev.email,
        grade: nextGrade,
      }));
      onProfileUpdated?.({ name: merged.name || payload.name, avatar: merged.avatar });
      setIsEditing(false);
      setSaveInfo('Профиль сохранен');
    } catch (error) {
      setSaveError(error?.message || 'Не удалось сохранить профиль');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '20px 24px 32px',
        maxWidth: 1120,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        background: palette.pageBg,
      }}
    >
      <h1 style={{ margin: '0 0 20px', fontSize: 26, fontWeight: 800, color: palette.text }}>Настройки профиля</h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {/* Личная информация */}
        <section style={{ ...cardStyle, flex: '1 1 300px', maxWidth: 440, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: palette.text }}>Личная информация</h2>
            <button
              type="button"
              onClick={() => {
                if (isEditing) save();
                else {
                  setSaveError('');
                  setSaveInfo('');
                  setLocalAvatar(String(user?.avatar || ''));
                  setIsEditing(true);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 10,
                border: `1px solid ${palette.blue}`,
                background: '#fff',
                color: palette.blue,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Pencil size={16} strokeWidth={2} />
              {isEditing ? (isSaving ? 'Сохранение...' : 'Сохранить') : 'Редактировать профиль'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setSaveError('');
                try {
                  const dataUrl = await readProfileImageFileAsDataUrl(file);
                  setLocalAvatar(dataUrl);
                } catch (err) {
                  setSaveError(err?.message || 'Не удалось загрузить изображение');
                }
              }}
            />
            {avatarUrlLooksUsable(displayAvatar) ? (
              <img
                src={displayAvatar}
                alt={form.name}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 999,
                  objectFit: 'cover',
                  border: `3px solid ${palette.border}`,
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 999,
                  background: palette.blue,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 32,
                  letterSpacing: 0.02,
                }}
                aria-hidden
              >
                {initials}
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 15, color: palette.muted, fontWeight: 600 }}>{form.name}</div>
            {isEditing ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    background: '#fff',
                    color: palette.text,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <ImageUp size={16} strokeWidth={2} aria-hidden />
                  Загрузить фото
                </button>
                {avatarUrlLooksUsable(localAvatar) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSaveError('');
                      setLocalAvatar('');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: `1px solid ${palette.border}`,
                      background: '#fff',
                      color: palette.muted,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden />
                    Убрать фото
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px 28px',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: palette.muted, fontWeight: 600, marginBottom: 6 }}>Имя</div>
              {isEditing ? (
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    fontSize: 15,
                    color: palette.text,
                  }}
                />
              ) : (
                <div style={{ fontSize: 16, fontWeight: 600, color: palette.text }}>{form.name}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, color: palette.muted, fontWeight: 600, marginBottom: 6 }}>
                Email <span style={{ fontWeight: 500 }}>(только просмотр)</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: palette.text }}>{form.email}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 12, color: palette.muted, fontWeight: 600, marginBottom: 6 }}>Группа/Класс</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: palette.text }}>{form.grade}</div>
            </div>
          </div>

          {saveError ? <div style={{ marginTop: 12, color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{saveError}</div> : null}
          {saveInfo ? <div style={{ marginTop: 12, color: '#15803d', fontWeight: 600, fontSize: 13 }}>{saveInfo}</div> : null}

          {isEditing ? (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setSaveError('');
                setSaveInfo('');
                setLocalAvatar(String(user?.avatar || ''));
              }}
              style={{
                marginTop: 16,
                padding: '8px 14px',
                borderRadius: 10,
                border: `1px solid ${palette.border}`,
                background: '#fff',
                color: palette.muted,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
          ) : null}
        </section>

        {/* привязки + репетиторы */}
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: palette.text }}>Привязанные аккаунты</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  background: palette.cardInner,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <GoogleMark />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: palette.text }}>Google</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: googleLinked ? palette.green : palette.muted, marginTop: 2 }}>
                      {googleLinked ? 'Привязан' : 'Не привязан'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGoogleLinked((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: `1px solid ${googleLinked ? palette.border : palette.blue}`,
                    background: '#fff',
                    color: googleLinked ? palette.text : palette.blue,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <Link2 size={16} />
                  {googleLinked ? 'Отвязать' : 'Привязать'}
                </button>
              </div>

              <div
                style={{
                  background: palette.cardInner,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <VkMark />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: palette.text }}>VK</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: vkLinked ? palette.green : palette.muted, marginTop: 2 }}>
                      {vkLinked ? 'Привязан' : 'Не привязан'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVkLinked((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: `1px solid ${vkLinked ? palette.border : palette.blue}`,
                    background: '#fff',
                    color: vkLinked ? palette.text : palette.blue,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <Link2 size={16} />
                  {vkLinked ? 'Отвязать' : 'Привязать'}
                </button>
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: palette.text }}>Мои репетиторы</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tutorsLoading ? <div style={{ color: palette.muted }}>Загрузка репетиторов...</div> : null}
              {!tutorsLoading && tutorsError ? <div style={{ color: '#b91c1c' }}>{tutorsError}</div> : null}
              {!tutorsLoading && !tutorsError && tutors.length === 0 ? (
                <div style={{ color: palette.muted }}>Пока нет закрепленных репетиторов.</div>
              ) : null}
              {!tutorsLoading && !tutorsError && tutors.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: palette.cardInner,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {avatarUrlLooksUsable(t.avatar) ? (
                      <img
                        src={t.avatar}
                        alt={t.name}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 999,
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: `1px solid ${palette.border}`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 999,
                          background: colorFromId(t.id),
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                        aria-hidden
                      >
                        {initialsFromName(t.name)}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: palette.text }}>{t.name}</div>
                      <div style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>{t.specialization || 'Репетитор'}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenChat}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: `1px solid ${palette.blue}`,
                      background: '#fff',
                      color: palette.blue,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <MessageCircle size={16} strokeWidth={2} />
                    Написать
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenChat}
              style={{
                marginTop: 16,
                width: '100%',
                border: 0,
                borderRadius: 12,
                padding: '14px 16px',
                background: palette.blue,
                color: '#fff',
                fontWeight: 800,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Найти репетитора
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
