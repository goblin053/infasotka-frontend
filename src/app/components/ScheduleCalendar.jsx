import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

const palette = {
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#3b82f6',
  blueSoft: '#eff6ff',
};

const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ScheduleCalendar({
  title,
  events = [],
  canAdd = false,
  canEditLink = false,
  canDelete = false,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onFetchLessonDetails,
  lessonStudentOptions,
}) {
  const lessonDetailsTargetId = useRef(null);
  const [currentMonth, setCurrentMonth] = useState(monthStart(new Date()));
  const [newLesson, setNewLesson] = useState({
    date: '',
    time: '',
    title: '',
    student: '',
    studentId: '',
    description: '',
  });
  const [addLessonPending, setAddLessonPending] = useState(false);
  const [addLessonError, setAddLessonError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSavePending, setLinkSavePending] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const studentPicker = lessonStudentOptions !== undefined && lessonStudentOptions !== null;
  const hasStudentChoices = studentPicker && lessonStudentOptions.length > 0;

  const days = useMemo(() => {
    const first = monthStart(currentMonth);
    const startWeekDay = (first.getDay() + 6) % 7;
    const startDate = new Date(first);
    startDate.setDate(first.getDate() - startWeekDay);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + index);
      return day;
    });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((item) => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    return map;
  }, [events]);

  const addLesson = async (event) => {
    event.preventDefault();
    setAddLessonError('');
    if (!newLesson.date || !newLesson.time || !newLesson.title) {
      setAddLessonError('Заполните дату, время и тему.');
      return;
    }
    if (studentPicker && !hasStudentChoices) {
      setAddLessonError('Список учеников пуст — занятие можно добавить после загрузки учеников.');
      return;
    }
    if (hasStudentChoices && !String(newLesson.studentId || '').trim()) {
      setAddLessonError('Выберите ученика.');
      return;
    }
    const payload = {
      date: newLesson.date,
      time: newLesson.time,
      title: newLesson.title.trim(),
      description: String(newLesson.description || '').trim(),
      studentId: hasStudentChoices ? String(newLesson.studentId).trim() : '',
      student: hasStudentChoices ? '' : newLesson.student || 'Без ученика',
    };
    setAddLessonPending(true);
    try {
      const maybePromise = onAddEvent?.(payload);
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }
      setNewLesson({ date: '', time: '', title: '', student: '', studentId: '', description: '' });
    } catch (e) {
      setAddLessonError(e?.message || 'Не удалось добавить занятие.');
    } finally {
      setAddLessonPending(false);
    }
  };

  const openEvent = (item) => {
    lessonDetailsTargetId.current = item.id != null ? String(item.id) : null;
    setSelectedEvent(item);
    setLinkDraft(item.meetingLink || '');
    setLinkError('');
    setCopyStatus('');
    setDeleteError('');
    setDeletePending(false);
    setDetailError('');
    setDetailLoading(false);

    if (!onFetchLessonDetails || !lessonDetailsTargetId.current) {
      return;
    }

    setDetailLoading(true);
    const targetId = lessonDetailsTargetId.current;
    const maybePromise = onFetchLessonDetails(targetId);
    if (!maybePromise || typeof maybePromise.then !== 'function') {
      setDetailLoading(false);
      return;
    }
    maybePromise
      .then((fresh) => {
        if (lessonDetailsTargetId.current !== targetId || !fresh) return;
        setSelectedEvent((prev) => {
          if (!prev || String(prev.id) !== String(fresh.id)) return prev;
          return { ...prev, ...fresh };
        });
        setLinkDraft(String(fresh.meetingLink || '').trim());
      })
      .catch((e) => {
        if (lessonDetailsTargetId.current !== targetId) return;
        setDetailError(e?.message || 'Не удалось загрузить занятие');
      })
      .finally(() => {
        if (lessonDetailsTargetId.current === targetId) {
          setDetailLoading(false);
        }
      });
  };

  const closeEvent = () => {
    lessonDetailsTargetId.current = null;
    setSelectedEvent(null);
    setLinkDraft('');
    setLinkError('');
    setCopyStatus('');
    setDeleteError('');
    setDeletePending(false);
    setDetailLoading(false);
    setDetailError('');
  };

  const isValidMeetingUrl = (value) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const saveLink = async () => {
    if (!selectedEvent) return;
    const normalized = linkDraft.trim();
    if (!isValidMeetingUrl(normalized)) {
      setLinkError('Введите корректную ссылку в формате http(s)://...');
      return;
    }
    setLinkError('');
    setLinkSavePending(true);
    try {
      const maybePromise = onUpdateEvent?.(selectedEvent.id, { meetingLink: normalized });
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }
      setSelectedEvent((prev) => (prev ? { ...prev, meetingLink: normalized } : prev));
      setCopyStatus('');
    } catch (e) {
      setLinkError(e?.message || 'Не удалось сохранить ссылку.');
    } finally {
      setLinkSavePending(false);
    }
  };

  const confirmDeleteLesson = async () => {
    if (!selectedEvent || !onDeleteEvent) return;
    if (!window.confirm('Удалить это занятие из расписания?')) return;
    setDeleteError('');
    setDeletePending(true);
    try {
      const maybePromise = onDeleteEvent(selectedEvent.id);
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }
      closeEvent();
    } catch (e) {
      setDeleteError(e?.message || 'Не удалось удалить занятие.');
    } finally {
      setDeletePending(false);
    }
  };

  const copyLink = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus('Ссылка скопирована');
    } catch {
      setCopyStatus('Не удалось скопировать ссылку');
    }
  };

  return (
    <section
      style={{
        background: palette.card,
        border: `1px solid ${palette.border}`,
        borderRadius: 14,
        padding: '16px 16px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: palette.text }}>{title}</h2>
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${palette.border}`, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft size={16} />
          </button>
          <strong style={{ minWidth: 150, textAlign: 'center', textTransform: 'capitalize', color: palette.text }}>
            {monthFormatter.format(currentMonth)}
          </strong>
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${palette.border}`, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            aria-label="Следующий месяц"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
          <div key={day} style={{ fontSize: 12, color: palette.muted, fontWeight: 700, textAlign: 'center' }}>
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const items = eventsByDate[dateKey] || [];
          const inCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = sameDay(day, new Date());
          return (
            <div
              key={dateKey}
              style={{
                minHeight: 88,
                borderRadius: 10,
                border: `1px solid ${isToday ? palette.blue : palette.border}`,
                background: isToday ? palette.blueSoft : '#fff',
                padding: '6px 6px 5px',
                opacity: inCurrentMonth ? 1 : 0.45,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: palette.text, marginBottom: 5 }}>{day.getDate()}</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {items.slice(0, 2).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openEvent(item)}
                    title={`${item.time} • ${item.title}`}
                    style={{
                      fontSize: 11,
                      borderRadius: 7,
                      padding: '2px 6px',
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      border: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {item.time} {item.student ? `• ${item.student}` : ''}
                  </button>
                ))}
                {items.length > 2 && <div style={{ fontSize: 11, color: palette.muted }}>+{items.length - 2} еще</div>}
              </div>
            </div>
          );
        })}
      </div>

      {canAdd && (
        <form
          onSubmit={addLesson}
          style={{
            marginTop: 14,
            borderTop: `1px solid ${palette.border}`,
            paddingTop: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: palette.muted, fontWeight: 700 }}>
            Дата
            <input
              type="date"
              value={newLesson.date}
              onChange={(e) => setNewLesson((prev) => ({ ...prev, date: e.target.value }))}
              style={{ borderRadius: 9, border: `1px solid ${palette.border}`, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: palette.muted, fontWeight: 700 }}>
            Время
            <input
              type="time"
              value={newLesson.time}
              onChange={(e) => setNewLesson((prev) => ({ ...prev, time: e.target.value }))}
              style={{ borderRadius: 9, border: `1px solid ${palette.border}`, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: palette.muted, fontWeight: 700 }}>
            Тема
            <input
              type="text"
              placeholder="Например, Алгоритмы"
              value={newLesson.title}
              onChange={(e) => setNewLesson((prev) => ({ ...prev, title: e.target.value }))}
              style={{ borderRadius: 9, border: `1px solid ${palette.border}`, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: palette.muted, fontWeight: 700, gridColumn: '1 / -1' }}>
            Описание (необязательно)
            <input
              type="text"
              placeholder="Кратко о плане занятия"
              value={newLesson.description}
              onChange={(e) => setNewLesson((prev) => ({ ...prev, description: e.target.value }))}
              style={{ borderRadius: 9, border: `1px solid ${palette.border}`, padding: '8px 10px' }}
            />
          </label>
          {hasStudentChoices ? (
            <label style={{ display: 'grid', gap: 5, fontSize: 12, color: palette.muted, fontWeight: 700 }}>
              Ученик
              <select
                value={newLesson.studentId}
                onChange={(e) => setNewLesson((prev) => ({ ...prev, studentId: e.target.value }))}
                style={{ borderRadius: 9, border: `1px solid ${palette.border}`, padding: '8px 10px', background: '#fff' }}
              >
                <option value="">Выберите…</option>
                {lessonStudentOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : studentPicker ? (
            <div style={{ fontSize: 12, color: palette.muted, fontWeight: 700, alignSelf: 'center' }}>
              Нет учеников — дождитесь загрузки списка.
            </div>
          ) : (
            <label style={{ display: 'grid', gap: 5, fontSize: 12, color: palette.muted, fontWeight: 700 }}>
              Ученик
              <input
                type="text"
                placeholder="Имя ученика"
                value={newLesson.student}
                onChange={(e) => setNewLesson((prev) => ({ ...prev, student: e.target.value }))}
                style={{ borderRadius: 9, border: `1px solid ${palette.border}`, padding: '8px 10px' }}
              />
            </label>
          )}
          <button
            type="submit"
            disabled={addLessonPending || (studentPicker && !hasStudentChoices)}
            style={{
              border: 0,
              borderRadius: 10,
              background: palette.blue,
              color: '#fff',
              fontWeight: 700,
              height: 38,
              cursor: addLessonPending || (studentPicker && !hasStudentChoices) ? 'not-allowed' : 'pointer',
              opacity: addLessonPending || (studentPicker && !hasStudentChoices) ? 0.65 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '0 14px',
            }}
          >
            <Plus size={16} />
            {addLessonPending ? 'Сохранение…' : 'Добавить занятие'}
          </button>
          {addLessonError ? (
            <div style={{ gridColumn: '1 / -1', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>{addLessonError}</div>
          ) : null}
        </form>
      )}

      {selectedEvent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 12,
          }}
        >
          <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 14, border: `1px solid ${palette.border}`, padding: '14px 14px 12px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: palette.text, fontSize: 17, fontWeight: 800 }}>Занятие</h3>
              <button type="button" onClick={closeEvent} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${palette.border}`, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 6, marginBottom: 10, color: palette.text, fontSize: 14 }}>
              <div><strong>Тема:</strong> {selectedEvent.title}</div>
              {selectedEvent.description ? (
                <div style={{ lineHeight: 1.45 }}>
                  <strong>Описание:</strong> {selectedEvent.description}
                </div>
              ) : null}
              <div><strong>Дата:</strong> {selectedEvent.date}</div>
              <div><strong>Время:</strong> {selectedEvent.time}</div>
              {selectedEvent.student ? <div><strong>Ученик:</strong> {selectedEvent.student}</div> : null}
              {detailLoading ? <div style={{ color: palette.muted, fontSize: 12 }}>Обновление данных…</div> : null}
              {detailError ? <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 600 }}>{detailError}</div> : null}
            </div>

            {canEditLink ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ display: 'grid', gap: 5, fontSize: 12, color: palette.muted, fontWeight: 700 }}>
                  Ссылка на занятие
                  <input
                    type="url"
                    placeholder="https://..."
                    value={linkDraft}
                    onChange={(e) => setLinkDraft(e.target.value)}
                    style={{ borderRadius: 9, border: `1px solid ${palette.border}`, padding: '8px 10px' }}
                  />
                </label>
                {linkError ? <div style={{ color: '#dc2626', fontSize: 12 }}>{linkError}</div> : null}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={saveLink} disabled={linkSavePending} style={{ flex: 1, height: 36, borderRadius: 10, border: 0, background: palette.blue, color: '#fff', fontWeight: 700, cursor: linkSavePending ? 'wait' : 'pointer', opacity: linkSavePending ? 0.85 : 1 }}>
                    {linkSavePending ? 'Сохранение…' : 'Сохранить ссылку'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyLink(linkDraft.trim())}
                    disabled={!linkDraft.trim()}
                    style={{
                      height: 36,
                      borderRadius: 10,
                      border: `1px solid ${palette.border}`,
                      background: '#fff',
                      color: palette.text,
                      fontWeight: 700,
                      cursor: linkDraft.trim() ? 'pointer' : 'not-allowed',
                      padding: '0 12px',
                    }}
                  >
                    Скопировать
                  </button>
                </div>
                {copyStatus ? <div style={{ color: palette.muted, fontSize: 12 }}>{copyStatus}</div> : null}
                {selectedEvent.videoLessonLink ? (
                  <div style={{ marginTop: 4, paddingTop: 10, borderTop: `1px solid ${palette.border}` }}>
                    <div style={{ fontSize: 12, color: palette.muted, fontWeight: 700, marginBottom: 6 }}>Запись занятия</div>
                    <a
                      href={selectedEvent.videoLessonLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: palette.blue, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}
                    >
                      Открыть видеозапись
                    </a>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 10 }}>
                {selectedEvent.meetingLink ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <a href={selectedEvent.meetingLink} target="_blank" rel="noreferrer" style={{ color: palette.blue, fontWeight: 700, textDecoration: 'none' }}>
                      Перейти к занятию
                    </a>
                    <button
                      type="button"
                      onClick={() => copyLink(selectedEvent.meetingLink)}
                      style={{
                        height: 28,
                        borderRadius: 8,
                        border: `1px solid ${palette.border}`,
                        background: '#fff',
                        color: palette.text,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '0 10px',
                        fontSize: 12,
                      }}
                    >
                      Скопировать
                    </button>
                    {copyStatus ? <span style={{ color: palette.muted, fontSize: 12 }}>{copyStatus}</span> : null}
                  </div>
                ) : (
                  <div style={{ color: palette.muted, fontSize: 13 }}>Ссылка на занятие пока не добавлена.</div>
                )}
                {selectedEvent.videoLessonLink ? (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${palette.border}` }}>
                    <div style={{ fontSize: 12, color: palette.muted, fontWeight: 700, marginBottom: 6 }}>Запись занятия</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href={selectedEvent.videoLessonLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: palette.blue, fontWeight: 700, textDecoration: 'none' }}
                      >
                        Смотреть запись
                      </a>
                      <button
                        type="button"
                        onClick={() => copyLink(selectedEvent.videoLessonLink)}
                        style={{
                          height: 28,
                          borderRadius: 8,
                          border: `1px solid ${palette.border}`,
                          background: '#fff',
                          color: palette.text,
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '0 10px',
                          fontSize: 12,
                        }}
                      >
                        Скопировать
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            {canDelete && onDeleteEvent ? (
              <div style={{ marginTop: 14, borderTop: `1px solid ${palette.border}`, paddingTop: 12 }}>
                {deleteError ? (
                  <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>{deleteError}</div>
                ) : null}
                <button
                  type="button"
                  disabled={deletePending}
                  onClick={confirmDeleteLesson}
                  style={{
                    width: '100%',
                    height: 38,
                    borderRadius: 10,
                    border: '1px solid #fecdd3',
                    background: '#fff1f2',
                    color: '#9f1239',
                    fontWeight: 700,
                    cursor: deletePending ? 'wait' : 'pointer',
                    opacity: deletePending ? 0.85 : 1,
                  }}
                >
                  {deletePending ? 'Удаление…' : 'Удалить занятие'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
