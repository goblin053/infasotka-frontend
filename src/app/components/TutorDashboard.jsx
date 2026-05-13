import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Send } from 'lucide-react';
import { ScheduleCalendar } from './ScheduleCalendar';
import { TutorHomeworkAssign } from './TutorHomeworkAssign';
import { apiRequest } from '../shared/apiClient';

const palette = {
  pageBg: '#f8fafc',
  card: '#ffffff',
  cardInner: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#3b82f6',
  blueDeep: '#2563eb',
  red: '#ef4444',
  yellowBg: '#fff9db',
  yellowBorder: '#f2d873',
};

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getProgressColor(value) {
  if (value >= 80) return '#10b981';
  if (value >= 65) return '#f59e0b';
  return palette.red;
}

function isAvatarUrl(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/');
}

function formatExamDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function TutorDashboard({
  studentsData = [],
  studentsLoading = false,
  studentsError = '',
  onRefreshStudents,
  scheduleEvents,
  scheduleLoading = false,
  scheduleError = '',
  lessonStudentOptions,
  onAddScheduleEvent,
  onUpdateScheduleEvent,
  onDeleteScheduleEvent,
  onFetchLessonDetails,
  onOpenStudentStats,
  homeworkTasks = [],
  homeworkTasksLoading = false,
  onCreateHomework,
  onReloadHomeworkTasks,
}) {
  const students = Array.isArray(studentsData) ? studentsData : [];
  const calendarEvents = Array.isArray(scheduleEvents) ? scheduleEvents : [];

  const [notifyText, setNotifyText] = useState('');
  const [notifyType, setNotifyType] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set());
  const [notifySending, setNotifySending] = useState(false);
  const [notifyOk, setNotifyOk] = useState('');
  const [notifyErr, setNotifyErr] = useState('');

  const toggleStudentSelection = (id) => {
    const sid = String(id);
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const selectAllStudents = () => {
    setSelectedStudentIds(new Set(students.map((s) => String(s.id))));
  };

  const clearStudentSelection = () => setSelectedStudentIds(new Set());

  const sendTutorNotification = async (event) => {
    event.preventDefault();
    setNotifyOk('');
    setNotifyErr('');
    const studentIds = Array.from(selectedStudentIds);
    const text = notifyText.trim();
    const type = notifyType.trim();
    if (studentIds.length === 0) {
      setNotifyErr('Выберите хотя бы одного ученика.');
      return;
    }
    if (!text) {
      setNotifyErr('Введите текст уведомления.');
      return;
    }
    if (!type) {
      setNotifyErr('Укажите тип уведомления (например, REMINDER или HOMEWORK).');
      return;
    }
    setNotifySending(true);
    try {
      await apiRequest('/api/tutors/notifications', {
        method: 'POST',
        body: JSON.stringify({ studentIds, text, type }),
      });
      setNotifyOk('Уведомление отправлено.');
      setNotifyText('');
      setNotifyType('');
      clearStudentSelection();
    } catch (e) {
      setNotifyErr(e?.message || 'Не удалось отправить уведомление.');
    } finally {
      setNotifySending(false);
    }
  };

  const attentionList = useMemo(
    () =>
      students.filter((item) => item.needsAttention || item.progress < 60).map((item) => ({
        id: item.id,
        name: item.name,
        progress: item.progress,
        reason: 'Низкая успеваемость. Рекомендуется дополнительное занятие.',
      })),
    [students]
  );

  return (
    <main
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: palette.pageBg,
        padding: '20px 22px 28px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <section style={{ flex: '1 1 640px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: palette.text }}>Мои ученики</h1>
              <div style={{ color: palette.muted, fontWeight: 600, fontSize: 14 }}>
                {studentsLoading ? 'Загрузка…' : `${students.length} учеников`}
              </div>
            </div>

            {studentsError ? (
              <div
                style={{
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#9f1239',
                  fontSize: 14,
                  marginBottom: 14,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span>{studentsError}</span>
                {onRefreshStudents ? (
                  <button
                    type="button"
                    onClick={() => onRefreshStudents()}
                    style={{
                      border: 0,
                      borderRadius: 8,
                      padding: '6px 12px',
                      background: palette.blue,
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Повторить
                  </button>
                ) : null}
              </div>
            ) : null}

            {studentsLoading ? (
              <div style={{ color: palette.muted, fontSize: 15, fontWeight: 600 }}>Загружаем список учеников и статистику…</div>
            ) : students.length === 0 ? (
              <div
                style={{
                  background: palette.card,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 14,
                  padding: '20px 16px',
                  color: palette.muted,
                  fontSize: 15,
                }}
              >
                У вас пока нет привязанных учеников. Когда ученик будет закреплён за вами в системе, он появится здесь
                автоматически.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 14 }}>
                {students.map((student) => (
                  <article
                    key={student.id}
                    style={{
                      background: palette.card,
                      border: `1px solid ${palette.border}`,
                      borderRadius: 14,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                        {isAvatarUrl(student.avatar) ? (
                          <img
                            src={student.avatar}
                            alt=""
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 999,
                              objectFit: 'cover',
                              flexShrink: 0,
                              border: `1px solid ${palette.border}`,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 999,
                              background: palette.blueDeep,
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 800,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {initials(student.name)}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: palette.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {student.name}
                          </div>
                          <div style={{ color: palette.muted, fontSize: 13 }}>
                            Решено {student.solved} / начато {student.total}
                            {student.level ? ` · ${student.level}` : ''}
                          </div>
                          {student.dateExam ? (
                            <div style={{ color: palette.muted, fontSize: 12, marginTop: 2 }}>
                              Экзамен: {formatExamDate(student.dateExam)}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {(student.needsAttention || student.progress < 60) && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: '#fff1f2',
                            color: '#be123c',
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <AlertCircle size={12} />
                          Внимание
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: palette.muted, marginBottom: 5 }}>
                      <span>Успеваемость</span>
                      <strong style={{ color: getProgressColor(student.progress), fontSize: 13 }}>{student.progress}%</strong>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ width: `${student.progress}%`, height: '100%', background: '#2b6cb0' }} />
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenStudentStats?.(student)}
                      style={{
                        marginTop: 12,
                        width: '100%',
                        height: 30,
                        borderRadius: 10,
                        border: `1px solid ${palette.border}`,
                        background: '#fff',
                        color: '#486581',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Подробнее
                      <ChevronRight size={15} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside style={{ flex: '1 1 300px', maxWidth: 320, minWidth: 280 }}>
            <section
              style={{
                background: palette.yellowBg,
                border: `1px solid ${palette.yellowBorder}`,
                borderRadius: 14,
                padding: '14px 14px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AlertCircle size={16} color="#b45309" />
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#854d0e' }}>Требуют внимания</h2>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {studentsLoading ? (
                  <div style={{ color: '#854d0e', fontSize: 13 }}>Загрузка…</div>
                ) : attentionList.length ? (
                  attentionList.map((student) => (
                    <article
                      key={student.id}
                      style={{
                        background: palette.card,
                        border: `1px solid ${palette.yellowBorder}`,
                        borderRadius: 10,
                        padding: '10px 10px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 999,
                            background: '#2b6cb0',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 800,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {initials(student.name)}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: palette.text }}>{student.name}</div>
                          <div style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>Успеваемость: {student.progress}%</div>
                          <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.3, color: '#7c2d12' }}>{student.reason}</p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div
                    style={{
                      background: palette.card,
                      border: `1px solid ${palette.yellowBorder}`,
                      borderRadius: 10,
                      padding: '12px 10px',
                      color: palette.muted,
                      fontSize: 13,
                    }}
                  >
                    Сейчас нет учеников с критическими проблемами.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        {!studentsLoading && students.length > 0 ? (
          <section
            style={{
              marginTop: 20,
              background: palette.card,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Send size={20} strokeWidth={2} color={palette.blueDeep} aria-hidden />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: palette.text }}>Уведомление ученикам</h2>
            </div>

            {notifyOk ? (
              <div
                style={{
                  marginBottom: 12,
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: '#ecfdf5',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {notifyOk}
              </div>
            ) : null}
            {notifyErr ? (
              <div
                style={{
                  marginBottom: 12,
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#9f1239',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {notifyErr}
              </div>
            ) : null}

            <form onSubmit={sendTutorNotification}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>Получатели</span>
                  <button
                    type="button"
                    onClick={selectAllStudents}
                    style={{
                      border: `1px solid ${palette.border}`,
                      background: '#fff',
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Выбрать всех
                  </button>
                  <button
                    type="button"
                    onClick={clearStudentSelection}
                    style={{
                      border: `1px solid ${palette.border}`,
                      background: '#fff',
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Снять выбор
                  </button>
                  <span style={{ fontSize: 12, color: palette.muted }}>выбрано: {selectedStudentIds.size}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    background: palette.cardInner,
                    maxHeight: 140,
                    overflow: 'auto',
                  }}
                >
                  {students.map((s) => {
                    const sid = String(s.id);
                    const checked = selectedStudentIds.has(sid);
                    return (
                      <label
                        key={sid}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          color: palette.text,
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudentSelection(sid)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: palette.muted, marginBottom: 6 }}>
                Тип уведомления
                <input
                  value={notifyType}
                  onChange={(e) => setNotifyType(e.target.value)}
                  placeholder="Например: REMINDER"
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: 6,
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
              </label>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: palette.muted, marginTop: 12, marginBottom: 6 }}>
                Текст
                <textarea
                  value={notifyText}
                  onChange={(e) => setNotifyText(e.target.value)}
                  placeholder="Текст, который увидит ученик…"
                  rows={4}
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: 6,
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    padding: '10px 12px',
                    fontSize: 14,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </label>

              <button
                type="submit"
                disabled={notifySending}
                style={{
                  marginTop: 14,
                  border: 0,
                  borderRadius: 10,
                  padding: '11px 20px',
                  background: palette.blue,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: notifySending ? 'not-allowed' : 'pointer',
                  opacity: notifySending ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Send size={18} />
                {notifySending ? 'Отправка…' : 'Отправить уведомление'}
              </button>
            </form>
          </section>
        ) : null}

        <TutorHomeworkAssign
          scheduleEvents={calendarEvents}
          scheduleLoading={scheduleLoading}
          tasks={homeworkTasks}
          tasksLoading={homeworkTasksLoading}
          onCreateHomework={onCreateHomework}
          onReloadTasks={onReloadHomeworkTasks}
        />

        <div style={{ marginTop: 20 }}>
          {scheduleError ? (
            <div
              style={{
                marginBottom: 10,
                borderRadius: 10,
                padding: '10px 12px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#9f1239',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {scheduleError}
            </div>
          ) : null}
          {scheduleLoading ? (
            <div style={{ marginBottom: 10, fontSize: 13, color: palette.muted, fontWeight: 600 }}>Загрузка расписания…</div>
          ) : null}
          <ScheduleCalendar
            title="Расписание занятий"
            events={calendarEvents}
            canAdd
            canEditLink
            lessonStudentOptions={lessonStudentOptions}
            onAddEvent={onAddScheduleEvent}
            onUpdateEvent={onUpdateScheduleEvent}
            canDelete
            onDeleteEvent={onDeleteScheduleEvent}
            onFetchLessonDetails={onFetchLessonDetails}
          />
        </div>
      </div>
    </main>
  );
}
