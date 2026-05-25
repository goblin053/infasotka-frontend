import React, { useMemo, useRef, useState } from 'react';
import { CalendarClock, Paperclip, Pencil, RefreshCw, Trash2, Video, X } from 'lucide-react';

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

const MATERIALS_MARKER = '\n\nМатериалы:';

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
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

function splitDescription(description) {
  const raw = String(description || '');
  const idx = raw.indexOf(MATERIALS_MARKER);
  if (idx === -1) return { notes: raw.trim(), materials: '' };
  return {
    notes: raw.slice(0, idx).trim(),
    materials: raw.slice(idx + MATERIALS_MARKER.length).trim(),
  };
}

function buildDescription(notes, materialsLabel) {
  const body = String(notes || '').trim();
  const mat = String(materialsLabel || '').trim();
  if (!mat) return body;
  return [body, `Материалы: ${mat}`].filter(Boolean).join(MATERIALS_MARKER);
}

function lessonEditDraftFromLesson(lesson) {
  const { notes, materials } = splitDescription(lesson.description);
  return {
    topic: lesson.title || '',
    notes,
    materialsLabel: materials,
    newFile: null,
  };
}

export function LessonsArchive({
  lessons = [],
  lessonsLoading = false,
  lessonsError = '',
  tutorStudents = [],
  onUpdateLesson,
  onSetVideoLink,
  onDeleteLesson,
  onReloadLessons,
}) {
  const fileInputRefs = useRef({});
  const [filterStudentId, setFilterStudentId] = useState('all');
  const [actionError, setActionError] = useState('');
  const [deletePendingId, setDeletePendingId] = useState('');
  const [videoDraft, setVideoDraft] = useState({});
  const [videoSavingId, setVideoSavingId] = useState('');
  const [editingLessonId, setEditingLessonId] = useState('');
  const [editDraft, setEditDraft] = useState({});
  const [editPendingId, setEditPendingId] = useState('');

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

  const startEdit = (lesson) => {
    setActionError('');
    setEditingLessonId(String(lesson.id));
    setEditDraft((prev) => ({
      ...prev,
      [lesson.id]: lessonEditDraftFromLesson(lesson),
    }));
  };

  const cancelEdit = (lessonId) => {
    setEditingLessonId('');
    setEditDraft((prev) => {
      const next = { ...prev };
      delete next[lessonId];
      return next;
    });
  };

  const updateEditField = (lessonId, field, value) => {
    setEditDraft((prev) => ({
      ...prev,
      [lessonId]: {
        ...(prev[lessonId] || {}),
        [field]: value,
      },
    }));
  };

  const saveLessonEdit = async (lesson) => {
    setActionError('');
    if (!onUpdateLesson) {
      setActionError('Редактирование занятий недоступно.');
      return;
    }
    const draft = editDraft[lesson.id] || lessonEditDraftFromLesson(lesson);
    if (!String(draft.topic || '').trim()) {
      setActionError('Укажите тему занятия.');
      return;
    }
    const materialsName = draft.newFile?.name || draft.materialsLabel || '';
    const description = buildDescription(draft.notes, materialsName);

    setEditPendingId(String(lesson.id));
    try {
      await onUpdateLesson(lesson.id, {
        title: String(draft.topic).trim(),
        description,
      });
      cancelEdit(lesson.id);
    } catch (e) {
      setActionError(e?.message || 'Не удалось сохранить изменения.');
    } finally {
      setEditPendingId('');
    }
  };

  const removeLesson = async (lessonId) => {
    setActionError('');
    if (!onDeleteLesson) return;
    setDeletePendingId(String(lessonId));
    try {
      await onDeleteLesson(lessonId);
      if (String(editingLessonId) === String(lessonId)) cancelEdit(lessonId);
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

  const inputStyle = {
    width: '100%',
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    boxSizing: 'border-box',
    fontSize: 14,
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: palette.pageBg, padding: '20px 22px 30px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', width: '100%', display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, color: palette.text, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>Занятия</h1>
            <p style={{ margin: '8px 0 0', color: palette.muted, fontSize: 14, lineHeight: 1.4 }}>
              Прошедшие и предстоящие занятия подгружаются из расписания автоматически.
            </p>
          </div>
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
        {actionError ? (
          <div style={{ padding: 12, borderRadius: 10, background: '#fff1f2', color: '#9f1239', fontWeight: 600, fontSize: 14 }}>{actionError}</div>
        ) : null}
        {lessonsLoading && !sortedLessons.length ? (
          <div style={{ color: palette.muted, fontWeight: 600 }}>Загрузка занятий...</div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: palette.text, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>Список занятий</h2>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: palette.muted, fontWeight: 600 }}>Фильтр по ученику:</span>
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
          <div style={{ color: palette.muted, fontWeight: 600, fontSize: 14 }}>
            Занятий пока нет. Они появятся здесь после создания в календаре на панели репетитора.
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 14 }}>
          {filteredLessons.map((lesson) => {
            const past = lessonIsPast(lesson);
            const studentLabel = lesson.student || 'Ученик';
            const isEditing = String(editingLessonId) === String(lesson.id);
            const draft = editDraft[lesson.id] || lessonEditDraftFromLesson(lesson);
            const displayDescription = splitDescription(lesson.description);

            return (
              <article key={lesson.id} style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 12, minWidth: 0, flex: '1 1 280px' }}>
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
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {isEditing ? (
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: palette.muted }}>Тема занятия</span>
                          <input
                            value={draft.topic}
                            onChange={(e) => updateEditField(lesson.id, 'topic', e.target.value)}
                            style={inputStyle}
                          />
                        </label>
                      ) : (
                        <div style={{ color: palette.text, fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{lesson.title}</div>
                      )}
                      <div style={{ color: palette.muted, fontSize: 14, marginTop: isEditing ? 10 : 4, lineHeight: 1.25 }}>
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
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEdit(lesson)}
                        style={{
                          border: `1px solid ${palette.border}`,
                          background: '#fff',
                          color: palette.text,
                          borderRadius: 10,
                          height: 32,
                          padding: '0 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        <Pencil size={14} aria-hidden />
                        Редактировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => cancelEdit(lesson.id)}
                        style={{
                          border: `1px solid ${palette.border}`,
                          background: '#fff',
                          color: palette.muted,
                          borderRadius: 10,
                          width: 32,
                          height: 32,
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          padding: 0,
                        }}
                        aria-label="Отменить редактирование"
                      >
                        <X size={15} />
                      </button>
                    )}
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

                {isEditing ? (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 12,
                      border: `1px solid ${palette.border}`,
                      background: palette.cardInner,
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>Описание / тезисы</span>
                      <textarea
                        value={draft.notes}
                        onChange={(e) => updateEditField(lesson.id, 'notes', e.target.value)}
                        placeholder="Ключевые моменты занятия, домашнее задание..."
                        style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
                      />
                    </label>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: palette.text, display: 'block', marginBottom: 6 }}>Материалы</span>
                      <input
                        ref={(el) => {
                          fileInputRefs.current[lesson.id] = el;
                        }}
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(e) => updateEditField(lesson.id, 'newFile', e.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[lesson.id]?.click()}
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
                        {draft.newFile
                          ? draft.newFile.name
                          : draft.materialsLabel || 'Прикрепить файл (имя добавится в описание)'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => saveLessonEdit(lesson)}
                        disabled={editPendingId === String(lesson.id)}
                        style={{
                          border: 0,
                          borderRadius: 10,
                          background: palette.blue,
                          color: '#fff',
                          fontWeight: 700,
                          padding: '10px 18px',
                          cursor: editPendingId === String(lesson.id) ? 'wait' : 'pointer',
                          opacity: editPendingId === String(lesson.id) ? 0.75 : 1,
                        }}
                      >
                        {editPendingId === String(lesson.id) ? 'Сохранение...' : 'Сохранить изменения'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {displayDescription.notes ? (
                      <p style={{ margin: '16px 0 0', color: palette.text, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                        {displayDescription.notes}
                      </p>
                    ) : null}
                    {displayDescription.materials ? (
                      <p style={{ margin: '8px 0 0', color: palette.muted, fontSize: 13, lineHeight: 1.4 }}>
                        <strong style={{ color: palette.text }}>Материалы:</strong> {displayDescription.materials}
                      </p>
                    ) : null}
                  </>
                )}

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
                    После сохранения ссылка будет доступна вам и ученику в расписании.
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
