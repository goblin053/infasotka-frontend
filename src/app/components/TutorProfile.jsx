import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ImageUp, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
};

const languageOptions = ['Python', 'Java', 'C++', 'C#', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'SQL'];

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || 'Р').toUpperCase();
}

function lessonDateTime(item) {
  const iso = `${item?.date || ''}T${item?.time || '00:00'}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function lessonDayLabel(dateObj) {
  if (!dateObj) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const dayDiff = Math.round((startTarget - startToday) / 86400000);
  if (dayDiff === 0) return 'Сегодня';
  if (dayDiff === 1) return 'Завтра';
  return dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function TutorProfile({ user, onProfileUpdated, onOpenChat, scheduleEvents = [], scheduleLoading = false }) {
  const navigate = useNavigate();
  const avatarFileRef = useRef(null);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingProfessional, setIsEditingProfessional] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState(true);

  const [personal, setPersonal] = useState({
    name: user?.name || 'Дмитрий Иванов',
    email: 'dmitry@example.com',
    phone: '+7 (999) 123-45-67',
  });
  const [professional, setProfessional] = useState({
    specialization: 'Эксперт ЕГЭ по информатике, стаж 7 лет',
    languages: ['Python', 'Java'],
  });
  const [selectedLanguage, setSelectedLanguage] = useState(languageOptions[0]);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveInfo, setSaveInfo] = useState('');
  const [localAvatar, setLocalAvatar] = useState(() => String(user?.avatar || ''));

  const initials = useMemo(() => initialsFromName(personal.name), [personal.name]);
  const upcomingLessons = useMemo(() => {
    const now = new Date();
    return (Array.isArray(scheduleEvents) ? scheduleEvents : [])
      .map((item) => ({ ...item, dt: lessonDateTime(item) }))
      .filter((item) => item.dt && item.dt >= now)
      .sort((a, b) => a.dt - b.dt)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        dayLabel: lessonDayLabel(item.dt),
        time: item.time || item.dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        student: item.student || 'Ученик',
        subject: item.title || 'Занятие',
      }));
  }, [scheduleEvents]);

  useEffect(() => {
    const payload = decodeJwtPayload(getAccessToken());
    const email = payload?.email || payload?.sub || '';
    setPersonal((prev) => ({
      ...prev,
      name: user?.name || prev.name,
      ...(email ? { email } : {}),
    }));
  }, [user?.name]);

  useEffect(() => {
    if (!isEditingPersonal) setLocalAvatar(String(user?.avatar || ''));
  }, [user?.avatar, isEditingPersonal]);

  const cardStyle = {
    background: palette.card,
    border: `1px solid ${palette.border}`,
    borderRadius: 14,
    padding: '20px 22px',
    boxSizing: 'border-box',
  };

  const addLanguage = () => {
    if (professional.languages.includes(selectedLanguage)) return;
    setProfessional((prev) => ({ ...prev, languages: [...prev.languages, selectedLanguage] }));
  };

  const removeLanguage = (lang) => {
    setProfessional((prev) => ({ ...prev, languages: prev.languages.filter((x) => x !== lang) }));
  };

  const togglePersonalEdit = async () => {
    if (!isEditingPersonal) {
      setSaveError('');
      setSaveInfo('');
      setLocalAvatar(String(user?.avatar || ''));
      setIsEditingPersonal(true);
      return;
    }

    setSaveError('');
    setSaveInfo('');
    setIsSavingPersonal(true);
    try {
      const payload = buildProfilePatchPayload(personal.name, localAvatar);
      const patchResponse = await apiRequest('/api/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const merged = mergeProfileFromPatchResponse(patchResponse, {
        name: payload.name,
        email: personal.email,
        phone: personal.phone,
        avatar: localAvatar,
      });
      setPersonal((prev) => ({
        ...prev,
        name: merged.name || payload.name,
        email: merged.email || prev.email,
        phone: merged.phone !== '' ? merged.phone : prev.phone,
      }));
      onProfileUpdated?.({ name: merged.name || payload.name, avatar: merged.avatar });
      setIsEditingPersonal(false);
      setSaveInfo('Профиль сохранен');
    } catch (error) {
      setSaveError(error?.message || 'Не удалось сохранить профиль');
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const displayAvatar = isEditingPersonal ? localAvatar : String(user?.avatar || '');

  return (
    <main
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '20px 24px 32px',
        maxWidth: 1240,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        background: palette.pageBg,
      }}
    >
      <h1 style={{ margin: '0 0 20px', fontSize: 36, fontWeight: 800, color: palette.text }}>Настройки профиля</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch', justifyContent: 'center' }}>
        <section style={{ ...cardStyle, flex: '1 1 390px', maxWidth: 470, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: palette.text }}>Личная информация</h2>
            <button
              type="button"
              onClick={togglePersonalEdit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, border: `1px solid ${palette.blue}`, background: '#fff', color: palette.blue, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              <Pencil size={16} />
              {isEditingPersonal ? (isSavingPersonal ? 'Сохранение...' : 'Сохранить') : 'Редактировать профиль'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
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
                alt={personal.name}
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
                }}
                aria-hidden
              >
                {initials}
              </div>
            )}
            <div style={{ marginTop: 10, color: palette.muted, fontWeight: 600 }}>{personal.name}</div>
            {isEditingPersonal ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
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
                      padding: '6px 12px',
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
            <div>
              <div style={{ fontSize: 14, color: palette.text, fontWeight: 700, marginBottom: 6 }}>Имя</div>
              {isEditingPersonal ? (
                <input value={personal.name} onChange={(e) => setPersonal((p) => ({ ...p, name: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }} />
              ) : (
                <div style={{ color: palette.text }}>{personal.name}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 14, color: palette.text, fontWeight: 700, marginBottom: 6 }}>
                Email <span style={{ color: palette.muted, fontWeight: 600 }}>(только просмотр)</span>
              </div>
              <div style={{ color: palette.text }}>{personal.email}</div>
            </div>
            <div style={{ gridColumn: '1 / 2' }}>
              <div style={{ fontSize: 14, color: palette.text, fontWeight: 700, marginBottom: 6 }}>
                Телефон <span style={{ color: palette.muted, fontWeight: 600 }}>(только просмотр)</span>
              </div>
              <div style={{ color: palette.text }}>{personal.phone}</div>
            </div>
          </div>
          {saveError ? <div style={{ marginTop: 12, color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{saveError}</div> : null}
          {saveInfo ? <div style={{ marginTop: 12, color: '#15803d', fontWeight: 600, fontSize: 13 }}>{saveInfo}</div> : null}
        </section>

        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'grid', gap: 16, maxWidth: 740 }}>
          <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: palette.text }}>Профессиональная информация</h2>
              <button
                type="button"
                onClick={() => setIsEditingProfessional((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 10,
                  border: `1px solid ${palette.blue}`,
                  background: '#fff',
                  color: palette.blue,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Pencil size={16} />
                {isEditingProfessional ? 'Закончить редактирование' : 'Редактировать специализацию'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontSize: 14, color: palette.text, fontWeight: 700, marginBottom: 6 }}>Специализация</div>
                {isEditingProfessional ? (
                  <input
                    value={professional.specialization}
                    onChange={(e) => setProfessional((p) => ({ ...p, specialization: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }}
                  />
                ) : (
                  <div style={{ color: palette.text }}>{professional.specialization}</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 14, color: palette.text, fontWeight: 700, marginBottom: 6 }}>Основные языки программирования</div>
                {isEditingProfessional ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        style={{ flex: 1, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '10px 12px', background: '#fff' }}
                      >
                        {languageOptions.map((lang) => (
                          <option key={lang} value={lang}>
                            {lang}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addLanguage}
                        style={{ border: `1px solid ${palette.blue}`, borderRadius: 10, background: '#fff', color: palette.blue, fontWeight: 700, padding: '0 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Plus size={16} /> Добавить
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {professional.languages.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => removeLanguage(lang)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 999, background: palette.blue, color: '#fff', fontSize: 13, fontWeight: 700, padding: '5px 10px', cursor: 'pointer' }}
                          title="Удалить язык"
                        >
                          {lang}
                          <X size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {professional.languages.map((lang) => (
                      <span key={lang} style={{ padding: '5px 10px', borderRadius: 999, background: palette.blue, color: '#fff', fontSize: 13, fontWeight: 700 }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* По просьбе: форму "Публичный профиль" пока не добавляем */}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 800, color: palette.text }}>Безопасность</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ background: palette.cardInner, border: `1px solid ${palette.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eaf1ff', color: palette.blue, display: 'grid', placeItems: 'center' }}>
                    <Lock size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: palette.text }}>Пароль</div>
                    <div style={{ color: palette.muted }}>Последнее изменение: 10 апреля 2026</div>
                  </div>
                </div>
                <button type="button" style={{ borderRadius: 10, border: `1px solid ${palette.blue}`, background: '#fff', color: palette.blue, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>
                  Сменить пароль
                </button>
              </div>

              <label style={{ background: palette.cardInner, border: `1px solid ${palette.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" checked={twoFactorEmail} onChange={(e) => setTwoFactorEmail(e.target.checked)} style={{ marginTop: 4 }} />
                <span>
                  <strong style={{ color: palette.text }}>Подтверждать вход по email при новой авторизации</strong>
                  <br />
                  <span style={{ color: palette.muted }}>Дополнительная защита от несанкционированного доступа</span>
                </span>
              </label>
            </div>
          </section>
        </div>
      </div>

      <section style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 800, color: palette.text }}>Ближайшие занятия</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {scheduleLoading ? <div style={{ color: palette.muted }}>Загрузка занятий...</div> : null}
          {!scheduleLoading && upcomingLessons.length === 0 ? (
            <div style={{ color: palette.muted }}>Пока нет запланированных занятий.</div>
          ) : null}
          {!scheduleLoading && upcomingLessons.map((item) => (
            <article key={item.id} style={{ background: palette.cardInner, border: `1px solid ${palette.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 72, height: 58, borderRadius: 12, background: '#eaf1ff', color: palette.blue, textAlign: 'center', lineHeight: 1.1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{item.dayLabel}</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{item.time}</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>{item.student}</div>
                  <div style={{ color: palette.muted }}>{item.subject}</div>
                </div>
              </div>
              <Calendar size={18} color={palette.muted} />
            </article>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate('/tutor/dashboard')}
          style={{ marginTop: 16, width: '100%', borderRadius: 12, border: `1px solid ${palette.blue}`, background: '#fff', color: palette.blue, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}
        >
          Перейти к расписанию
        </button>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={onOpenChat}
            style={{ border: 0, borderRadius: 10, background: palette.blue, color: '#fff', padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}
          >
            Написать ученику
          </button>
        </div>
      </section>
    </main>
  );
}
