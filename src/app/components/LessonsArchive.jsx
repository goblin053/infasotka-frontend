import React, { useMemo, useRef, useState } from 'react';
import { CalendarClock, Paperclip, RefreshCw, Trash2, Video } from 'lucide-react';

const palette = {
  pageBg: '#f8fafc',
  card: '#f1f5f9',
  cardInner: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#2f6bff',
  green: '#0ea5a4',
  scheduled: '#3b82f6',
  danger: '#ef4444',
};

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function formatDateTimeMasked(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 12);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const hh = digits.slice(8, 10);
  const min = digits.slice(10, 12);

  let out = '';
  if (dd) out += dd;
  if (mm) out += `.${mm}`;
  if (yyyy) out += `.${yyyy}`;
  if (hh) out += ` ${hh}`;
  if (min) out += `:${min}`;
  return out;
}

/** Маска ДД.ММ.ГГГГ ЧЧ:ММ → { date: 'YYYY-MM-DD', time: 'HH:MM' } для POST /api/lessons */
function maskedRuDateTimeToDateAndTime(masked) {
  const digits = String(masked || '').replace(/\D/g, '');
  if (digits.length < 12) return null;
  const dd = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4, 8));
  const hh = Number(digits.slice(8, 10));
  const mi = Number(digits.slice(10, 12));
  const d = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    date: `${y}-${mo}-${day}`,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

function lessonScheduledDate(ev) {
  const [y, m, d] = String(ev.date || '').split('-').map((n) => Number(n));
  const [hh, mm] = String(ev.time || '').split(':').map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
}

function formatRuDateTimeLabel(ev) {
  const d = lessonScheduledDate(ev);
  if (!d || Number.isNaN(d.getTime())) return `${ev.date || ''} ${ev.time || ''}`.trim();
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function lessonIsPast(ev) {
  const d = lessonScheduledDate(ev);
  return d && !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function isHttpUrl(s) {
  const t = String(s || '').trim();
  return /^https?:\/\//i.test(t);
}

export function LessonsArchive({
  lessons = [],
  lessonsLoading = false,
  lessonsError = '',
  tutorStudents = [],
  tutorStudentsLoading = false,
  onAddLesson,
  onSetVideoLink,
  onDeleteLesson,
  onReloadLessons,
}) {
  const fileInputRef = useRef(null);
  const [filterStudentId, setFilterStudentId] = useState('all');
  const [form, setForm] = useState({
    studentId: '',
    datetime: '',
    topic: '',
    notes: '',
  });
  const [attachedFile, setAttachedFile] = useState(null);
  const [actionError, setActionError] = useState('');
  const [formPending, setFormPending] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState('');
  const [videoDraft, setVideoDraft] = useState({});
  const [videoSavingId, setVideoSavingId] = useState('');

  const sortedLessons = useMemo(() => {
    const list = Array.isArray(lessons) ? [...lessons] : [];
    return list.sort((a, b) => {
      const da = lessonScheduledDate(a);
      const db = lessonScheduledDate(b);
      const ta = da && !Number.isNaN(da.getTime()) ? da.getTime() : 0;
      const tb = db && !Number.isNaN(db.getTime()) ? db.getTime() : 0;
      return tb - ta;
    });
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    if (filterStudentId === 'all') return sortedLessons;
    return sortedLessons.filter((item) => String(item.studentId || '') === filterStudentId);
  }, [sortedLessons, filterStudentId]);

  const saveLesson = async () => {
    setActionError('');
    if (!onAddLesson) {
      setActionError('Добавление занятий недоступно.');
      return;
    }
    if (!form.studentId.trim()) {
      setActionError('Выберите ученика.');
      return;
    }
    const dtParts = maskedRuDateTimeToDateAndTime(form.datetime);
    if (!dtParts) {
      setActionError('Укажите дату и время полностью: ДД.ММ.ГГГГ ЧЧ:ММ');
      return;
    }
    if (!form.topic.trim()) {
      setActionError('Укажите тему занятия.');
      return;
    }
    setFormPending(true);
    try {
      let description = String(form.notes || '').trim();
      if (attachedFile?.name) {
        description = [description, `Материалы: ${attachedFile.name}`].filter(Boolean).join('\n\n');
      }
      await onAddLesson({
        date: dtParts.date,
        time: dtParts.time,
        studentId: form.studentId.trim(),
        title: form.topic.trim(),
        description,
      });
      setForm({ studentId: '', datetime: '', topic: '', notes: '' });
      setAttachedFile(null);
    } catch (e) {
      setActionError(e?.message || 'Не удалось сохранить занятие.');
    } finally {
      setFormPending(false);
    }
  };

  const removeLesson = async (lessonId) => {
    setActionError('');
    if (!onDeleteLesson) return;
    setDeletePendingId(String(lessonId));
    try {
      await onDeleteLesson(lessonId);
    } catch (e) {
      setActionError(e?.message || 'Не удалось удалить занятие.');
    } finally {
      setDeletePendingId('');
    }
  };

  const saveVideoLink = async (lessonId) => {
    setActionError('');
    if (!onSetVideoLink) {
      setActionError('Сохранение ссылки на видео недоступно.');
      return;
    }
    const raw = videoDraft[lessonId] != null ? String(videoDraft[lessonId]) : '';
    if (!isHttpUrl(raw)) {
      setActionError('Введите корректную ссылку на видео (начинается с http:// или https://).');
      return;
    }
    setVideoSavingId(String(lessonId));
    try {
      await onSetVideoLink(lessonId, raw);
      setVideoDraft((prev) => {
        const next = { ...prev };
        delete next[lessonId];
        return next;
      });
    } catch (e) {
      setActionError(e?.message || 'Не удалось сохранить ссылку на видео.');
    } finally {
      setVideoSavingId('');
    }
  };

  const videoInputValue = (lesson) => {
    const id = lesson.id;
    if (Object.prototype.hasOwnProperty.call(videoDraft, id)) return videoDraft[id];
    return lesson.videoLessonLink || '';
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: palette.pageBg, padding: '20px 22px 30px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', width: '100%', display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0, color: palette.text, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>Занятия и архив</h1>
          <button
            type="button"
            onClick={() => onReloadLessons?.()}
            disabled={lessonsLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 10,
              border: `1px solid ${palette.border}`,
              background: '#fff',
              color: palette.text,
              fontWeight: 700,
              fontSize: 13,
              cursor: lessonsLoading ? 'wait' : 'pointer',
            }}
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden />
            Обновить список
          </button>
        </div>

        {lessonsError ? (
          <div style={{ padding: 12, borderRadius: 10, background: '#fff1f2', color: '#9f1239', fontWeight: 600, fontSize: 14 }}>{lessonsError}</div>
        ) : null}
        {lessonsLoading && !sortedLessons.length ? (
          <div style={{ color: palette.muted, fontWeight: 600 }}>Загрузка занятий...</div>
        ) : null}

        <section style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 14, padding: '18px 18px 16px' }}>
          <h2 style={{ margin: '0 0 12px', color: palette.text, fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>Записать занятие</h2>
          <p style={{ margin: '0 0 16px', color: palette.muted, fontSize: 13, lineHeight: 1.45 }}>
            Создайте запись о прошедшем или запланированном занятии: оно появится у вас и у ученика в расписании. После проведения урока добавьте ссылку на запись ниже в карточке занятия.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: palette.text, fontWeight: 700 }}>Ученик *</span>
              <select
                value={form.studentId}
                onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))}
                disabled={tutorStudentsLoading || !tutorStudents.length}
                style={{ width: '100%', border: `1px solid ${palette.border}`, borderRadius: 10, padding: '10px 12px', background: '#fff' }}
              >
                <option value="">{tutorStudentsLoading ? 'Загрузка...' : tutorStudents.length ? 'Выберите ученика' : 'Нет учеников в списке'}</option>
                {tutorStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: palette.text, fontWeight: 700 }}>Дата и время *</span>
              <input
                value={form.datetime}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    datetime: formatDateTimeMasked(e.target.value),
                  }))
                }
                inputMode="numeric"
                maxLength={16}
                placeholder="дд.мм.гггг чч:мм"
                style={{ width: '100%', border: `1px solid ${palette.border}`, borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
            <span style={{ fontSize: 13, color: palette.text, fontWeight: 700 }}>Тема занятия *</span>
            <input
              value={form.topic}
              onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="Например: Динамическое программирование"
              style={{ width: '100%', border: `1px solid ${palette.border}`, borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
            <span style={{ fontSize: 13, color: palette.text, fontWeight: 700 }}>Краткая информация / тезисы</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Опишите ключевые моменты занятия, достижения ученика, домашнее задание..."
              style={{ width: '100%', minHeight: 96, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'block', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: palette.text, fontWeight: 700, display: 'block', marginBottom: 6 }}>Материалы</span>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => setAttachedFile(e.target.files?.[0] || null)} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                border: `1px solid ${palette.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                background: '#fff',
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                color: palette.muted,
                cursor: 'pointer',
                boxSizing: 'border-box',
                fontSize: 14,
              }}
            >
              <Paperclip size={16} aria-hidden />
              {attachedFile ? attachedFile.name : 'Прикрепить файл (имя файла добавится в описание)'}
            </button>
          </label>

          {actionError ? (
            <div style={{ marginTop: 12, color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{actionError}</div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              type="button"
              onClick={saveLesson}
              disabled={formPending}
              style={{
                border: 0,
                borderRadius: 10,
                background: palette.blue,
                color: '#fff',
                fontWeight: 700,
                padding: '10px 18px',
                cursor: formPending ? 'wait' : 'pointer',
                opacity: formPending ? 0.75 : 1,
              }}
            >
              {formPending ? 'Сохранение...' : 'Сохранить занятие'}
            </button>
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: palette.text, fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>Архив занятий</h2>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, color: palette.muted, fontWeight: 600 }}>Фильтр по ученику:</span>
            <select
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '9px 12px', background: '#fff' }}
            >
              <option value="all">Все ученики</option>
              {tutorStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!filteredLessons.length && !lessonsLoading ? (
          <div style={{ color: palette.muted, fontWeight: 600, fontSize: 14 }}>Пока нет занятий. Создайте первое занятие формой выше.</div>
        ) : null}

        <div style={{ display: 'grid', gap: 14 }}>
          {filteredLessons.map((lesson) => {
            const past = lessonIsPast(lesson);
            const studentLabel = lesson.student || 'Ученик';
            return (
              <article key={lesson.id} style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 999,
                        background: palette.blue,
                        color: '#fff',
                        fontWeight: 800,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                      aria-hidden
                    >
                      {initialsFromName(studentLabel)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: palette.text, fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{lesson.title}</div>
                      <div style={{ color: palette.muted, fontSize: 14, marginTop: 4, lineHeight: 1.25 }}>
                        {studentLabel} <span style={{ margin: '0 8px' }}>•</span> {formatRuDateTimeLabel(lesson)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: past ? palette.green : palette.scheduled,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      <CalendarClock size={18} aria-hidden />
                      {past ? 'Прошедшее' : 'Запланировано'}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLesson(lesson.id)}
                      disabled={deletePendingId === String(lesson.id)}
                      style={{
                        border: `1px solid ${palette.border}`,
                        background: '#fff',
                        color: palette.danger,
                        borderRadius: 10,
                        width: 32,
                        height: 32,
                        cursor: deletePendingId === String(lesson.id) ? 'wait' : 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 0,
                      }}
                      aria-label="Удалить занятие"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {lesson.description ? (
                  <p style={{ margin: '16px 0 0', color: palette.text, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{lesson.description}</p>
                ) : null}

                {lesson.meetingLink && isHttpUrl(lesson.meetingLink) ? (
                  <div style={{ marginTop: 12 }}>
                    <a href={lesson.meetingLink} target="_blank" rel="noopener noreferrer" style={{ color: palette.blue, fontWeight: 700, fontSize: 14 }}>
                      Ссылка на встречу (онлайн)
                    </a>
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 12,
                    border: `1px solid ${palette.border}`,
                    background: palette.cardInner,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: palette.text, fontWeight: 800, fontSize: 14 }}>
                    <Video size={18} aria-hidden />
                    Запись занятия
                  </div>
                  <p style={{ margin: '0 0 10px', color: palette.muted, fontSize: 12, lineHeight: 1.4 }}>
                    После сохранения ссылка будет доступна вам и ученику в расписании (карточка занятия).
                  </p>
                  {lesson.videoLessonLink && isHttpUrl(lesson.videoLessonLink) ? (
                    <div style={{ marginBottom: 10 }}>
                      <a href={lesson.videoLessonLink} target="_blank" rel="noopener noreferrer" style={{ color: palette.blue, fontWeight: 700, fontSize: 14 }}>
                        Открыть видеозапись
                      </a>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: palette.muted, marginBottom: 10 }}>Ссылка на видео ещё не добавлена.</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <input
                      type="url"
                      inputMode="url"
                      placeholder="https://…"
                      value={videoInputValue(lesson)}
                      onChange={(e) =>
                        setVideoDraft((prev) => ({
                          ...prev,
                          [lesson.id]: e.target.value,
                        }))
                      }
                      style={{
                        flex: '1 1 220px',
                        minWidth: 0,
                        border: `1px solid ${palette.border}`,
                        borderRadius: 10,
                        padding: '9px 12px',
                        fontSize: 14,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveVideoLink(lesson.id)}
                      disabled={videoSavingId === String(lesson.id)}
                      style={{
                        border: 0,
                        borderRadius: 10,
                        background: palette.blue,
                        color: '#fff',
                        fontWeight: 700,
                        padding: '9px 16px',
                        cursor: videoSavingId === String(lesson.id) ? 'wait' : 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {videoSavingId === String(lesson.id) ? 'Сохранение...' : 'Сохранить ссылку'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
